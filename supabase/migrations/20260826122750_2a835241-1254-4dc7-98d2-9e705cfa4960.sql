CREATE UNIQUE INDEX IF NOT EXISTS newsletter_followups_subscriber_step_key
  ON public.newsletter_followups (subscriber_id, template_name);

CREATE INDEX IF NOT EXISTS newsletter_followups_due_idx
  ON public.newsletter_followups (scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS email_engagement_events_client_hash_idx
  ON public.email_engagement_events (client_hash);

CREATE INDEX IF NOT EXISTS email_engagement_events_message_idx
  ON public.email_engagement_events (message_id, event_type);

CREATE INDEX IF NOT EXISTS email_engagement_events_created_idx
  ON public.email_engagement_events (created_at DESC);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_created_idx
  ON public.newsletter_subscribers (status, created_at DESC);