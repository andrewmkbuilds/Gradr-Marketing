import { scrollIntoViewSafely, scrollToSafely } from "@/lib/motion/scroll";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Mic, MicOff, Send, Loader2, RotateCcw, User, Bot, Volume2, VolumeX,
  Square, Radio, Hand, Zap, Captions, WifiOff, Search, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CameraMonitor } from "@/components/interview/CameraMonitor";
import { InterviewerOrb, type InterviewerState } from "@/components/interview/InterviewerOrb";
import { VoiceErrorPanel } from "@/components/interview/VoiceErrorPanel";
import { VoiceHealthWidget } from "@/components/interview/VoiceHealthWidget";
import { Surface } from "@/components/ui/surface";
import { DepthStage, DepthLayer } from "@/components/motion/Depth";
import { SessionTimerRing } from "@/components/interview/SessionTimerRing";
import { springSmooth, springSnappy, easeOut } from "@/lib/motion/tokens";
import type { IntegritySnapshot } from "@/lib/cv/faceMonitor";
import type { VoiceErrorCode, VoiceProviderReason } from "@/lib/interview/voiceErrors";


export type Msg = { role: "user" | "assistant"; content: string };

interface Limits {
  tier: string;
  sessionsPerMonth: number | null;
  sessionsRemaining: number | null;
  maxSessionMinutes: number;
}

interface Props {
  targetRole: string;
  messages: Msg[];
  partialUser: string;
  partialModel: string;
  interviewerState: InterviewerState;
  realtime: boolean;
  connecting: boolean;
  canReconnect: boolean;
  micMuted: boolean;
  micLabel: string;
  voiceOn: boolean;
  thinking: boolean;
  ending: boolean;
  input: string;
  limits: Limits | null;
  startedAt: number;
  connectionLost?: boolean;
  /** Sanitized Gradr voice error code — never provider wording. */
  voiceErrorCode?: VoiceErrorCode | null;
  /** Enumerated provider reason behind the failure (entitlement, quota, …). */
  voiceErrorReason?: VoiceProviderReason | null;
  /** Backend request id for the failed turn — quotable to support. */
  voiceErrorRequestId?: string | null;
  /** False when the account's plan doesn't include studio voice. */
  voiceAvailable?: boolean;
  /** A background health check is currently probing for voice recovery. */
  voiceRecovering?: boolean;
  onDismissConnectionError?: () => void;


  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onToggleMic: () => void;
  onToggleVoice: () => void;
  onInterrupt: () => void;
  onReconnect: () => void;
  onEnd: () => void;
  onReset: () => void;
  onSnapshot: (s: IntegritySnapshot) => void;
}

/** Splits text into highlighted / plain segments for the transcript search. */
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({ text: text.slice(idx, idx + needle.length), match: true });
    i = idx + needle.length;
    idx = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push({ text: text.slice(i), match: false });
  return parts;
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * The live interview studio.
 *
 * Interviewer presence, live captions, transcript, presence monitoring and the
 * control dock in one cohesive room — designed to read clearly at every
 * breakpoint and to stay legible with motion disabled.
 */
