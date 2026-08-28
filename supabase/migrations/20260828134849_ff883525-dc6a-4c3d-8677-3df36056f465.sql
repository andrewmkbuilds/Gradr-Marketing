ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token text;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token_idx
  ON public.newsletter_subscribers (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;

UPDATE public.newsletter_subscribers
SET unsubscribe_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE unsubscribe_token IS NULL;