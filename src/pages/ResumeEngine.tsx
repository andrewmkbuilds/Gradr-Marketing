import { useState, useCallback, useEffect } from "react";
import { reportStorageFailure } from "@/lib/monitoring/reliability";
import { track } from "@/lib/telemetry/events";
import { Link } from "react-router-dom";
import {
  Upload, FileText, CheckCircle, AlertTriangle, Sparkles, RefreshCw, Loader2, BookOpen,
  Target, Gauge, ChevronRight, XCircle,
} from "lucide-react";

import { motion, AnimatePresence } from "motion/react";

import { PageHeader } from "@/components/app/PageHeader";
import { EngineCanvas } from "@/components/app/EngineCanvas";
import { Progressive } from "@/components/app/Progressive";
import { ResumeAnalysisDemo } from "@/components/demos/EngineDemos";
import { MetricBar } from "@/components/app/MetricBar";
import { ScoreDial } from "@/components/app/ScoreDial";
import { Surface } from "@/components/ui/surface";
import { Magnetic } from "@/components/motion";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { duration as motionDuration, easeOut, springSnappy } from "@/lib/motion/tokens";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { extractResumeText } from "@/lib/extractResumeText";
import { ResumeVersions } from "@/components/resume/ResumeVersions";
import { ResumeVersionDiff } from "@/components/resume/ResumeVersionDiff";
import { GenerationStream } from "@/components/ai/GenerationStream";
import { useAiStream } from "@/hooks/useAiStream";
import { parseSuggestions, suggestionsToJson, type Suggestion } from "@/lib/resume/suggestions";
import { cacheResumeFile, cacheVersion, latestCachedResumeFile } from "@/lib/offline/resumeCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";



interface Evidence {
  label: string;
  detail: string;
  ok: boolean;
}

interface AnalysisResult {
  ats_score: number;
  keyword_match: number;
  formatting_score: number;
  impact_score: number;
  readability_score: number;
  suggestions: Suggestion[];
  evidence?: Evidence[];
  rewrites?: { before: string; after: string }[];
  tailoredTo?: string | null;
  metrics?: {
    wordCount: number;
    quantifiedBullets: number;
    actionVerbCount: number;
    missingSkills: string[];
    matchedKeywords: string[];
    fleschReadingEase: number;
  };
}

const typeStyles: Record<string, { icon: typeof CheckCircle; color: string }> = {
  critical: { icon: AlertTriangle, color: "text-destructive" },
  warning: { icon: AlertTriangle, color: "text-warning" },
  improvement: { icon: Sparkles, color: "text-primary" },
  good: { icon: CheckCircle, color: "text-success" },
};

