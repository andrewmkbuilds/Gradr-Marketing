import { useAffiliateSettings } from "@/hooks/useAffiliate";
import { BookOpen, FileText, ShieldCheck } from "lucide-react";
import { Card, Text } from "@/design-system/gradr-9b9b95";

export default function AffiliateResources() {
  const { data: settings } = useAffiliateSettings();
  const rate = settings?.default_commission_rate ?? 20;
  const cookieDays = settings?.cookie_duration_days ?? 90;
  const threshold = settings?.minimum_payout_threshold ?? 50;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Text variant="h2" as="h1">Affiliate Resources</Text>
        <Text variant="body-sm" tone="muted" className="mt-1">Everything you need to promote Gradr.</Text>
      </div>

      <Card variant="raised" padding="lg">
        <Text variant="h6" as="h2" className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Commission rules</Text>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Default rate: <span className="text-foreground">{rate}{settings?.default_commission_type === "percentage" ? "%" : "$"}</span> per qualifying conversion.</li>
          <li>Attribution window: <span className="text-foreground">{cookieDays} days</span>, last-touch.</li>
          <li>Commissions enter "pending" on creation and move to "approved" after the refund window passes.</li>
          <li>Refunded or chargebacked sales are automatically reversed.</li>
        </ul>
      </Card>

      <Card variant="raised" padding="lg">
        <Text variant="h6" as="h2" className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Payout terms</Text>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          Payouts are reviewed and sent by the Gradr team once your approved commissions clear the minimum threshold. You'll get a notification when a payout is marked as paid.
        </p>
        <Text variant="body-sm" className="mt-2">Minimum payout: ${Number(threshold).toFixed(2)}</Text>
      </Card>

      <Card variant="raised" padding="lg">
        <Text variant="h6" as="h2" className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Referral rules</Text>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>No self-referrals.</li>
          <li>No paid search on "Gradr", or related branded keywords.</li>
          <li>No spam, misleading claims, or coupon-site stuffing.</li>
          <li>No incentivized fake signups.</li>
        </ul>
      </Card>

      <Card variant="raised" padding="lg">
        <Text variant="h6" as="h2" className="mb-3">Full affiliate terms</Text>
        <Text variant="body-sm" tone="muted" className="whitespace-pre-line">{settings?.affiliate_terms}</Text>
      </Card>
    </div>
  );
}
