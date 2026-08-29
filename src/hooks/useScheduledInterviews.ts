import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackJourney } from "@/lib/telemetry/journey";

export interface ScheduledInterview {
  id: string;
  title: string;
  kind: string;
  target_role: string | null;
  company: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  source: string;
  html_link: string | null;
  status: string;
}

export interface CalendarEventPreview {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  htmlLink: string | null;
  looksLikeInterview: boolean;
}

/**
 * Upcoming interviews (mock + real), backed by `scheduled_interviews` and
 * optionally synced from Google Calendar.
 */
export function useScheduledInterviews() {
  const [items, setItems] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scheduled_interviews")
      .select("*")
      .gte("starts_at", new Date(Date.now() - 3 * 3_600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(25);
    setItems((data as ScheduledInterview[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const callCalendar = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setCalendarError(null);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-sync", { body });
      if (error) {
        let detail = error.message;
        try {
          const parsed = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
            ?.context?.json?.();
          detail = parsed?.error ?? detail;
        } catch {
          /* body unavailable */
        }
        setCalendarError(detail);
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }, []);

  const listCalendar = useCallback(
    async (days = 30): Promise<CalendarEventPreview[]> => {
      const data = await callCalendar({ action: "list", days });
      return (data?.events as CalendarEventPreview[]) ?? [];
    },
    [callCalendar],
  );

  const importCalendar = useCallback(
    async (importAll = false) => {
      const data = await callCalendar({ action: "import", days: 30, importAll });
      if (data?.ok) {
        trackJourney("calendar_imported", { imported: data.imported ?? 0, import_all: importAll });
        await load();
      }
      return data?.imported ?? 0;
    },
    [callCalendar, load],
  );

  /** Schedules a mock interview locally, and on Google Calendar when connected. */
  const scheduleMock = useCallback(
    async (input: { title: string; startsAt: string; durationMin: number; targetRole?: string }) => {
      const calendarInput: Record<string, unknown> = {
        action: "create",
        title: input.title,
        startsAt: input.startsAt,
        durationMin: input.durationMin,
      };
      if (input.targetRole) calendarInput.targetRole = input.targetRole;
      const viaCalendar = await callCalendar(calendarInput);

      if (!viaCalendar?.ok) {
        // Calendar not connected or the create failed — keep the local schedule.
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return false;
        const { error } = await supabase.from("scheduled_interviews").insert({
          user_id: auth.user.id,
          title: input.title,
          kind: "mock",
          target_role: input.targetRole ?? null,
          starts_at: new Date(input.startsAt).toISOString(),
          ends_at: new Date(Date.parse(input.startsAt) + input.durationMin * 60_000).toISOString(),
          source: "manual",
        });
        if (error) return false;
      }

      trackJourney("interview_scheduled", {
        synced_to_calendar: Boolean(viaCalendar?.ok),
        duration_min: input.durationMin,
      });

      // Best-effort confirmation email; never blocks scheduling.
      void supabase.functions.invoke("send-notification", {
        body: {
          template: "interview_scheduled",
          input: {
            title: input.title,
            ...(input.targetRole ? { role: input.targetRole } : {}),
            whenLabel: new Date(input.startsAt).toLocaleString(),
            link: "/interview",
          },
          idempotencyKey: `sched:${input.startsAt}:${input.title}`.slice(0, 200),
        },
      });

      await load();
      return true;
    },
    [callCalendar, load],
  );

  const cancel = useCallback(
    async (id: string) => {
      await supabase.from("scheduled_interviews").update({ status: "canceled" }).eq("id", id);
      await load();
    },
    [load],
  );

  return { items, loading, busy, calendarError, load, listCalendar, importCalendar, scheduleMock, cancel };
}
