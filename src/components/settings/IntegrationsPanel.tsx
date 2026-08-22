import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  Loader2,
  Plug,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIntegrations, type IntegrationId } from "@/hooks/useIntegrations";

function StatusPill({
  configured,
  enabled,
  error,
}: {
  configured: boolean;
  enabled: boolean;
  error?: string | null;
}) {
  if (!configured)
    return (
      <Badge variant="outline" className="border-border/70 text-muted-foreground">
        Not configured
      </Badge>
    );
  if (error)
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        Needs attention
      </Badge>
    );
  if (!enabled)
    return (
      <Badge variant="outline" className="border-border/70 text-muted-foreground">
        Disconnected
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-primary/50 text-primary">
      Connected
    </Badge>
  );
}

export function IntegrationsPanel() {
  const {
    catalog,
    states,
    loading,
    busy,
    permissionDenied,
    rateLimited,
    connect,
    disconnect,
    reconnect,
  } = useIntegrations();

  const run = async (
    id: IntegrationId,
    action: (p: IntegrationId) => Promise<{ error?: string }>,
    label: string,
  ) => {
    const res = await action(id);
    if (res.error) toast.error(res.error);
    else toast.success(label);
  };

  return (
    <section className="elev-2 rounded-xl p-6 space-y-5 animate-fade-in" aria-labelledby="integrations-heading">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 id="integrations-heading" className="text-sm font-medium text-foreground">
            Integrations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect the services that power logos, analytics and reliability across Gradr.
          </p>
        </div>
      </div>

      {permissionDenied && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Permission denied. Your account can't change integration settings — ask a workspace
            admin to grant access, then reconnect.
          </span>
        </div>
      )}

      {rateLimited && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Logo lookups are rate limited right now — cached logos and initials are shown.</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {catalog.map((item) => {
            const state = states[item.id];
            const enabled = state ? state.enabled : item.configured;
            const isBusy = busy === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-secondary/40 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <StatusPill
                        configured={item.configured}
                        enabled={enabled}
                        error={state?.lastError}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {state?.lastSyncedAt
                        ? `Last synced ${formatDistanceToNow(new Date(state.lastSyncedAt), { addSuffix: true })}`
                        : item.configured
                          ? "Never synced"
                          : item.docsHint}
                    </p>
                    {state?.lastError && (
                      <p className="text-[11px] text-destructive mt-1">{state.lastError}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {enabled && item.configured ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 min-h-9"
                          disabled={isBusy || permissionDenied}
                          onClick={() => run(item.id, reconnect, `${item.name} reconnected`)}
                          aria-label={`Reconnect ${item.name}`}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Reconnect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 min-h-9 text-muted-foreground hover:text-destructive"
                          disabled={isBusy || permissionDenied}
                          onClick={() => run(item.id, disconnect, `${item.name} disconnected`)}
                          aria-label={`Disconnect ${item.name}`}
                        >
                          <Unplug className="h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-2 min-h-9"
                        disabled={isBusy || permissionDenied || !item.configured}
                        onClick={() => run(item.id, connect, `${item.name} connected`)}
                        aria-label={`Connect ${item.name}`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default IntegrationsPanel;