export default function ResumeEngine() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const reduced = useReducedMotionPref();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Streamed analysis: milestones + an early partial result with the
  // deterministic scores, then the AI coaching notes.
  const analysisStream = useAiStream<AnalysisResult>({
    fn: "analyze-resume",
    initialLabel: "Parsing your resume",
    onPartial: (partial) => setAnalysis(partial),
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showTailor, setShowTailor] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [versionsToken, setVersionsToken] = useState(0);

  const handleFileUpload = useCallback(async (selectedFile: File) => {
    if (!user) {
      toast.error("Please sign in to upload a resume");
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith(".txt")) {
      toast.error("Please upload a PDF, DOCX, or TXT file");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setUploading(true);

    // Keep a local copy first so the resume survives a dropped connection.
    let extractedText = "";
    try {
      extractedText = await extractResumeText(selectedFile);
      await cacheResumeFile({
        id: `draft:${user.id}`,
        user_id: user.id,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        blob: selectedFile,
        text: extractedText,
      });
    } catch (cacheError) {
      console.warn("Could not cache resume locally", cacheError);
    }

    if (!online) {
      setUploading(false);
      toast.message("Saved offline", {
        description: "Your resume is stored on this device. Scoring runs as soon as you reconnect.",
      });
      return;
    }
    const startedAt = Date.now();
    track("resume_uploaded", {
      file_type: selectedFile.name.split(".").pop()?.toLowerCase(),
      file_size_kb: Math.round(selectedFile.size / 1024),
      has_target_role: Boolean(jobTitle.trim()),
    });

    try {
      const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, selectedFile);

      if (uploadError) {
        reportStorageFailure("resume_upload", uploadError, {
          context: {
            file_type: selectedFile.type || "unknown",
            file_size_kb: Math.round(selectedFile.size / 1024),
          },
        });
        throw uploadError;
      }

      const text = extractedText || (await extractResumeText(selectedFile));

      setUploading(false);
      setAnalyzing(true);

      // Deterministic scores stream back first (as a `partial`), so the dials
      // fill in while the AI coaching notes are still being written.
      const analysisData = await analysisStream.start({
        resumeText: text,
        jobDescription,
        jobTitle,
        environment: getPaddleEnvironment(),
      });

      // Canceled or failed — the hook has already surfaced the reason.
      if (!analysisData) return;

      setAnalysis({ ...analysisData, suggestions: parseSuggestions(analysisData.suggestions) });

      const versionLabel = jobTitle.trim()
        ? `${jobTitle.trim()} — ${selectedFile.name.replace(/\.[^.]+$/, "")}`
        : selectedFile.name.replace(/\.[^.]+$/, "");

      const { data: saved } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type,
          version_label: versionLabel,
          ats_score: analysisData.ats_score,
          keyword_match: analysisData.keyword_match,
          formatting_score: analysisData.formatting_score,
          impact_score: analysisData.impact_score,
          readability_score: analysisData.readability_score,
          ai_suggestions: suggestionsToJson(parseSuggestions(analysisData.suggestions)),
          parsed_text: text.substring(0, 10000),
        })
        .select("id")
        .maybeSingle();

      setActiveVersionId(saved?.id ?? null);
      setVersionsToken((t) => t + 1);

      if (saved?.id) {
        // Mirror the new version (and its file bytes) into IndexedDB.
        await cacheVersion(user.id, {
          id: saved.id,
          file_name: selectedFile.name,
          file_path: filePath,
          version_label: versionLabel,
          ats_score: analysisData.ats_score,
          keyword_match: analysisData.keyword_match,
          formatting_score: analysisData.formatting_score,
          impact_score: analysisData.impact_score,
          readability_score: analysisData.readability_score,
          ai_suggestions: suggestionsToJson(parseSuggestions(analysisData.suggestions)),
          parsed_text: text.substring(0, 10000),
          created_at: new Date().toISOString(),
        });
        await cacheResumeFile({
          id: saved.id,
          user_id: user.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          blob: selectedFile,
          text,
        });
      }

      // Activation moment: the user has seen real output from the product.
      track("resume_analyzed", {
        ats_score: analysisData.ats_score,
        keyword_match: analysisData.keyword_match,
        suggestion_count: parseSuggestions(analysisData.suggestions).length,
        duration_ms: Date.now() - startedAt,
        has_target_role: Boolean(jobTitle.trim()),
      });

      toast.success("Resume analyzed and saved as a version");
    } catch (error: any) {
      track("resume_analysis_failed", { reason: String(error?.message ?? "unknown").slice(0, 120) });
      toast.error(error.message || "Failed to analyze resume");
      console.error(error);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }, [user, jobDescription, jobTitle, analysisStream, online]);

  // Restore the last resume held on this device (survives reloads and offline).
  useEffect(() => {
    if (!user || file) return;
    let cancelled = false;
    void (async () => {
      const cached = await latestCachedResumeFile(user.id);
      if (!cached || cancelled) return;
      setFileName((current) => current || cached.file_name);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, file]);

  // Reconnected with an unscored offline upload — run the analysis now.
  useEffect(() => {
    if (!online || !file || analysis || uploading || analyzing) return;
    toast.message("Back online", { description: "Scoring the resume you saved offline…" });
    void handleFileUpload(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleRescan = async () => {
    if (!file) return;
    setAnalysis(null);
    await handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileUpload(droppedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileUpload(selectedFile);
  };

  const stagger = (index: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.14 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: motionDuration.base, ease: easeOut, delay: index * 0.05 },
        };

  const tailorPanel = (
    <Surface level={2} flush className="overflow-hidden">
      <button
        type="button"
        onClick={() => setShowTailor((v) => !v)}
        aria-expanded={showTailor}
        className="interactive flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-secondary/60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          Tailor to a specific job
          {jobDescription.trim().length > 40 && (
            <span className="rounded-full bg-brand-secondary/12 px-2 py-0.5 text-[10px] font-medium text-brand-secondary">
              Active
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: showTailor ? 90 : 0 }} transition={reduced ? { duration: 0 } : springSnappy}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {showTailor && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0.12 } : { duration: motionDuration.fast, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border px-5 py-4">
              <Input
                placeholder="Job title (optional)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="bg-surface-secondary"
              />
              <Textarea
                placeholder="Paste the full job description to score keyword coverage against this exact role…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={6}
                className="resize-y bg-surface-secondary"
              />
              <p className="text-xs text-muted-foreground">
                With a job description, keyword match is measured against the posting instead of a general skill lexicon.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );

  const guideLinks = (
    <>
      <Link
        to="/blog/ai-resume-optimization?utm_source=app&utm_medium=internal_link&utm_campaign=ai_resume_optimization&utm_content=resume_engine_header"
        className="story-link inline-flex items-center gap-1.5 text-xs text-mahogany"
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        AI resume builders &amp; ATS optimization
      </Link>
      <Link
        to="/ats-resume-checker?utm_source=app&utm_medium=internal_link&utm_campaign=ats_resume_checker&utm_content=resume_engine_header"
        className="story-link inline-flex items-center gap-1.5 text-xs text-mahogany"
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        How ATS scoring works
      </Link>
    </>
  );

  return (
    <EngineCanvas>
      <PageHeader
        eyebrow="Resume Intelligence"
        icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />}
        title="Score what recruiters and parsers actually read"
        description="Deterministic ATS scoring, keyword overlap and readability analysis — every number computed from your actual resume text."
        meta={guideLinks}
      />

      {!uploading && !analyzing && tailorPanel}

      {!uploading && !analyzing && (
        <ResumeVersions
          key={versionsToken}
          activeId={activeVersionId}
          onSelect={(v) => {
            setActiveVersionId(v.id);
            setFileName(v.file_name);
            setAnalysis({
              ats_score: v.ats_score ?? 0,
              keyword_match: v.keyword_match ?? 0,
              formatting_score: v.formatting_score ?? 0,
              impact_score: v.impact_score ?? 0,
              readability_score: v.readability_score ?? 0,
              suggestions: parseSuggestions(v.ai_suggestions),
              tailoredTo: v.version_label,
            });
          }}
        />
      )}

      {!uploading && !analyzing && <ResumeVersionDiff key={`diff-${versionsToken}`} />}

      {/* Live analysis progress: cancel while it runs, retry if it fails.
          Once the scorecard below is final, the rail retires itself. */}
      {analysisStream.status !== "done" && (
      <GenerationStream
        status={analysisStream.status}
        progress={analysisStream.progress}
        label={analysisStream.label}
        text={analysisStream.text}
        error={analysisStream.error}
        title="Resume analysis"
        description="Scores and coaching notes are ready."
        onCancel={analysisStream.cancel}
        onRetry={analysisStream.retry}
      />
      )}

      <AnimatePresence mode="wait">
        {!analysis && !uploading && !analyzing ? (
          <motion.div key="dropzone" {...stagger(0)} exit={{ opacity: 0 }}>
            <Magnetic strength={10}>
              <label
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="elev-3 elev-interactive group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 px-6 py-14 text-center"
              >
                <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleInputChange} />
                <motion.span
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                  whileHover={reduced ? undefined : { scale: 1.06, rotate: -4 }}
                  transition={springSnappy}
                >
                  <Upload className="h-7 w-7" aria-hidden="true" />
                </motion.span>
                <h3 className="font-display text-lg text-foreground">Drop your resume in</h3>
                <p className="mt-1 text-sm text-muted-foreground">PDF, DOCX or TXT · max 10MB</p>
                <span className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm">
                  Choose a file
                </span>
              </label>
            </Magnetic>

            {/* Nothing scored yet — let the user feel how the scorecard reacts
                before they upload anything. Deferred so the dropzone paints first. */}
            <Progressive minHeight={360} className="mt-5">
              <ResumeAnalysisDemo />
            </Progressive>
          </motion.div>
        ) : uploading ? (
          <motion.div key="working" {...stagger(0)} exit={{ opacity: 0 }}>
            <Surface level={3} className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border border-primary/25"
                  animate={reduced ? undefined : { scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg text-foreground" role="status">
                  Uploading your resume
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Encrypting and storing the file…</p>
              </div>
            </Surface>
          </motion.div>
        ) : analysis ? (
          <motion.div key="analysis" className="grid grid-cols-1 gap-5 lg:grid-cols-3" {...stagger(0)}>
            {/* Score */}
            <motion.div {...stagger(0)} className="lg:row-span-2">
              <Surface level={3} className="flex h-full flex-col items-center gap-6 p-6 lg:sticky lg:top-6">
                <div className="w-full text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-secondary">
                    Overall
                  </p>
                  <h3 className="font-display text-lg text-foreground">ATS readiness</h3>
                </div>
                <ScoreDial
                  score={analysis.ats_score}
                  label="ATS"
                  caption={
                    analysis.ats_score >= 80
                      ? "Well-optimized for parsers. Focus on impact language next."
                      : analysis.ats_score >= 60
                      ? "Solid base — keyword and impact gaps will cost you screens."
                      : "Significant structural and keyword work needed."
                  }
                />
                {analysis.tailoredTo && (
                  <p className="rounded-full bg-brand-secondary/10 px-3 py-1 text-center text-xs text-brand-secondary">
                    Scored against {analysis.tailoredTo}
                  </p>
                )}
                <div className="w-full space-y-4">
                  {[
                    { label: "Keyword match", value: analysis.keyword_match },
                    { label: "Formatting", value: analysis.formatting_score },
                    { label: "Impact", value: analysis.impact_score },
                    { label: "Readability", value: analysis.readability_score },
                  ].map((m, i) => (
                    <MetricBar key={m.label} label={m.label} value={m.value} delay={i * 0.08} />
                  ))}
                </div>
              </Surface>
            </motion.div>

            {/* Fix list */}
            <motion.div {...stagger(1)} className="lg:col-span-2">
              <Surface level={2} className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg text-foreground">Fix list</h3>
                  <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                    {analysis.suggestions.length} items
                  </span>
                </div>
                {analysis.suggestions.length === 0 ? (
                  <p className="rounded-xl bg-surface-secondary p-4 text-sm text-muted-foreground">
                    No actionable fixes came back for this version. Re-scan with a job description for sharper guidance.
                  </p>
                ) : (
                <ol className="space-y-2.5">
                  {analysis.suggestions.map((s, i) => {
                    const style = typeStyles[s.type] || typeStyles.improvement;
                    const Icon = style.icon;
                    return (
                      <motion.li
                        key={`${s.type}-${i}`}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={reduced ? { duration: 0.12 } : { duration: motionDuration.fast, ease: easeOut, delay: 0.04 * i }}
                        className="flex items-start gap-3 rounded-xl bg-surface-secondary p-3.5 transition-colors hover:bg-surface-secondary/70"
                      >
                        <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.color}`} aria-hidden="true" />
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm leading-relaxed text-foreground/90">{s.text}</p>
                          {s.action && (
                            <p className="flex items-start gap-1.5 text-sm leading-relaxed text-foreground">
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-secondary" aria-hidden="true" />
                              <span>
                                <span className="font-medium text-brand-secondary">Next: </span>
                                {s.action}
                              </span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className={`rounded-full bg-surface-primary px-2 py-0.5 text-[0.68rem] uppercase tracking-wide ${style.color}`}>
                              {s.type}
                            </span>
                            <span className="text-[0.68rem] text-muted-foreground">
                              Source: {s.source ?? "Gradr resume analysis"}
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button className="interactive press-scale" onClick={handleRescan}>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Re-scan
                  </Button>
                  <label>
                    <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleInputChange} />
                    <Button variant="outline" className="interactive press-scale" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                        Upload new version
                      </span>
                    </Button>
                  </label>
                </div>
              </Surface>
            </motion.div>

            {/* Evidence */}
            {analysis.evidence?.length ? (
              <motion.div {...stagger(2)} className="lg:col-span-2">
                <Surface level={2} className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 font-display text-lg text-foreground">
                    <Gauge className="h-4 w-4 text-mahogany" aria-hidden="true" />
                    How these scores were calculated
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {analysis.evidence.map((e, i) => (
                      <motion.div
                        key={e.label}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={reduced ? { duration: 0.12 } : { duration: motionDuration.fast, ease: easeOut, delay: i * 0.03 }}
                        className="flex items-start gap-2.5 rounded-xl bg-surface-secondary p-3"
                      >
                        {e.ok ? (
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{e.label}</p>
                          <p className="break-words text-xs text-muted-foreground">{e.detail}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Surface>
              </motion.div>
            ) : null}

            {/* Keyword gaps */}
            {analysis.metrics?.missingSkills?.length ? (
              <motion.div {...stagger(3)}>
                <Surface level={2} className="p-6">
                  <h3 className="mb-3 font-display text-base text-foreground">Missing job keywords</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.metrics.missingSkills.slice(0, 20).map((s, i) => (
                      <motion.span
                        key={s}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={reduced ? { duration: 0.1 } : { ...springSnappy, delay: i * 0.02 }}
                        className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
                      >
                        {s}
                      </motion.span>
                    ))}
                  </div>
                  {analysis.metrics.matchedKeywords?.length ? (
                    <>
                      <h4 className="mb-2 mt-5 text-xs font-medium text-muted-foreground">Already covered</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.metrics.matchedKeywords.slice(0, 20).map((s) => (
                          <span key={s} className="rounded-md bg-success/10 px-2 py-1 text-xs text-success">{s}</span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </Surface>
              </motion.div>
            ) : null}

            {/* Rewrites */}
            {analysis.rewrites?.length ? (
              <motion.div {...stagger(4)} className="lg:col-span-3">
                <Surface level={2} className="p-6">
                  <h3 className="mb-4 font-display text-lg text-foreground">Suggested bullet rewrites</h3>
                  <div className="space-y-3">
                    {analysis.rewrites.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={reduced ? { duration: 0.12 } : { duration: motionDuration.fast, ease: easeOut, delay: i * 0.04 }}
                        className="grid gap-4 rounded-xl bg-surface-secondary p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                      >
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Before</p>
                          <p className="text-sm text-muted-foreground line-through decoration-destructive/40">{r.before}</p>
                        </div>
                        <ChevronRight className="hidden h-4 w-4 text-brand-secondary sm:block" aria-hidden="true" />
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">After</p>
                          <p className="text-sm text-foreground">{r.after}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Surface>
              </motion.div>
            ) : null}

            {/* Source file */}
            <motion.div {...stagger(5)} className="lg:col-span-3">
              <Surface level={1} className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.metrics
                      ? `${analysis.metrics.wordCount} words · ${analysis.metrics.actionVerbCount} action verbs · Flesch ${analysis.metrics.fleschReadingEase}`
                      : "Analyzed just now"}
                  </p>
                </div>
              </Surface>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </EngineCanvas>
  );
}
