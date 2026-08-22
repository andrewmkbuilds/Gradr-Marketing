import { useState } from "react";
import { Download, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Button, Card, Input, Text } from "@/design-system/gradr-9b9b95";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/** Tables exported in the personal data archive. */
const EXPORT_TABLES = [
  "profiles",
  "user_preferences",
  "resumes",
  "job_matches",
  "tracked_jobs",
  "job_reminders",
  "interview_sessions",
  "notifications",
  "purchases",
  "subscribers",
  "usage_credits",
  "feature_usage",
  "user_integrations",
] as const;

export function AccountDataPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const archive: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at },
      };

      for (const table of EXPORT_TABLES) {
        const { data, error } = await (supabase as any).from(table).select("*").eq("user_id", user.id);
        archive[table] = error ? { error: error.message } : data ?? [];
      }

      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradr-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch {
      toast.error("Couldn't build your export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (confirm !== "DELETE") {
      toast.error("Type DELETE to confirm.");
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: "DELETE" },
      });
      if (error) throw error;
      if (!(data as { deleted?: boolean })?.deleted) throw new Error("not deleted");
      await supabase.auth.signOut();
      toast.success("Your account and data have been permanently deleted.");
      navigate("/", { replace: true });
    } catch {
      toast.error("Couldn't delete your account. Please try again or contact support.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card variant="raised" padding="lg" role="region" className="space-y-6" aria-label="Your data">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-primary" />
        </div>
        <div>
          <Text variant="h5" as="h2">Your data</Text>
          <Text variant="caption">Export everything, or permanently close your account</Text>
        </div>
      </div>

      <div className="rounded-control border border-border bg-surface-muted p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Text variant="body-sm" className="font-medium">Export my data</Text>
          <Text variant="caption" className="mt-0.5">
            Profile, resumes, matches, applications, interviews and billing history as JSON.
          </Text>
        </div>
        <Button onClick={exportData} disabled={exporting} variant="outline" className="shrink-0">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download export
        </Button>
      </div>

      <div className="rounded-control border border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div>
          <Text variant="body-sm" className="font-medium">Delete my account</Text>
          <Text variant="caption" className="mt-0.5">
            This permanently removes your account, files and every record above. It cannot be undone — export first if
            you want a copy.
          </Text>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm account deletion"
            className="sm:max-w-xs"
          />
          <Button
            onClick={deleteAccount}
            disabled={deleting || confirm !== "DELETE"}
            variant="destructive"
            className="shrink-0"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete account
          </Button>
        </div>
      </div>
    </Card>
  );
}
