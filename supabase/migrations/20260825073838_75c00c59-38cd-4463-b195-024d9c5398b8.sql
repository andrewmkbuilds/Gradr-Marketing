REVOKE EXECUTE ON FUNCTION public.affiliate_leaderboard(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_checkout_attempt(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.affiliate_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_checkout_attempt(text, text) TO authenticated;