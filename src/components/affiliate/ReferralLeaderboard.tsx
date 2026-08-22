import { Crown, Medal } from "lucide-react";
import { useAffiliateLeaderboard } from "@/hooks/useAffiliate";
import { DEFAULT_TIER_COLOR } from "@/lib/design/yachtClub";

type Row = {
  rank: number;
  alias: string;
  confirmed_referrals: number;
  tier_name: string | null;
  tier_color: string | null;
  is_me: boolean;
};

export function ReferralLeaderboard() {
  const { data, isLoading } = useAffiliateLeaderboard(10);
  const rows = (data as Row[] | undefined) ?? [];

  return (
    <div className="elev-2 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
        <span className="text-[11px] text-muted-foreground ml-auto">Names are masked for privacy</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No ranked affiliates yet — the first referral takes the top spot.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.alias}`}
              className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${
                r.is_me ? "bg-primary/10 border border-primary/30" : "bg-secondary/50"
              }`}
            >
              <span className="w-6 text-xs font-semibold text-muted-foreground tabular-nums">#{r.rank}</span>
              {r.rank <= 3 && <Medal className="h-3.5 w-3.5 text-warning" />}
              <span className={`font-mono ${r.is_me ? "text-primary font-semibold" : "text-foreground"}`}>
                {r.alias}
              </span>
              {r.tier_name && (
                <span
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: `${r.tier_color ?? DEFAULT_TIER_COLOR}22`, color: r.tier_color ?? DEFAULT_TIER_COLOR }} // theme-token-ok
                >
                  {r.tier_name}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {r.confirmed_referrals} referral{r.confirmed_referrals === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
