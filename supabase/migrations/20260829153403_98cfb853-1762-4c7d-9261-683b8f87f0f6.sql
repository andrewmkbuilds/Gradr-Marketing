CREATE TABLE IF NOT EXISTS public.email_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  idempotency_key text NOT NULL,
  template_data jsonb,
  message_id uuid,
  failure_reason text,
  error_message text,
  transient boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_dead_letters_status_check CHECK (status IN ('pending','retrying','resolved','abandoned')),
  CONSTRAINT email_dead_letters_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS email_dead_letters_due_idx
  ON public.email_dead_letters (status, next_retry_at);
CREATE INDEX IF NOT EXISTS email_dead_letters_template_idx
  ON public.email_dead_letters (template_name, created_at DESC);

GRANT SELECT ON public.email_dead_letters TO authenticated;
GRANT ALL ON public.email_dead_letters TO service_role;

ALTER TABLE public.email_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read email dead letters" ON public.email_dead_letters;
CREATE POLICY "Admins can read email dead letters"
  ON public.email_dead_letters
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_email_dead_letters()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_dead_letters_touch ON public.email_dead_letters;
CREATE TRIGGER email_dead_letters_touch
  BEFORE UPDATE ON public.email_dead_letters
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_dead_letters();

CREATE OR REPLACE VIEW public.email_delivery_metrics
WITH (security_invoker = true)
AS
SELECT
  date_trunc('hour', created_at) AS bucket,
  template_name,
  count(*) FILTER (WHERE status = 'sent') AS sent_count,
  count(*) FILTER (WHERE status = 'suppressed') AS suppressed_count,
  count(*) FILTER (WHERE status = 'failed') AS failed_count,
  count(*) AS total_count
FROM public.email_send_log
GROUP BY 1, 2;

GRANT SELECT ON public.email_delivery_metrics TO authenticated;
GRANT SELECT ON public.email_delivery_metrics TO service_role;