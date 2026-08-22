import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/telemetry/events";
import { trackFirstTime, trackJobSaved } from "@/lib/telemetry/activation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SkeletonList } from "@/components/states";
import { ExternalLink, Trash2, Bell, Loader2, Plus, Sparkles, Link2, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { handleAiFunctionError } from "@/lib/aiErrors";

type Status = "saved" | "applied" | "interview" | "offer" | "rejected";

interface ApplicationPack {
  cover_letter?: { subject: string; body: string };
  recruiter_message?: { subject: string; body: string };
  bullet_rewrites?: { original_hint?: string; rewritten: string }[];
}

interface TrackedJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  url: string | null;
  status: Status;
  match_score: number | null;
  applied_at: string | null;
  created_at: string;
  notes: string | null;
  application_pack: ApplicationPack | null;
}

interface Reminder {
  id: string;
  tracked_job_id: string;
  title: string;
  due_at: string;
  done: boolean;
}

const COLUMNS: { key: Status; label: string; tone: string }[] = [
  { key: "saved", label: "Saved", tone: "bg-muted/40" },
  { key: "applied", label: "Applied", tone: "bg-primary/10" },
  { key: "interview", label: "Interview", tone: "bg-mahogany-soft/70" },
  { key: "offer", label: "Offer", tone: "bg-success/10" },
  { key: "rejected", label: "Rejected", tone: "bg-destructive/10" },
];

