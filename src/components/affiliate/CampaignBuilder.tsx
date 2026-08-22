import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Save, Trash2, Link2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button, Card, Input, Label, Text, Textarea } from "@/design-system/gradr-9b9b95";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  affiliateProfileId: string;
  affiliateCode: string;
}

type FormState = {
  name: string;
  landing_path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  landing_path: "/",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  notes: "",
};

function buildLink(code: string, s: Partial<FormState>) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const path = s.landing_path?.startsWith("/") ? s.landing_path : `/${s.landing_path || ""}`;
  const url = new URL(origin + (path || "/"));
  url.searchParams.set("ref", code);
  if (s.utm_source) url.searchParams.set("utm_source", s.utm_source);
  if (s.utm_medium) url.searchParams.set("utm_medium", s.utm_medium);
  if (s.utm_campaign) url.searchParams.set("utm_campaign", s.utm_campaign);
  if (s.utm_content) url.searchParams.set("utm_content", s.utm_content);
  if (s.utm_term) url.searchParams.set("utm_term", s.utm_term);
  return url.toString();
}

export function CampaignBuilder({ affiliateProfileId, affiliateCode }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);

  const preview = useMemo(() => buildLink(affiliateCode, form), [affiliateCode, form]);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["affiliateCampaigns", affiliateProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_campaigns")
        .select("*")
        .eq("affiliate_profile_id", affiliateProfileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Give your campaign a name");
      const payload = {
        affiliate_profile_id: affiliateProfileId,
        name: form.name.trim(),
        landing_path: form.landing_path || "/",
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || null,
        utm_content: form.utm_content || null,
        utm_term: form.utm_term || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("affiliate_campaigns").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign saved");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["affiliateCampaigns", affiliateProfileId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("affiliate_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["affiliateCampaigns", affiliateProfileId] });
    },
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));


  return (
    <div className="space-y-6">
      <Card variant="raised" padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <Text variant="h6" as="h3">Campaign link builder</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Campaign name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="Twitter launch" />
          </div>
          <div>
            <Label className="mb-1.5 block">Landing path</Label>
            <Input value={form.landing_path} onChange={set("landing_path")} placeholder="/pricing" />
          </div>
          <div>
            <Label className="mb-1.5 block">utm_source</Label>
            <Input value={form.utm_source} onChange={set("utm_source")} placeholder="twitter" />
          </div>
          <div>
            <Label className="mb-1.5 block">utm_medium</Label>
            <Input value={form.utm_medium} onChange={set("utm_medium")} placeholder="social" />
          </div>
          <div>
            <Label className="mb-1.5 block">utm_campaign</Label>
            <Input value={form.utm_campaign} onChange={set("utm_campaign")} placeholder="spring-launch" />
          </div>
          <div>
            <Label className="mb-1.5 block">utm_content</Label>
            <Input value={form.utm_content} onChange={set("utm_content")} placeholder="hero-cta" />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block">utm_term (optional)</Label>
            <Input value={form.utm_term} onChange={set("utm_term")} placeholder="career+os" />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block">Notes (private)</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 flex items-center gap-2 flex-wrap">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <code className="text-xs text-foreground break-all flex-1 min-w-0">{preview}</code>
          <Button variant="outline" size="sm" onClick={() => copy(preview)}>
            <Copy className="h-3 w-3" aria-hidden /> Copy
          </Button>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
          Save campaign
        </Button>
      </Card>

      <Card variant="raised" padding="lg">
        <Text variant="h6" as="h3" className="mb-3">Saved campaigns</Text>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : !campaigns || campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No saved campaigns yet — build one above and hit save.
          </p>
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c) => {
              const url = buildLink(affiliateCode, {
                landing_path: c.landing_path,
                utm_source: c.utm_source ?? "",
                utm_medium: c.utm_medium ?? "",
                utm_campaign: c.utm_campaign ?? "",
                utm_content: c.utm_content ?? "",
                utm_term: c.utm_term ?? "",
              });
              return (
                <li key={c.id} className="p-3 rounded-lg bg-secondary/40 border border-border">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[c.utm_source, c.utm_medium, c.utm_campaign].filter(Boolean).join(" · ") || "no UTMs"} ·
                        {" "}created {format(new Date(c.created_at), "MMM d")}
                      </div>
                      <code className="text-[11px] text-muted-foreground break-all block mt-1">{url}</code>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => copy(url)} aria-label="Copy campaign link">
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(c.id)} aria-label="Delete campaign" className="hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
