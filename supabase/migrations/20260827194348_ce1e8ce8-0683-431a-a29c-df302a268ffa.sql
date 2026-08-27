-- 1. voice_provider_config: exclude anonymous (guest) sessions
drop policy if exists "Admins read voice config" on public.voice_provider_config;
create policy "Admins read voice config"
on public.voice_provider_config
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and has_role(auth.uid(), 'admin'::app_role)
);

-- 2. discount_settings: admin-only reads (internal business config)
drop policy if exists "Signed-in users read discount settings" on public.discount_settings;
create policy "Admins read discount settings"
on public.discount_settings
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Realtime-published billing tables: harden owner-scoped SELECT policies
drop policy if exists "own subscription readable" on public.subscribers;
create policy "own subscription readable"
on public.subscribers
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and ((user_id = auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
);

drop policy if exists "own purchases readable" on public.purchases;
create policy "own purchases readable"
on public.purchases
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and ((user_id = auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
);

drop policy if exists "Users read own feature usage" on public.feature_usage;
create policy "Users read own feature usage"
on public.feature_usage
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and ((user_id = auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
);

-- 4. Revoke authenticated EXECUTE on SECURITY DEFINER functions the client no
--    longer calls directly (affiliate surfaces go through service-role edge functions).
revoke execute on function public.affiliate_leaderboard(integer) from authenticated;
revoke execute on function public.my_affiliate_overview() from authenticated;
revoke execute on function public.get_affiliate_public_settings() from authenticated;
revoke execute on function public.entitlement_snapshot(text) from authenticated;