function JobCard({ job, onClick }: { job: TrackedJob; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`p-3 rounded-lg bg-card border border-border hover:border-mahogany/50 hover:shadow-[inset_2px_0_0_hsl(var(--mahogany)/0.8)] cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <p className="text-sm font-medium text-foreground line-clamp-2">{job.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{job.company || "Unknown"}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {typeof job.match_score === "number" && (
          <Badge variant="accentSoft" className="text-[10px]">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />{job.match_score}%
          </Badge>
        )}
        {job.remote && <Badge variant="secondary" className="text-[10px]">Remote</Badge>}
      </div>
    </div>
  );
}

function Column({ status, label, tone, jobs, onCardClick }: {
  status: Status; label: string; tone: string; jobs: TrackedJob[]; onCardClick: (j: TrackedJob) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col min-w-[260px] flex-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <Badge variant="secondary" className="text-xs">{jobs.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 space-y-2 min-h-[400px] transition-colors ${tone} ${isOver ? "ring-2 ring-primary/40" : ""}`}
      >
        {jobs.map((job) => <JobCard key={job.id} job={job} onClick={() => onCardClick(job)} />)}
        {jobs.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Drop here</p>}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrackedJob | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDue, setReminderDue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [jRes, rRes] = await Promise.all([
      supabase.from("tracked_jobs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("job_reminders").select("*").eq("user_id", user!.id).eq("done", false).order("due_at"),
    ]);
    setJobs((jRes.data || []) as TrackedJob[]);
    setReminders((rRes.data || []) as Reminder[]);
    setLoading(false);
  };

  const grouped = useMemo(() => {
    const m: Record<Status, TrackedJob[]> = { saved: [], applied: [], interview: [], offer: [], rejected: [] };
    for (const j of jobs) m[j.status]?.push(j);
    return m;
  }, [jobs]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const newStatus = e.over?.id as Status | undefined;
    if (!newStatus || !COLUMNS.find((c) => c.key === newStatus)) return;
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === newStatus) return;

    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j)));
    const updates: { status: Status; applied_at?: string } = { status: newStatus };
    if (newStatus === "applied" && !job.applied_at) updates.applied_at = new Date().toISOString();
    const { error } = await supabase.from("tracked_jobs").update(updates).eq("id", id);
    if (!error) {
      track("job_application_tracked", { from_stage: job.status, to_stage: newStatus });
      if (newStatus === "applied") {
        trackFirstTime("first_job_saved", user?.id, { source: "pipeline" });
      }
    }
    if (error) {
      toast.error("Failed to update");
      load();
    }
  };

  const deleteJob = async (id: string) => {
    setJobs((p) => p.filter((j) => j.id !== id));
    setSelected(null);
    await supabase.from("tracked_jobs").delete().eq("id", id);
    toast.success("Removed");
  };

  const addReminder = async () => {
    if (!selected || !reminderTitle || !reminderDue) return;
    const { error } = await supabase.from("job_reminders").insert({
      user_id: user!.id,
      tracked_job_id: selected.id,
      title: reminderTitle,
      due_at: new Date(reminderDue).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Reminder set");
    setReminderTitle("");
    setReminderDue("");
    load();
  };

  const completeReminder = async (id: string) => {
    setReminders((r) => r.filter((x) => x.id !== id));
    await supabase.from("job_reminders").update({ done: true }).eq("id", id);
  };

  const addFromUrl = async () => {
    if (!pasteUrl.trim()) return;
    setPasting(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-job-url", {
        body: { url: pasteUrl.trim() },
      });
      if (error || data?.error) {
        if (!handleAiFunctionError(error, data)) toast.error(data?.error || "Failed");
        return;
      }
      const { error: insErr } = await supabase.from("tracked_jobs").insert({
        user_id: user!.id,
        source: "manual",
        title: data.title || "Untitled",
        company: data.company,
        location: data.location,
        remote: !!data.remote,
        url: pasteUrl.trim(),
        description: data.description,
        salary_min: data.salary_min,
        salary_max: data.salary_max,
        status: "saved",
      });
      if (insErr) throw insErr;
      trackJobSaved(user?.id, { source: "manual" });
      setPasteUrl("");
      setPasteOpen(false);
      toast.success("Added to pipeline");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPasting(false);
    }
  };

  const activeJob = activeId ? jobs.find((j) => j.id === activeId) : null;

  if (loading) {
    return <SkeletonList rows={3} className="max-w-[1400px] mx-auto" />;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="type-h1">Application Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Drag jobs across stages. Track every opportunity.</p>
        </div>
        <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add job</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a job by URL</DialogTitle>
              <DialogDescription>Paste any job posting URL — AI will extract the details automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Job URL</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="https://…" className="pl-10" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addFromUrl} disabled={pasting || !pasteUrl.trim()} className="gap-2">
                {pasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Extract & add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reminders bar */}
      {reminders.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold">Upcoming reminders</h3>
          </div>
          <div className="space-y-2">
            {reminders.slice(0, 5).map((r) => {
              const job = jobs.find((j) => j.id === r.tracked_job_id);
              const overdue = new Date(r.due_at) < new Date();
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-secondary/50">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job?.title || "Job"} · <span className={overdue ? "text-destructive" : ""}>{formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => completeReminder(r.id)}>Done</Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div
          role="region"
          aria-label="Application pipeline board"
          tabIndex={0}
          className="flex gap-4 overflow-x-auto pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {COLUMNS.map((c) => (
            <Column key={c.key} status={c.key} label={c.label} tone={c.tone} jobs={grouped[c.key]} onCardClick={setSelected} />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? (
            <div className="p-3 rounded-lg bg-card border-2 border-primary shadow-lg w-[260px]">
              <p className="text-sm font-medium">{activeJob.title}</p>
              <p className="text-xs text-muted-foreground">{activeJob.company}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selected.title}</DialogTitle>
                <DialogDescription>{selected.company || "Unknown"} · {selected.location || "—"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selected.status}</Badge>
                  {typeof selected.match_score === "number" && (
                    <Badge className="bg-primary/15 text-primary border-primary/30">{selected.match_score}% match</Badge>
                  )}
                  {selected.applied_at && <Badge variant="secondary">Applied {formatDistanceToNow(new Date(selected.applied_at), { addSuffix: true })}</Badge>}
                </div>
                {selected.url && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => window.open(selected.url!, "_blank")}>
                    <ExternalLink className="h-4 w-4" /> Open job posting
                  </Button>
                )}

                {selected.application_pack && (
                  <div className="space-y-3 pt-2 border-t border-border max-h-[300px] overflow-y-auto">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label className="text-xs uppercase tracking-wider text-primary">AI Application Pack</Label>
                    </div>
                    {selected.application_pack.cover_letter && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <FileText className="h-3 w-3" /> Cover letter
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(selected.application_pack!.cover_letter!.body);
                              toast.success("Cover letter copied");
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground italic">{selected.application_pack.cover_letter.subject}</p>
                        <Textarea
                          readOnly
                          value={selected.application_pack.cover_letter.body}
                          className="text-xs h-32 resize-none"
                        />
                      </div>
                    )}
                    {selected.application_pack.bullet_rewrites && selected.application_pack.bullet_rewrites.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">Resume bullet rewrites</p>
                        <ul className="space-y-1.5 text-xs">
                          {selected.application_pack.bullet_rewrites.map((b, i) => (
                            <li key={i} className="p-2 rounded bg-secondary/50 text-foreground">
                              {b.rewritten}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.application_pack.recruiter_message && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Recruiter outreach</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(selected.application_pack!.recruiter_message!.body);
                              toast.success("Message copied");
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <Textarea
                          readOnly
                          value={selected.application_pack.recruiter_message.body}
                          className="text-xs h-20 resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Add reminder</Label>
                  <Input placeholder="e.g. Follow up with recruiter" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} />
                  <Input type="datetime-local" value={reminderDue} onChange={(e) => setReminderDue(e.target.value)} />
                  <Button onClick={addReminder} disabled={!reminderTitle || !reminderDue} className="w-full gap-2">
                    <Bell className="h-4 w-4" /> Set reminder
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => deleteJob(selected.id)} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
