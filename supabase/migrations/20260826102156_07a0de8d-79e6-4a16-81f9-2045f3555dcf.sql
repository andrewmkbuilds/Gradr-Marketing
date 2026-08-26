CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  topic text,
  source text NOT NULL DEFAULT 'landing',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  confirm_token_hash text,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers (lower(email));
CREATE INDEX newsletter_subscribers_token_idx ON public.newsletter_subscribers (confirm_token_hash);
CREATE INDEX newsletter_subscribers_ip_idx ON public.newsletter_subscribers (ip_hash, created_at DESC);

GRANT ALL ON public.newsletter_subscribers TO service_role;
GRANT SELECT ON public.newsletter_subscribers TO authenticated;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read newsletter subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER newsletter_subscribers_updated_at
BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();