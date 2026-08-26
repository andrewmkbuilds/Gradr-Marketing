-- 1. Pin search_path on the remaining mutable functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;

-- 2. Revoke direct EXECUTE from client roles on internal helpers.
--    These are only used by triggers, edge functions (service role) or
--    server-side code paths, never called directly from the browser.
REVOKE EXECUTE ON FUNCTION public.log_admin_access_denied(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_checkout_attempt(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_not_anonymous() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_grants_access(text, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redact_oauth_url(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redact_oauth_flow_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;

-- 3. voice_provider_events: exclude anonymous (guest) sessions
DROP POLICY IF EXISTS "Users read own voice events" ON public.voice_provider_events;
CREATE POLICY "Users read own voice events"
ON public.voice_provider_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

DROP POLICY IF EXISTS "Admins read all voice events" ON public.voice_provider_events;
CREATE POLICY "Admins read all voice events"
ON public.voice_provider_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);