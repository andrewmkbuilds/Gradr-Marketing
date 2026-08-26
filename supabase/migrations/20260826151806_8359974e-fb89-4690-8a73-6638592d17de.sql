-- Anonymous visitors no longer execute any SECURITY DEFINER function directly.
-- The affiliate landing pages read settings through the `affiliate-public-settings`
-- edge function, and referral codes are validated inside `affiliate-track-click`.
-- Both run as service_role, so nothing about the affiliate program is reachable
-- from an unauthenticated database session.
REVOKE EXECUTE ON FUNCTION public.get_affiliate_public_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_affiliate_by_code(text) FROM anon;

-- Belt and braces: PUBLIC must never hold EXECUTE on these either.
REVOKE EXECUTE ON FUNCTION public.get_affiliate_public_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_affiliate_by_code(text) FROM PUBLIC;