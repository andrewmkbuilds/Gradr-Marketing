import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyAffiliate } from "@/hooks/useAffiliate";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormField, Input, Text, Textarea } from "@/design-system/gradr-9b9b95";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  brand_name: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().max(500).optional().or(z.literal("")),
  twitter: z.string().trim().max(200).optional().or(z.literal("")),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
  youtube: z.string().trim().max(200).optional().or(z.literal("")),
  audience_type: z.string().trim().min(2).max(120),
  audience_size: z.string().trim().min(1).max(60),
  promotion_plan: z.string().trim().min(20).max(2000),
  why_join: z.string().trim().min(20).max(2000),
  payout_email: z.string().trim().email().max(255),
  payout_method: z.string().trim().max(60),
  agreed_to_terms: z.boolean().refine((v) => v === true, "You must agree to the terms"),
});

export default function AffiliateApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: my, isLoading } = useMyAffiliate();
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (my?.profile?.status === "active") {
    navigate("/affiliate/resources", { replace: true });
    return null;
  }
  if (!user) {
    return (
      <Card variant="raised" padding="lg" className="mx-auto max-w-2xl text-center">
        <Text variant="h5" as="h1" className="mb-2">Sign in to apply</Text>
        <Text variant="body-sm" tone="muted" className="mb-6">
          Applications are tied to a Gradr account so we can track referrals and pay you out.
        </Text>
        <Button onClick={() => navigate("/affiliate/login?next=%2Faffiliate%2Fjoin")}>
          Sign in to continue
        </Button>
      </Card>
    );
  }
  if (my?.application?.status === "pending") {
    return (
      <Card variant="raised" padding="lg" className="mx-auto max-w-2xl text-center">
        <Text variant="h5" as="h1" className="mb-2">Application under review</Text>
        <Text variant="body-sm" tone="muted">We typically review within 48 hours. We'll notify you once a decision is made.</Text>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to submit your application");
      navigate("/affiliate/login?next=%2Faffiliate%2Fjoin");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse({ ...raw, agreed_to_terms: fd.get("agreed_to_terms") === "on" });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }
    setSubmitting(true);
    const v = parsed.data;
    const { error } = await supabase.from("affiliate_applications").insert({
      user_id: user.id,
      full_name: v.full_name,
      email: v.email,
      brand_name: v.brand_name || null,
      website: v.website || null,
      social_links: { twitter: v.twitter, linkedin: v.linkedin, youtube: v.youtube },
      audience_type: v.audience_type,
      audience_size: v.audience_size,
      promotion_plan: v.promotion_plan,
      why_join: v.why_join,
      payout_details: { email: v.payout_email, method: v.payout_method },
      agreed_to_terms: true,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application submitted!");
    qc.invalidateQueries({ queryKey: ["myAffiliate"] });
    navigate("/affiliate");
  };

  const selectCls =
    "h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Text variant="h2" as="h1">Affiliate Application</Text>
        <Text variant="body-sm" tone="muted" className="mt-1">Tell us about you and your audience.</Text>
      </div>

      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Full name *">
            {(control) => <Input {...control} name="full_name" required defaultValue={user?.user_metadata?.full_name || ""} />}
          </FormField>
          <FormField label="Contact email *">
            {(control) => <Input {...control} name="email" type="email" required defaultValue={user?.email || ""} />}
          </FormField>
          <FormField label="Brand / company">{(control) => <Input {...control} name="brand_name" />}</FormField>
          <FormField label="Website">{(control) => <Input {...control} name="website" placeholder="https://" />}</FormField>
          <FormField label="Twitter / X">
            {(control) => <Input {...control} name="twitter" placeholder="@handle or url" />}
          </FormField>
          <FormField label="LinkedIn">{(control) => <Input {...control} name="linkedin" />}</FormField>
          <FormField label="YouTube / TikTok">{(control) => <Input {...control} name="youtube" />}</FormField>
          <FormField label="Audience type *">
            {(control) => <Input {...control} name="audience_type" required placeholder="e.g. career coach, student creator" />}
          </FormField>
          <FormField label="Audience size *">
            {(control) => <Input {...control} name="audience_size" required placeholder="e.g. 12k newsletter, 50k YT" />}
          </FormField>
          <FormField label="Payout email *">
            {(control) => <Input {...control} name="payout_email" type="email" required defaultValue={user?.email || ""} />}
          </FormField>
          <FormField label="Payout method *">
            {(control) => (
              <select {...control} name="payout_method" defaultValue="paypal" className={selectCls}>
                <option value="paypal">PayPal</option>
                <option value="wise">Wise</option>
                <option value="bank">Bank transfer</option>
              </select>
            )}
          </FormField>
        </div>
        <FormField label="How will you promote Gradr? *">
          {(control) => (
            <Textarea {...control} name="promotion_plan" required rows={4} placeholder="Newsletter feature, YouTube review, course bonus, etc." />
          )}
        </FormField>
        <FormField label="Why do you want to join? *">
          {(control) => <Textarea {...control} name="why_join" required rows={3} />}
        </FormField>

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="agreed_to_terms" required className="mt-1" />
          <span>I agree to the Gradr affiliate terms, including no self-referrals, no brand-keyword paid search, and commission reversal on refunds.</span>
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          Submit application
        </Button>
        </form>
      </Card>
    </div>
  );
}
