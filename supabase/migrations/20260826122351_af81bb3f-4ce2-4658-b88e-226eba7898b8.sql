CREATE TABLE public.newsletter_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','sent','skipped','canceled','failed')),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX newsletter_followups_unique_step
  ON public.newsletter_followups (subscriber_id, template_name);
CREATE INDEX newsletter_followups_due_idx
  ON public.newsletter_followups (status, scheduled_at);

GRANT ALL ON public.newsletter_followups TO service_role;
GRANT SELECT ON public.newsletter_followups TO authenticated;

ALTER TABLE public.newsletter_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read newsletter followups"
ON public.newsletter_followups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER newsletter_followups_updated_at
BEFORE UPDATE ON public.newsletter_followups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  template_name text,
  recipient_email text,
  event_type text NOT NULL CHECK (event_type IN ('open','click')),
  target_url text,
  client_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_engagement_message_idx ON public.email_engagement_events (message_id);
CREATE INDEX email_engagement_template_idx
  ON public.email_engagement_events (template_name, created_at DESC);
CREATE INDEX email_engagement_created_idx ON public.email_engagement_events (created_at DESC);

GRANT ALL ON public.email_engagement_events TO service_role;
GRANT SELECT ON public.email_engagement_events TO authenticated;

ALTER TABLE public.email_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email engagement"
ON public.email_engagement_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));