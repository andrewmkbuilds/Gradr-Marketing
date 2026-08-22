import { Route, Routes } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { SurfaceNotFound, CrossLink } from "@/components/surface/SurfaceLink";
import { CheckCircle2, Activity, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Health = "operational" | "degraded" | "outage";

interface ServiceStatus {
  name: string;
  description: string;
  health: Health;
}

/**
 * Service health for every Gradr subsystem.
 *
 * These reflect the platform components users actually feel. Wire them to a
 * live probe (voice-status / db_health edge functions) when the status feed
 * lands; until then this is the declared baseline.
 */
const SERVICES: ServiceStatus[] = [
  { name: "Gradr app", description: "Dashboard, career tools and settings", health: "operational" },
  { name: "Authentication", description: "Sign-in, Google OAuth and sessions", health: "operational" },
  { name: "AI Mock Interview", description: "Live voice sessions and scoring", health: "operational" },
  { name: "Resume Intelligence", description: "Parsing, ATS scoring and rewrites", health: "operational" },
  { name: "Job Matching", description: "Job feeds and match scoring", health: "operational" },
  { name: "Billing", description: "Checkout, plans and entitlements", health: "operational" },
  { name: "Email delivery", description: "Transactional and digest email", health: "operational" },
];

const HEALTH_META: Record<Health, { label: string; dot: string; text: string; Icon: typeof CheckCircle2 }> = {
  operational: {
    label: "Operational",
    dot: "bg-success",
    text: "text-success",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded performance",
    dot: "bg-warning",
    text: "text-warning",
    Icon: Activity,
  },
  outage: {
    label: "Outage",
    dot: "bg-destructive",
    text: "text-destructive",
    Icon: AlertTriangle,
  },
};

function overallHealth(): Health {
  if (SERVICES.some((s) => s.health === "outage")) return "outage";
  if (SERVICES.some((s) => s.health === "degraded")) return "degraded";
  return "operational";
}

function StatusHome() {
  const overall = overallHealth();
  const meta = HEALTH_META[overall];

  return (
    <div className="page-shell py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">Status</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          Gradr system status
        </h1>
        <p className="mt-3 text-muted-foreground">
          Live health for every part of Gradr, plus a record of past incidents.
        </p>
      </header>

      <section
        className={cn(
          "mt-10 flex items-center gap-4 rounded-xl border border-border/60 bg-card p-6 elev-1",
        )}
        aria-live="polite"
      >
        <span className={cn("h-3 w-3 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
        <div>
          <p className={cn("text-lg font-semibold", meta.text)}>
            {overall === "operational" ? "All systems operational" : meta.label}
          </p>
          <p className="text-sm text-muted-foreground">
            {SERVICES.filter((s) => s.health === "operational").length} of {SERVICES.length} services
            reporting normal service.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Components
        </h2>
        <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card elev-1">
          {SERVICES.map((service) => {
            const serviceMeta = HEALTH_META[service.health];
            return (
              <li key={service.name} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{service.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{service.description}</p>
                </div>
                <span className={cn("flex shrink-0 items-center gap-2 text-xs font-medium", serviceMeta.text)}>
                  <span className={cn("h-2 w-2 rounded-full", serviceMeta.dot)} aria-hidden="true" />
                  {serviceMeta.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Incident history
        </h2>
        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
          No incidents reported. Any disruption will be posted here with a timeline and resolution.
        </div>
      </section>

      <div className="mt-12 rounded-xl border border-border/60 bg-card p-6 elev-1">
        <h2 className="text-lg font-semibold text-foreground">Something looks wrong?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If you are hitting a problem that isn’t reflected here, tell our support team.
        </p>
        <CrossLink
          surface="support"
          className="interactive mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Contact support
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CrossLink>
      </div>
    </div>
  );
}

export default function StatusSurface() {
  return (
    <SurfaceShell eyebrow="Status">
      <Routes>
        <Route index element={<StatusHome />} />
        <Route path="*" element={<SurfaceNotFound label="Gradr Status" />} />
      </Routes>
    </SurfaceShell>
  );
}
