import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { telemetryStatus } from "@/lib/telemetry/journey";
import { trackJourney } from "@/lib/telemetry/journey";
import { clearLogoCache, logoDevEnabled, isRateLimited } from "@/lib/logos";

export type IntegrationId =
  | "logo_dev"
  | "posthog"
  | "sentry"
  | "firecrawl"
  | "google_search_console";

export type IntegrationState = {
  provider: IntegrationId;
  enabled: boolean;
  status: "connected" | "disconnected" | "error" | "not_configured";
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type IntegrationMeta = {
  id: IntegrationId;
  name: string;
  description: string;
  /** Whether the workspace-level credential is present. */
  configured: boolean;
  /** Requires an admin/workspace owner to link the connector. */
  requiresWorkspaceLink: boolean;
  docsHint: string;
};

export function integrationCatalog(): IntegrationMeta[] {
  const t = telemetryStatus();
  return [
    {
      id: "logo_dev",
      name: "Logo.dev",
      description: "Company logos for jobs, pipeline and research, cached locally.",
      configured: logoDevEnabled(),
      requiresWorkspaceLink: true,
      docsHint: "Link the Logo.dev connector to enable branded company logos.",
    },
    {
      id: "posthog",
      name: "PostHog",
      description: "Product analytics for your career journey funnel. No sensitive data is sent.",
      configured: t.posthog,
      requiresWorkspaceLink: true,
      docsHint: "Link the PostHog connector to start capturing journey events.",
    },
    {
      id: "sentry",
      name: "Sentry",
      description: "Error and performance monitoring with release tracking.",
      configured: t.sentry,
      requiresWorkspaceLink: true,
      docsHint: "Add a Sentry DSN to receive actionable error reports.",
    },
    {
      id: "firecrawl",
      name: "Firecrawl",
      description: "Job URL import and company research extraction.",
      configured: true,
      requiresWorkspaceLink: true,
      docsHint: "Used by job URL import and the research studio.",
    },
    {
      id: "google_search_console",
      name: "Google Search Console",
      description: "Indexing health and search performance for your public pages.",
      configured: true,
      requiresWorkspaceLink: true,
      docsHint: "Admin only — powers the Search Console dashboard.",
    },
  ];
}

const table = () => supabase.from("user_integrations");

export function useIntegrations() {
  const { user } = useAuth();
  const [states, setStates] = useState<Record<string, IntegrationState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<IntegrationId | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await table()
      .select("provider, enabled, status, last_synced_at, last_error")
      .eq("user_id", user.id);

    if (error) {
      setPermissionDenied(error.code === "42501" || /permission/i.test(error.message));
      setLoading(false);
      return;
    }
    setPermissionDenied(false);
    const next: Record<string, IntegrationState> = {};
    for (const row of data || []) {
      const provider = row.provider as IntegrationId;
      next[provider] = {
        provider,
        enabled: row.enabled,
        status: row.status as IntegrationState["status"],
        lastSyncedAt: row.last_synced_at,
        lastError: row.last_error,
      };
    }
    setStates(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const write = useCallback(
    async (
      provider: IntegrationId,
      patch: { enabled?: boolean; status?: string; last_error?: string | null; touchSync?: boolean },
    ) => {
      if (!user) return { error: "Sign in required" };
      setBusy(provider);
      const row = {
        user_id: user.id,
        provider,
        enabled: patch.enabled ?? true,
        status: patch.status ?? "connected",
        last_error: patch.last_error ?? null,
        ...(patch.touchSync ? { last_synced_at: new Date().toISOString() } : {}),
      };
      const { error } = await table().upsert(row, { onConflict: "user_id,provider" });
      setBusy(null);
      if (error) {
        const denied = error.code === "42501" || /permission|policy/i.test(error.message);
        setPermissionDenied(denied);
        return { error: denied ? "Permission denied for this integration." : error.message };
      }
      await load();
      return {};
    },
    [user, load],
  );

  const connect = useCallback(
    async (provider: IntegrationId) => {
      const res = await write(provider, { enabled: true, status: "connected", touchSync: true });
      if (!res.error) trackJourney("integration_connected", { provider });
      return res;
    },
    [write],
  );

  const disconnect = useCallback(
    async (provider: IntegrationId) => {
      const res = await write(provider, { enabled: false, status: "disconnected" });
      if (!res.error) {
        if (provider === "logo_dev") clearLogoCache();
        trackJourney("integration_disconnected", { provider });
      }
      return res;
    },
    [write],
  );

  const reconnect = useCallback(
    async (provider: IntegrationId) => {
      if (provider === "logo_dev") clearLogoCache();
      return write(provider, { enabled: true, status: "connected", last_error: null, touchSync: true });
    },
    [write],
  );

  return {
    catalog: integrationCatalog(),
    states,
    loading,
    busy,
    permissionDenied,
    rateLimited: isRateLimited(),
    connect,
    disconnect,
    reconnect,
    refresh: load,
  };
}
