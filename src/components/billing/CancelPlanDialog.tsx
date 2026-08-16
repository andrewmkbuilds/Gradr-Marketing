import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the provider portal where the cancellation is actually completed. */
  onContinueToCancel: () => void;
  onOfferAccepted?: () => void;
}

/**
 * Win-back step shown before a cancellation. The offer is resolved and applied
 * server-side — the browser only asks for "the retention offer", it never
 * chooses a percentage.
 */
export function CancelPlanDialog({ open, onOpenChange, onContinueToCancel, onOfferAccepted }: Props) {
  const [applying, setApplying] = useState(false);

  const acceptOffer = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("payments-retention-offer", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error || !data?.ok) {
        if (data?.error === "already_redeemed") {
          toast.info("You've already used this offer.", {
            description: "You can still manage or cancel your plan in the billing portal.",
          });
        } else {
          toast.error("Couldn't apply the offer right now. Please try again.");
        }
        return;
      }
      toast.success(`Offer applied — ${data.percentage}% off for your next ${data.months} months.`, {
        description: "It takes effect on your next renewal. Nothing else changes.",
      });
      onOfferAccepted?.();
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Before you go — 30% off for 3 months
          </DialogTitle>
          <DialogDescription>
            Job searches take time. Keep your resume history, tracked applications and interview
            coaching at a lower rate while you finish yours.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Applies automatically from your next renewal.</li>
          <li>• Cancel any time — nothing is locked in.</li>
          <li>• Your data stays exactly as it is either way.</li>
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onContinueToCancel();
            }}
          >
            No thanks, cancel my plan
          </Button>
          <Button onClick={() => void acceptOffer()} disabled={applying} className="gap-2">
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            Keep my plan at 30% off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CancelPlanDialog;
