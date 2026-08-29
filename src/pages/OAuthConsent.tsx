import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/design-system/gradr-9b9b95";
import { AuthLayout } from "@/components/AuthLayout";
import { Shield, CheckCircle2 } from "lucide-react";

// Beta namespace typing shim
type OAuthClient = {
  name?: string;
  client_name?: string;
  logo_uri?: string;
  client_uri?: string;
  redirect_uris?: string[];
};
type OAuthAuthorization = {
  client?: OAuthClient;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
  redirect_uri?: string;
};
type OAuthError = { message?: string } | null;
type OAuthResult = Promise<{ data: OAuthAuthorization | null; error: OAuthError }>;
type OAuthApi = {
  getAuthorizationDetails: (id: string) => OAuthResult;
  approveAuthorization: (id: string) => OAuthResult;
  denyAuthorization: (id: string) => OAuthResult;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization request.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message ?? "Could not load authorization request.");
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load authorization.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        return setError(error.message ?? "Authorization failed.");
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("No redirect returned by the authorization server.");
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Authorization failed.");
    }
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Authorization error</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </AuthLayout>
    );
  }

  if (!details) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an external app";
  const redirectHost = (() => {
    try {
      const uri = details.client?.redirect_uris?.[0] ?? details.redirect_uri;
      return uri ? new URL(uri).host : null;
    } catch {
      return null;
    }
  })();

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Connect {clientName} to Gradr</h2>
            <p className="text-sm text-muted-foreground">This lets {clientName} use Gradr as you.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground">Read your Gradr profile, resumes, job matches, and pipeline</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground">Add jobs to your pipeline on your behalf</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            This does not bypass Gradr's permissions. Row-level security still applies to every request.
          </p>
          {redirectHost && (
            <p className="text-xs text-muted-foreground">Redirects to <span className="font-mono">{redirectHost}</span></p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg" className="flex-1"
            onClick={() => decide(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="lg" className="flex-1"
            onClick={() => decide(true)}
            disabled={busy}
          >
            {busy ? "Working..." : "Approve"}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
