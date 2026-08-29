CREATE TABLE IF NOT EXISTS public.internal_job_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.internal_job_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_job_secrets TO service_role;

ALTER TABLE public.internal_job_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_job_secrets (name, secret)
VALUES ('email_dead_letter_retry', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;