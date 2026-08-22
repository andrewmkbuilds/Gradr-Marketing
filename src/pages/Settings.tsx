import { ThemeSegmentedControl } from "@/components/ThemeToggle";
import { MotionSegmentedControl } from "@/components/MotionToggle";
import { useState, useEffect } from "react";
import { Palette, User, Save, Loader2, Bell, Send } from "lucide-react";
import { Button, Card, FormField, Input, Text } from "@/design-system/gradr-9b9b95";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { IntegrationsPanel } from "@/components/settings/IntegrationsPanel";
import { LegalLinksPanel } from "@/components/legal/LegalLinksPanel";
import { AccountDataPanel } from "@/components/settings/AccountDataPanel";
import { EligibilityPanel } from "@/components/settings/EligibilityPanel";
import { UsageBars } from "@/components/UsageBars";
import { logPreferencesRead } from "@/lib/preferencesAudit";



export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [careerStage, setCareerStage] = useState("");
  const [skills, setSkills] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestSendTime, setDigestSendTime] = useState("08:00");
  const [digestTimezone, setDigestTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
  const [testingDigest, setTestingDigest] = useState(false);
  const [lastDigestStatus, setLastDigestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || "");
      setTargetJobTitle(data.target_job_title || "");
      setTargetSalary(data.target_salary || "");
      setTargetIndustry(data.target_industry || "");
      setCareerStage(data.career_stage || "");
      setSkills(data.skills?.join(", ") || "");
    }

    const { data: prefs } = await (supabase as any)
      .from("user_preferences")
      .select("digest_enabled, digest_send_time, digest_timezone")
      .eq("user_id", user!.id)
      .maybeSingle();

    void logPreferencesRead("settings", Boolean(prefs));

    if (prefs) {
      setDigestEnabled(prefs.digest_enabled ?? true);
      setDigestSendTime(String(prefs.digest_send_time || "08:00").slice(0, 5));
      setDigestTimezone(prefs.digest_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
    }

    const { data: lastLog } = await (supabase as any)
      .from("digest_send_logs")
      .select("status, sent_at, jobs_count, reminders_count, error_message")
      .eq("user_id", user!.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLog) {
      setLastDigestStatus(`${lastLog.status} · ${lastLog.jobs_count} jobs · ${lastLog.reminders_count} reminders`);
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        display_name: displayName || null,
        target_job_title: targetJobTitle || null,
        target_salary: targetSalary || null,
        target_industry: targetIndustry || null,
        career_stage: careerStage || null,
        skills: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : null,
      }, { onConflict: "user_id" });

    const { error: prefError } = await (supabase as any)
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        digest_enabled: digestEnabled,
        digest_send_time: digestSendTime,
        digest_timezone: digestTimezone || "America/New_York",
      }, { onConflict: "user_id" });

    if (error || prefError) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
    }
    setSaving(false);
  };

  const sendTestDigest = async () => {
    if (!user) return;
    setTestingDigest(true);
    const { data, error } = await supabase.functions.invoke("daily-digest", { body: { test: true } });
    setTestingDigest(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to prepare test digest");
      setLastDigestStatus("failed");
      return;
    }
    const status = `${data.status} · ${data.jobsCount} jobs · ${data.remindersCount} reminders`;
    setLastDigestStatus(status);
    toast.success("Test digest prepared");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="type-h1 text-foreground tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Set your career preferences to improve AI recommendations</p>
      </div>

      <section aria-labelledby="appearance-heading" className="elev-2 rounded-xl p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 id="appearance-heading" className="text-h3 text-foreground">Appearance</h2>
            <p className="text-xs text-muted-foreground">Choose your theme. System follows your device setting.</p>
          </div>
        </div>
        <ThemeSegmentedControl />

        <div className="border-t border-border pt-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground">Motion</h3>
          <p className="text-xs text-muted-foreground">
            Reduce animation, parallax and background effects across Gradr. System follows your device
            accessibility setting.
          </p>
          <MotionSegmentedControl />
        </div>
      </section>

      <div className="elev-2 rounded-xl p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Account email</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="bg-secondary border-border" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Job Title</label>
            <Input value={targetJobTitle} onChange={(e) => setTargetJobTitle(e.target.value)} placeholder="e.g., Senior Frontend Engineer" className="bg-secondary border-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Salary</label>
              <Input value={targetSalary} onChange={(e) => setTargetSalary(e.target.value)} placeholder="e.g., $150k-$200k" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Industry</label>
              <Input value={targetIndustry} onChange={(e) => setTargetIndustry(e.target.value)} placeholder="e.g., Fintech, SaaS" className="bg-secondary border-border" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Career Stage</label>
            <Input value={careerStage} onChange={(e) => setCareerStage(e.target.value)} placeholder="e.g., mid-career, senior, entry-level" className="bg-secondary border-border" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Skills (comma-separated)</label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g., React, TypeScript, Node.js, AWS" className="bg-secondary border-border" />
          </div>
        </div>

        <Button onClick={saveProfile} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Profile
        </Button>
      </div>

      <div className="elev-2 rounded-xl p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Daily Email Digest</p>
            <p className="text-xs text-muted-foreground">High-match jobs and overdue follow-ups</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Enable daily digest</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Prepared at your preferred local time.</span>
            </span>
            <input type="checkbox" checked={digestEnabled} onChange={(e) => setDigestEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="digest-send-time" className="text-xs font-medium text-muted-foreground mb-1.5 block">Preferred Send Time</label>
              <Input id="digest-send-time" type="time" value={digestSendTime} onChange={(e) => setDigestSendTime(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label htmlFor="digest-timezone" className="text-xs font-medium text-muted-foreground mb-1.5 block">Timezone</label>
              <Input id="digest-timezone" value={digestTimezone} onChange={(e) => setDigestTimezone(e.target.value)} placeholder="America/New_York" className="bg-secondary border-border" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Last sent status</p>
              <p className="text-xs text-muted-foreground mt-0.5">{lastDigestStatus || "No digest prepared yet"}</p>
            </div>
            <Button onClick={sendTestDigest} disabled={testingDigest} variant="outline" className="gap-2">
              {testingDigest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send test email
            </Button>
          </div>
        </div>
      </div>

      <UsageBars />

      <IntegrationsPanel />

      <EligibilityPanel />

      <AccountDataPanel />

      <LegalLinksPanel />
    </div>
  );
}

