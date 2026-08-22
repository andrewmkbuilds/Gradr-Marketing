import { useState } from "react";
import { Badge, Button, Card, Text } from "@/design-system/gradr-9b9b95";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgePercent, Plus, ShieldCheck } from "lucide-react";
import { VerificationDialog } from "@/components/VerificationDialog";
import { eligibilityIcon, STATUS_COPY, type VerificationStatus } from "@/config/eligibility";
import { useMyEligibility } from "@/hooks/useEligibility";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : null;

/** Settings panel: current eligibility status and how to add or renew one. */
export function EligibilityPanel() {
  const { verifications, discountPercent, isLoading } = useMyEligibility();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preselect, setPreselect] = useState<string | null>(null);

  const openFor = (type: string | null) => {
    setPreselect(type);
    setDialogOpen(true);
  };

  return (
    <Card
      id="eligibility"
      role="region"
      variant="raised"
      padding="lg"
      aria-labelledby="eligibility-heading"
      className="space-y-5 animate-fade-in scroll-mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center">
            <BadgePercent className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <Text variant="h5" as="h2" id="eligibility-heading">
              Eligibility &amp; discounts
            </Text>
            <Text variant="caption">
              {discountPercent > 0
                ? `${discountPercent}% off is applied automatically at checkout.`
                : "Students, educators, military, healthcare and nonprofit teams save on every plan."}
            </Text>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => openFor(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add verification
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : verifications.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <Text variant="body-sm" className="mt-2 font-medium">No verifications yet</Text>
          <Text variant="caption" className="mt-1">
            Verify once and your discount applies to every future renewal.
          </Text>
          <Button size="sm" className="mt-4" onClick={() => openFor(null)}>
            Check if you qualify
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {verifications.map((v) => {
            const Icon = eligibilityIcon(v.eligibility_type);
            const copy = STATUS_COPY[v.status as VerificationStatus] ?? STATUS_COPY.pending;
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-muted p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Text variant="body-sm" as="span" className="font-medium">{v.label}</Text>
                    <Badge variant={copy.badgeVariant}>
                      {copy.label}
                    </Badge>
                  </span>
                  <Text variant="caption" as="span" className="mt-0.5 block">
                    {v.status === "verified" && v.expires_at
                      ? `${copy.hint} Valid until ${formatDate(v.expires_at)}.`
                      : (v.failure_reason ?? copy.hint)}
                  </Text>
                </span>
                {(v.status === "expired" || v.status === "failed" || v.status === "revoked") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFor(v.eligibility_type)}
                  >
                    Re-verify
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <VerificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={preselect}
      />
    </Card>
  );
}
