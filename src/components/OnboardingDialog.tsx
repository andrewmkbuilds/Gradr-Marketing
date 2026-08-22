import { useMemo, useState, useEffect } from "react";
import { track, trackOnce } from "@/lib/telemetry/events";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge, Button, Input, Label, Text } from "@/design-system/gradr-9b9b95";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BadgePercent, ArrowLeft, ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { ONBOARDING_IDENTITIES } from "@/config/eligibility";
import { VerificationDialog } from "@/components/VerificationDialog";
import { motion, AnimatePresence } from "motion/react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { easeOut } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "in", label: "India" },
  { code: "nl", label: "Netherlands" },
];

const ROLE_SUGGESTIONS = [
  "Software Engineer", "Product Manager", "Data Analyst", "Product Designer",
  "Marketing Manager", "Sales Development Rep", "Financial Analyst", "Operations Manager",
];

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Consulting", "Retail & E-commerce",
  "Media & Entertainment", "Education", "Energy", "Public Sector", "Non-profit",
];

const SALARY_STEPS = [30, 50, 70, 90, 120, 150, 200];

export interface OnboardingResult {
  what: string;
  where: string;
  country: string;
  remoteOnly: boolean;
  salaryMin: number | null;
}

interface Props {
  open: boolean;
  onComplete: (prefs: OnboardingResult) => void;
}

const STEPS = ["Target roles", "Industries", "Compensation & location"];

