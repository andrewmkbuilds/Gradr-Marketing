import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { currentPaymentsEnvironment } from "@/lib/paymentsConfig";
import { reportApiFailure } from "@/lib/monitoring/reliability";
import type { VerificationStatus } from "@/config/eligibility";

export interface EligibilityCategory {
  key: string;
  label: string;
  description: string | null;
  default_discount_percent: number;
  requires_verification: boolean;
  self_serve: boolean;
  verification_validity_days: number;
  sort_order: number;
}

export interface MyVerification {
  id: string;
  eligibility_type: string;
  label: string;
  status: VerificationStatus;
  provider: string;
  verified_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  discount_percent: number;
}

export interface EligibilityState {
  verifications: MyVerification[];
  best_discount: { percentage: number };
}

const EMPTY_STATE: EligibilityState = { verifications: [], best_discount: { percentage: 0 } };

/** Catalog of what someone can verify. Public — used on pricing too. */
export function useEligibilityCategories() {
  return useQuery({
    queryKey: ["eligibility-categories"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EligibilityCategory[]> => {
      const { data, error } = await supabase
        .from("eligibility_categories")
        .select(
          "key, label, description, default_discount_percent, requires_verification, self_serve, verification_validity_days, sort_order",
        )
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as EligibilityCategory[];
    },
  });
}

/**
 * Live, advertised discount programs. Row-level security only exposes rules
 * that are active, advertised and inside their campaign window, so this is
 * safe to render for signed-out visitors.
 */
export function useDiscountPrograms() {
  return useQuery({
    queryKey: ["discount-programs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_rules")
        .select("id, name, percentage, eligibility_type, kind, ends_at")
        .order("percentage", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The signed-in user's verifications plus their best available discount. */
export function useMyEligibility() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-eligibility", user?.id],
    enabled: Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<EligibilityState> => {
      const { data, error } = await supabase.rpc("my_eligibility_state");
      if (error) {
        // Denials here silently strip a user's discount, so record the exact
        // Postgres error alongside who hit it before rethrowing.
        reportApiFailure("rpc:my_eligibility_state", error, {
          code: error.code || undefined,
          message: error.message,
          context: {
            userId: user?.id ?? null,
            pgCode: error.code ?? null,
            details: error.details ?? null,
            hint: error.hint ?? null,
            authenticated: Boolean(user),
          },
        });
        throw error;
      }
      const raw = (data ?? {}) as Partial<EligibilityState>;
      return {
        verifications: (raw.verifications ?? []) as MyVerification[],
        best_discount: raw.best_discount ?? { percentage: 0 },
      };
    },
  });

  const state = query.data ?? EMPTY_STATE;
  return {
    ...query,
    verifications: state.verifications,
    discountPercent: Number(state.best_discount?.percentage ?? 0),
    statusFor: (type: string) => state.verifications.find((v) => v.eligibility_type === type),
  };
}




export interface ResolvedDiscount {
  percentage: number;
  discountId?: string | null;
  ruleName?: string | null;
  eligibilityType?: string | null;
}

/**
 * Server-resolved discount for a specific plan, including the provider
 * discount id used at checkout. Called on demand — never to render prices.
 */
export async function resolveCheckoutDiscount(
  plan: string,
  interval: string,
): Promise<ResolvedDiscount> {
  const { data, error } = await supabase.functions.invoke("resolve-discount", {
    body: { plan, interval, environment: currentPaymentsEnvironment() },
  });
  if (error || !data) return { percentage: 0 };
  return data as ResolvedDiscount;
}