export function InterviewStudio(props: Props) {
  const {
    targetRole, messages, partialUser, partialModel, interviewerState, realtime, connecting,
    canReconnect, micMuted, micLabel, voiceOn, thinking, ending, input, limits, startedAt,
    connectionLost, voiceErrorCode, voiceErrorReason, voiceErrorRequestId,
    voiceAvailable = true, voiceRecovering = false, onDismissConnectionError,

    onInputChange, onSubmit, onToggleMic, onToggleVoice, onInterrupt, onReconnect, onEnd, onReset, onSnapshot,
  } = props;

  const reduced = useReducedMotionPref();
  const [elapsed, setElapsed] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const tick = () => setElapsed(Math.round((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (query.trim()) return;
    if (scrollRef.current) scrollToSafely({ top: scrollRef.current.scrollHeight }, scrollRef.current);
  }, [messages, partialUser, partialModel, query]);

  const matchIndexes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages.reduce<number[]>((acc, m, i) => {
      if (m.content.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [messages, query]);

  useEffect(() => setActiveMatch(0), [query]);

  useEffect(() => {
    const target = matchIndexes[activeMatch];
    if (target === undefined) return;
    scrollIntoViewSafely(matchRefs.current[target], { block: "center" });
  }, [activeMatch, matchIndexes]);

  const jump = (dir: 1 | -1) => {
    if (matchIndexes.length === 0) return;
    setActiveMatch((i) => (i + dir + matchIndexes.length) % matchIndexes.length);
  };

  const overtime = limits ? elapsed > limits.maxSessionMinutes * 60 : false;
  const currentQuestion =
    partialModel || [...messages].reverse().find((m) => m.role === "assistant")?.content || "";
  const liveCaption = partialModel || partialUser;
  const activeMessageIndex = matchIndexes[activeMatch];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
        {connectionLost && onDismissConnectionError && (
          <VoiceErrorPanel
            open
            code={voiceErrorCode}
            reason={voiceErrorReason}
            requestId={voiceErrorRequestId}
            retrying={connecting || voiceRecovering}
            onRetryAfterReconnect={onReconnect}
            onDismiss={onDismissConnectionError}
          />

        )}

        {/* ---------- Header ---------- */}
        <motion.header
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex min-w-0 items-center gap-4">
            <SessionTimerRing elapsed={elapsed} limitMinutes={limits?.maxSessionMinutes} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-secondary">
                Live session
              </p>
              <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {targetRole || "Mock interview"}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {connecting ? (
                  <Badge variant="outline" className="gap-1.5 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Connecting
                  </Badge>
                ) : realtime ? (
                  <Badge variant="outline" className="gap-1.5 border-primary/50 font-medium text-primary">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    Studio voice
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5 font-medium">
                    <WifiOff className="h-3 w-3" aria-hidden="true" />
                    Voice unavailable
                  </Badge>
                )}
                {limits && (
                  <span className={cn("text-xs", overtime ? "text-destructive" : "text-muted-foreground")}>
                    {overtime ? "Over the " : ""}{limits.maxSessionMinutes} min limit
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <VoiceHealthWidget className="hidden sm:inline-flex" />
            {canReconnect && (
              <Button variant="outline" size="sm" onClick={onReconnect} disabled={connecting}>
                <Zap className="mr-2 h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Retry studio voice</span>
                <span className="sm:hidden">Retry voice</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEnd} disabled={ending}>
              {ending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Square className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              End &amp; score
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onReset} aria-label="Restart interview" className="min-h-11 min-w-11">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart interview</TooltipContent>
            </Tooltip>
          </div>
        </motion.header>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ---------- Stage + transcript ---------- */}
          <div className="flex min-w-0 flex-col gap-4">
            <DepthStage className="rounded-2xl" tilt={3} sheen={false}>
            <Surface
              level={3}
              flush
              className="relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10"
              aria-label="Interviewer stage"
            >
              {/* Stage atmosphere: a grid floor and a soft top light, both static and cheap. */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, hsl(var(--border)/0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)/0.5) 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                aria-hidden="true"
              />

              <DepthLayer z={46} className="relative">
                <InterviewerOrb state={interviewerState} />

                <AnimatePresence mode="wait" initial={false}>
                  {currentQuestion && (
                    <motion.div
                      key={currentQuestion.slice(0, 64)}
                      initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduced ? undefined : { opacity: 0, y: -10, filter: "blur(6px)" }}
                      transition={{ duration: 0.45, ease: easeOut }}
                      className="mx-auto mt-8 max-w-2xl text-center"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-secondary">
                        Current question
                      </p>
                      <p className="mt-2 font-display text-lg leading-snug text-foreground sm:text-xl">
                        {currentQuestion}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {captionsOn && liveCaption && (
                    <motion.p
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: 4 }}
                      transition={springSmooth}
                      className="mx-auto mt-6 max-w-2xl rounded-xl border border-border/60 bg-background/70 px-4 py-2 text-center text-sm text-foreground backdrop-blur-md"
                    >
                      {liveCaption}
                    </motion.p>
                  )}
                </AnimatePresence>
              </DepthLayer>

              {/* Screen-reader live region: always announces, independent of visual captions */}
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {liveCaption}
              </p>
            </Surface>
            </DepthStage>

            {/* Transcript */}
            <Surface level={2} flush className="flex min-h-[220px] flex-col p-4 sm:p-5" aria-label="Interview transcript">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Transcript
                </h2>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchOpen((o) => {
                            if (o) setQuery("");
                            else window.setTimeout(() => searchRef.current?.focus(), 0);
                            return !o;
                          });
                        }}
                        aria-pressed={searchOpen}
                        aria-label={searchOpen ? "Close transcript search" : "Search transcript"}
                        className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Search className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Search transcript</TooltipContent>
                  </Tooltip>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCaptionsOn((c) => !c)}
                    role="switch"
                    aria-checked={captionsOn}
                    aria-label={captionsOn ? "Turn live captions off" : "Turn live captions on"}
                    className="h-8 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Captions
                      className={cn("mr-1.5 h-3.5 w-3.5", captionsOn ? "text-primary" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                    Captions {captionsOn ? "on" : "off"}
                  </Button>
                </div>
              </div>

              {/* Announces control state changes to screen readers */}
              <p className="sr-only" role="status" aria-live="polite">
                {`Live captions ${captionsOn ? "on" : "off"}.`}
                {searchOpen && query.trim()
                  ? ` ${matchIndexes.length} matching ${matchIndexes.length === 1 ? "message" : "messages"}${
                      matchIndexes.length ? `, showing result ${activeMatch + 1}` : ""
                    }.`
                  : ""}
              </p>

              {searchOpen && (
                <div className="mb-3 flex items-center gap-2">
                  <label htmlFor="transcript-search" className="sr-only">
                    Search transcript
                  </label>
                  <Input
                    id="transcript-search"
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        jump(e.shiftKey ? -1 : 1);
                      }
                      if (e.key === "Escape") {
                        setQuery("");
                        setSearchOpen(false);
                      }
                    }}
                    placeholder="Search the transcript…"
                    className="h-9 flex-1 bg-secondary/60"
                  />
                  <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
                    {query.trim() ? `${matchIndexes.length ? activeMatch + 1 : 0}/${matchIndexes.length}` : "—"}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => jump(-1)}
                    disabled={matchIndexes.length === 0}
                    aria-label="Previous match"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => jump(1)}
                    disabled={matchIndexes.length === 0}
                    aria-label="Next match"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                    }}
                    aria-label="Close search"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              <div ref={scrollRef} className="max-h-[38vh] flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 && !thinking && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Your interview transcript will appear here as you speak.
                  </p>
                )}
                {query.trim() && matchIndexes.length === 0 && messages.length > 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No transcript lines match “{query.trim()}”.
                  </p>
                )}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    ref={(el) => { matchRefs.current[i] = el; }}
                    initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={springSmooth}
                    className={cn("flex gap-3", msg.role === "user" && "justify-end")}
                  >
                    {msg.role === "assistant" && (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed transition-shadow",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 text-foreground",
                        activeMessageIndex === i && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {highlight(msg.content, query).map((part, pi) =>
                          part.match ? (
                            <mark
                              key={pi}
                              className="rounded bg-primary/30 px-0.5 text-foreground"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={pi}>{part.text}</span>
                          ),
                        )}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                  </motion.div>
                ))}
                {thinking && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-secondary/60 px-3.5 py-3">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                      <span className="sr-only">Interviewer is thinking</span>
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {partialUser && (
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={springSnappy}
                      className="flex justify-end"
                    >
                      <div className="max-w-[85%] rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm italic text-muted-foreground">
                        {partialUser}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Surface>

            {/* ---------- Control dock ---------- */}
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSmooth, delay: 0.1 }}
              className="elev-4 sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-2xl p-3 backdrop-blur-xl"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={micMuted ? "outline" : "default"}
                    size="icon"
                    onClick={onToggleMic}
                    aria-label={micLabel}
                    aria-pressed={!micMuted}
                    className="min-h-11 min-w-11 shrink-0"
                  >
                    {micMuted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{micLabel}</TooltipContent>
              </Tooltip>

              {realtime && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onInterrupt}
                      disabled={interviewerState !== "speaking"}
                      aria-label="Interrupt the interviewer"
                      className="min-h-11 min-w-11 shrink-0"
                    >
                      <Hand className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump in — interrupt the interviewer</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onToggleVoice}
                    disabled={!voiceAvailable}
                    aria-label={
                      !voiceAvailable
                        ? "Interviewer audio is not included in your plan"
                        : voiceOn
                          ? "Mute interviewer audio"
                          : "Unmute interviewer audio"
                    }
                    aria-pressed={voiceAvailable && voiceOn}
                    className="min-h-11 min-w-11 shrink-0"
                  >
                    {voiceOn && voiceAvailable
                      ? <Volume2 className="h-4 w-4" aria-hidden="true" />
                      : <VolumeX className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!voiceAvailable
                    ? "Voice interviews are a Pro feature — you can keep typing"
                    : voiceRecovering
                      ? "Checking whether interviewer audio is back…"
                      : voiceOn
                        ? "Interviewer audio on"
                        : "Interviewer audio off"}
                </TooltipContent>
              </Tooltip>

              <label htmlFor="interview-answer" className="sr-only">
                Type your answer
              </label>
              <Input
                id="interview-answer"
                placeholder={realtime ? "Just talk — or type to add something" : "Type your answer…"}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                className="h-11 min-w-[8rem] flex-1 border-border bg-secondary/60"
              />
              <Button
                onClick={onSubmit}
                disabled={!input.trim()}
                aria-label="Send answer"
                className="min-h-11 min-w-11 shrink-0"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </motion.div>
          </div>

          {/* ---------- Side rail ---------- */}
          <aside className="flex flex-col gap-4">
            <CameraMonitor active onSnapshot={onSnapshot} />

            {limits && (
              <Surface level={2} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize text-foreground">{limits.tier} plan</p>
                  <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {limits.sessionsRemaining === null
                    ? "Unlimited interviews this month"
                    : `${limits.sessionsRemaining} of ${limits.sessionsPerMonth} interviews left this month`}
                </p>
                <p className="text-xs text-muted-foreground">Up to {limits.maxSessionMinutes} minutes per session</p>
              </Surface>
            )}

            <Surface level={2} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-secondary">
                Session tips
              </p>
              {realtime && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Interrupt any time — just start talking and the interviewer will stop.
                </p>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use STAR: Situation, Task, Action, Result.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Aim for 60–120 seconds per behavioural answer.
              </p>
            </Surface>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
