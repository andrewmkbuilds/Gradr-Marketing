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
import { Badge, Button, Card, Text } from "@/design-system/gradr-9b9b95";
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
      <Badge variant="outline">Not configured</Badge>
    );
  if (error)
    return (
      <Badge variant="danger">Needs attention</Badge>
    );
  if (!enabled)
    return (
      <Badge variant="outline">Disconnected</Badge>
    );
  return (
    <Badge variant="primary">Connected</Badge>
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
    <Card variant="raised" padding="lg" role="region" className="space-y-5 animate-fade-in" aria-labelledby="integrations-heading">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <Text variant="h5" as="h2" id="integrations-heading">Integrations</Text>
          <Text variant="caption" className="mt-0.5">
            Connect the services that power logos, analytics and reliability across Gradr.
          </Text>
        </div>
      </div>

      {permissionDenied && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-control border border-destructive/40 bg-destructive/10 p-3 text-caption text-destructive"
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
          className="flex items-start gap-2 rounded-control border border-border bg-surface-muted p-3 text-caption text-muted-foreground"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Logo lookups are rate limited right now — cached logos and initials are shown.</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-control bg-surface-muted animate-pulse" />
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
                className="rounded-control border border-border bg-surface-muted p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Text variant="body-sm" className="font-medium">{item.name}</Text>
                      <StatusPill
                        configured={item.configured}
                        enabled={enabled}
                        error={state?.lastError}
                      />
                    </div>
                    <Text variant="caption" className="mt-1">{item.description}</Text>
                    <Text variant="caption" className="mt-1">
                      {state?.lastSyncedAt
                        ? `Last synced ${formatDistanceToNow(new Date(state.lastSyncedAt), { addSuffix: true })}`
                        : item.configured
                          ? "Never synced"
                          : item.docsHint}
                    </Text>
                    {state?.lastError && (
                      <Text variant="caption" tone="destructive" className="mt-1">{state.lastError}</Text>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {enabled && item.configured ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-9"
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
                          className="min-h-9"
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
                        className="min-h-9"
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
    </Card>
  );
}

export default IntegrationsPanel;