export function OnboardingDialog({ open, onComplete }: Props) {
  const { user } = useAuth();
  const reduced = useReducedMotionPref();
  const [step, setStep] = useState(0);

  // Funnel step: the dialog only mounts open for users who have not onboarded.
  useEffect(() => {
    if (open) trackOnce("onboarding_started", {}, "dialog");
  }, [open]);

  const [roles, setRoles] = useState<string[]>([]);
  const [roleDraft, setRoleDraft] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("us");
  const [remote, setRemote] = useState<"any" | "remote" | "onsite">("any");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [experience, setExperience] = useState<"entry" | "mid" | "senior" | "lead">("mid");
  const [identity, setIdentity] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const eligibleIdentity = ONBOARDING_IDENTITIES.find((i) => i.value === identity && i.eligibilityType);

  const addRole = (value: string) => {
    const v = value.trim();
    if (!v || roles.length >= 5 || roles.some((r) => r.toLowerCase() === v.toLowerCase())) return;
    setRoles((prev) => [...prev, v]);
    setRoleDraft("");
  };

  const canAdvance = useMemo(() => {
    if (step === 0) return roles.length > 0;
    return true;
  }, [step, roles]);

  const submit = async () => {
    if (!user || roles.length === 0) return;
    setSaving(true);
    const min = salaryMin ? parseInt(salaryMin, 10) : null;
    const max = salaryMax ? parseInt(salaryMax, 10) : null;

    await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        target_role: roles[0],
        target_roles: roles,
        industries,
        locations: location.trim() ? [location.trim()] : [],
        country,
        remote_preference: remote,
        salary_min: min,
        salary_max: max,
        experience_level: experience,
        onboarded: true,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    // Rebuild the 3-day plan against the new targets so the daily actions the
    // user lands on already reflect the roles, industries and salary they chose.
    void supabase.functions.invoke("career-plan", { body: {} }).catch(() => undefined);

    setSaving(false);

    track("onboarding_completed", {
      target_role_count: roles.length,
      industry_count: industries.length,
      experience_level: experience,
      has_location: Boolean(location.trim()),
      has_salary_target: Boolean(min || max),
      identity: identity || undefined,
    });
    track("career_preferences_completed", { experience_level: experience });


    onComplete({
      what: roles[0],
      where: location.trim(),
      country,
      remoteOnly: remote === "remote",
      salaryMin: min,
    });
    if (eligibleIdentity) setVerifyOpen(true);
  };

  const enter = reduced ? {} : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 } };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Let's tailor your job search
          </DialogTitle>
          <DialogDescription>
            Three quick steps. We re-rank your matches and rebuild your daily actions the moment you're done.
          </DialogDescription>
        </DialogHeader>

        {/* Step rail */}
        <ol className="flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-secondary")}
                aria-hidden="true"
              />
              <Text
                variant="caption"
                as="span"
                className={cn("block", i === step ? "text-foreground" : "text-muted-foreground")}
              >
                {s}
              </Text>
            </li>
          ))}
        </ol>

        <div className="min-h-[280px] py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              {...enter}
              transition={reduced ? { duration: 0 } : { duration: 0.25, ease: easeOut }}
              className="grid gap-4"
            >
              {step === 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Target roles * <span className="text-muted-foreground">(up to 5)</span></Label>
                    <Input
                      id="role"
                      placeholder="e.g. Senior Product Designer — press Enter"
                      value={roleDraft}
                      onChange={(e) => setRoleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRole(roleDraft);
                        }
                      }}
                    />
                    {roles.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {roles.map((r, i) => (
                          <li key={r}>
                            <Badge variant={i === 0 ? "primary" : "neutral"} className="gap-1.5">
                              {i === 0 && <Text variant="overline" as="span">primary</Text>}
                              {r}
                              <button
                                type="button"
                                aria-label={`Remove ${r}`}
                                onClick={() => setRoles((prev) => prev.filter((x) => x !== r))}
                                className="rounded-full p-0.5 hover:bg-foreground/10"
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <Text variant="caption" className="mb-2">Popular targets</Text>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_SUGGESTIONS.filter((r) => !roles.includes(r)).slice(0, 6).map((r) => (
                        <Button key={r} type="button" variant="outline" size="sm" onClick={() => addRole(r)}>
                          + {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Experience level</Label>
                    <Select value={experience} onValueChange={(v: typeof experience) => setExperience(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry level</SelectItem>
                        <SelectItem value="mid">Mid-level</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="lead">Lead / Principal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <Label>Industries you want to work in</Label>
                    <Text variant="caption" className="mt-1">
                      We boost matches in these sectors. Skip if you're open to anything.
                    </Text>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INDUSTRIES.map((ind) => {
                        const on = industries.includes(ind);
                        return (
                          <Button
                            key={ind}
                            type="button"
                            variant={on ? "primary" : "outline"}
                            size="sm"
                            aria-pressed={on}
                            onClick={() =>
                              setIndustries((prev) => (on ? prev.filter((x) => x !== ind) : [...prev, ind]))
                            }
                          >
                            {ind}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>What best describes you?</Label>
                    <Select value={identity} onValueChange={setIdentity}>
                      <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                      <SelectContent>
                        {ONBOARDING_IDENTITIES.map((i) => (
                          <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {eligibleIdentity && (
                      <Text variant="caption" tone="primary" className="flex items-center gap-1.5">
                        <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                        You may qualify for a verified discount — we'll offer it after setup.
                      </Text>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="grid gap-2">
                    <Label>Target salary range (annual)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        aria-label="Minimum salary"
                        type="number"
                        inputMode="numeric"
                        placeholder="Min e.g. 90000"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                      />
                      <Input
                        aria-label="Maximum salary"
                        type="number"
                        inputMode="numeric"
                        placeholder="Max e.g. 130000"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SALARY_STEPS.map((k) => (
                        <Button
                          key={k}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSalaryMin(String(k * 1000))}
                        >
                          {k}k+
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="loc">Preferred location</Label>
                      <Input id="loc" placeholder="City or region" value={location} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Country</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Remote preference</Label>
                    <Select value={remote} onValueChange={(v: typeof remote) => setRemote(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Open to any</SelectItem>
                        <SelectItem value="remote">Remote only</SelectItem>
                        <SelectItem value="onsite">On-site only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={roles.length === 0 || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save & re-rank matches
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <VerificationDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        defaultType={eligibleIdentity?.eligibilityType ?? null}
      />
    </Dialog>
  );
}
