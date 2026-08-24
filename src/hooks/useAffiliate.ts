import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMyAffiliate() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["myAffiliate", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const [appRes, profRes] = await Promise.all([
        supabase
          .from("affiliate_applications")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("affiliate_profiles")
          .select("*")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      return {
        application: appRes.data,
        profile: profRes.data,
      };
    },
  });
}

/** Public marketing settings (safe for anyone) — internal config stays admin-only. */
export function useAffiliateSettings() {
  return useQuery({
    queryKey: ["affiliateSettings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_affiliate_public_settings");
      return Array.isArray(data) ? data[0] ?? null : data;
    },
  });
}
