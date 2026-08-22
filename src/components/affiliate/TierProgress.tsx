import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Trophy, Sparkles, Flame, Lock, Check } from "lucide-react";
import type { AffiliateOverview } from "@/hooks/useAffiliate";
import { DEFAULT_TIER_COLOR } from "@/lib/design/yachtClub";
import { safeStorage } from "@/lib/safeStorage";

type Tier = {
  id: string;
  key: string;
  name: string;
  min_referrals: number;
  bonus_rate: number;
  color: string;
  perks: string | null;
};

/** Lightweight, dependency-free celebration burst (respects reduced motion). */
function Celebration({ active }: { active: boolean }) {
  const reduce = useReducedMotionPref();
  if (!active || reduce) return null;
  const pieces = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
      {pieces.map((_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: "50%", y: "60%", scale: 0.6 }}
          animate={{
            opacity: 0,
            x: `${50 + (Math.random() * 120 - 60)}%`,
            y: `${20 + Math.random() * 60}%`,
            scale: 1,
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 1.2 + Math.random() * 0.6, ease: "easeOut" }}
          className="absolute h-1.5 w-1.5 rounded-sm"
          style={{ background: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--success))" : "hsl(var(--warning))" }}
        />
      ))}
    </div>
  );
}

export function TierProgress({
  overview,
  tiers,
}: {
  overview: AffiliateOverview;
  tiers: Tier[];
}) {
  const confirmed = overview.stats?.confirmed ?? 0;
  const streak = overview.stats?.streak_weeks ?? 0;
  const current = overview.tier ?? null;
  const next = overview.next_tier ?? null;

  const progress = useMemo(() => {
    if (!next) return 100;
    const floor = current?.min_referrals ?? 0;
    const span = Math.max(next.min_referrals - floor, 1);
    return Math.min(100, Math.round(((confirmed - floor) / span) * 100));
  }, [confirmed, current, next]);

  // Celebrate only when the tier actually changes for this user, once per tier.
  const [celebrate, setCelebrate] = useState(false);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const key = current?.key ?? null;
    if (!key) return;
    const storageKey = "gradr.affiliate.tier";
    const stored = safeStorage.get(storageKey);
    if (stored && stored !== key && seen.current !== key) {
      seen.current = key;
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2200);
      safeStorage.set(storageKey, key);
      return () => clearTimeout(t);
    }
    safeStorage.set(storageKey, key);
  }, [current?.key]);

  return (
    <div className="relative elev-2 rounded-xl p-6 overflow-hidden">
      <Celebration active={celebrate} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: `${current?.color ?? DEFAULT_TIER_COLOR}22`, color: current?.color ?? DEFAULT_TIER_COLOR }} // theme-token-ok
          >
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Your level</div>
            <div className="text-lg font-bold text-foreground">
              {current?.name ?? "Getting started"}
              {current?.bonus_rate ? (
                <span className="ml-2 text-xs font-medium text-success">+{current.bonus_rate}% bonus</span>
              ) : null}
            </div>
          </div>
        </div>

        {streak > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
            <Flame className="h-3.5 w-3.5" /> {streak} week referral streak
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{confirmed} confirmed referral{confirmed === 1 ? "" : "s"}</span>
          <span>
            {next ? `${next.remaining ?? 0} to ${next.name}` : "Top level reached"}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${current?.color ?? DEFAULT_TIER_COLOR}, hsl(var(--primary)))` }} // theme-token-ok
          />
        </div>
      </div>

      {/* Tier ladder — configured by admins, never hardcoded. */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiers.map((t) => {
          const unlocked = confirmed >= t.min_referrals;
          return (
            <div
              key={t.id}
              className={`rounded-xl border p-3 transition ${
                unlocked ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/40 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{t.name}</span>
                {unlocked ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{t.min_referrals}+ referrals</div>
              {t.perks && <div className="text-[11px] text-muted-foreground mt-2 leading-snug">{t.perks}</div>}
            </div>
          );
        })}
      </div>

      {next?.perks && (
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <span>
            Unlock <strong className="text-foreground">{next.name}</strong>: {next.perks}
          </span>
        </div>
      )}
    </div>
  );
}

/** Milestone badges derived from real referral + earnings data. */
export function MilestoneBadges({ overview }: { overview: AffiliateOverview }) {
  const confirmed = overview.stats?.confirmed ?? 0;
  const clicks = overview.stats?.clicks ?? 0;
  const lifetime = overview.earnings?.lifetime ?? 0;
  const streak = overview.stats?.streak_weeks ?? 0;

  const badges = [
    { label: "First click", done: clicks >= 1, hint: "Someone opened your link" },
    { label: "First referral", done: confirmed >= 1, hint: "1 confirmed signup" },
    { label: "High five", done: confirmed >= 5, hint: "5 confirmed referrals" },
    { label: "First $100", done: lifetime >= 100, hint: "$100 lifetime earnings" },
    { label: "On fire", done: streak >= 3, hint: "3 week streak" },
    { label: "Century club", done: clicks >= 100, hint: "100 link clicks" },
  ];

  return (
    <div className="elev-2 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Achievements</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((b) => (
          <div
            key={b.label}
            className={`rounded-xl p-3 text-center border ${
              b.done ? "border-success/40 bg-success/5" : "border-dashed border-border bg-secondary/30"
            }`}
            title={b.hint}
          >
            <div className={`text-sm font-semibold ${b.done ? "text-foreground" : "text-muted-foreground"}`}>
              {b.label}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{b.done ? "Unlocked" : b.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
