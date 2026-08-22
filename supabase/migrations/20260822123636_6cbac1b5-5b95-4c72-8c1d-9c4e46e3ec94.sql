CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_id text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_attempts_user_time_idx ON public.checkout_attempts (user_id, created_at DESC);

GRANT SELECT ON public.checkout_attempts TO authenticated;
GRANT ALL ON public.checkout_attempts TO service_role;
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own checkout attempts" ON public.checkout_attempts;
CREATE POLICY "own checkout attempts" ON public.checkout_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read checkout attempts" ON public.checkout_attempts;
CREATE POLICY "admins read checkout attempts" ON public.checkout_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.checkout_abuse_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_id text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  attempts integer NOT NULL,
  window_seconds integer NOT NULL,
  subscription_id text,
  subscription_tier text,
  subscription_status text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_abuse_alerts_time_idx ON public.checkout_abuse_alerts (created_at DESC);

GRANT SELECT ON public.checkout_abuse_alerts TO authenticated;
GRANT ALL ON public.checkout_abuse_alerts TO service_role;
ALTER TABLE public.checkout_abuse_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read checkout alerts" ON public.checkout_abuse_alerts;
CREATE POLICY "admins read checkout alerts" ON public.checkout_abuse_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_checkout_attempt(_price_id text, _environment text DEFAULT 'sandbox')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _window constant integer := 600;
  _threshold constant integer := 3;
  _count integer;
  _alerted boolean := false;
  _sub record;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('attempts', 0, 'alerted', false);
  END IF;
  IF _price_id IS NULL OR length(_price_id) > 64 THEN
    RAISE EXCEPTION 'invalid price id';
  END IF;

  INSERT INTO public.checkout_attempts (user_id, price_id, environment)
  VALUES (_uid, _price_id, COALESCE(NULLIF(_environment, ''), 'sandbox'));

  SELECT count(*) INTO _count
  FROM public.checkout_attempts
  WHERE user_id = _uid AND created_at > now() - make_interval(secs => _window);

  IF _count >= _threshold AND NOT EXISTS (
    SELECT 1 FROM public.checkout_abuse_alerts
    WHERE user_id = _uid AND created_at > now() - make_interval(secs => _window)
  ) THEN
    SELECT subscription_tier, subscription_status, paddle_subscription_id
      INTO _sub
      FROM public.subscribers
     WHERE user_id = _uid
     LIMIT 1;

    INSERT INTO public.checkout_abuse_alerts (
      user_id, price_id, environment, attempts, window_seconds,
      subscription_id, subscription_tier, subscription_status
    ) VALUES (
      _uid, _price_id, COALESCE(NULLIF(_environment, ''), 'sandbox'), _count, _window,
      _sub.paddle_subscription_id, _sub.subscription_tier, _sub.subscription_status
    );
    _alerted := true;
  END IF;

  RETURN jsonb_build_object('attempts', _count, 'alerted', _alerted, 'windowSeconds', _window);
END;
$$;

REVOKE ALL ON FUNCTION public.record_checkout_attempt(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_checkout_attempt(text, text) TO authenticated, service_role;