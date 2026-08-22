import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDestructive } from "@/components/admin/ConfirmDestructive";

type Tier = {
  id: string;
  key: string;
  name: string;
  min_referrals: number;
  bonus_rate: number;
  color: string;
  perks: string | null;
  sort_order: number;
  active: boolean;
};

/** Tier ladder configuration — drives affiliate levels and bonus commission rates. */
export function AffiliateTiersPanel() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["adminAffiliateTiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_tiers")
        .select("*")
        .order("min_referrals", { ascending: true });
      if (error) throw error;
      return (data || []) as Tier[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["adminAffiliateTiers"] });
    qc.invalidateQueries({ queryKey: ["affiliateTiers"] });
  };

  const patch = async (id: string, values: Partial<Tier>) => {
    const { error } = await supabase.from("affiliate_tiers").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tier updated");
    refresh();
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCreating(true);
    const { error } = await supabase.from("affiliate_tiers").insert({
      key: String(fd.get("key")).trim().toLowerCase(),
      name: String(fd.get("name")).trim(),
      min_referrals: Number(fd.get("min_referrals")),
      bonus_rate: Number(fd.get("bonus_rate")),
      color: String(fd.get("color")),
      perks: String(fd.get("perks")) || null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    e.currentTarget.reset();
    toast.success("Tier created");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("affiliate_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tier removed");
    refresh();
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Levels are fully configurable. Affiliates are placed in the highest tier whose referral
        threshold they have reached, and the bonus rate is added to their percentage commission.
      </p>

      <div className="elev-2 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Key</th><th>Name</th><th>Min referrals</th><th>Bonus %</th>
              <th>Colour</th><th>Perks</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((t) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="p-3 font-mono text-xs text-muted-foreground">{t.key}</td>
                <td>
                  <input defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && patch(t.id, { name: e.target.value })}
                    className="w-28 px-2 py-1 rounded bg-secondary border border-border text-xs" />
                </td>
                <td>
                  <input type="number" min={0} defaultValue={t.min_referrals}
                    onBlur={(e) => Number(e.target.value) !== t.min_referrals && patch(t.id, { min_referrals: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded bg-secondary border border-border text-xs" />
                </td>
                <td>
                  <input type="number" min={0} step="0.5" defaultValue={t.bonus_rate}
                    onBlur={(e) => Number(e.target.value) !== Number(t.bonus_rate) && patch(t.id, { bonus_rate: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded bg-secondary border border-border text-xs" />
                </td>
                <td>
                  <input type="color" defaultValue={t.color} onBlur={(e) => e.target.value !== t.color && patch(t.id, { color: e.target.value })}
                    className="h-7 w-10 rounded bg-secondary border border-border" aria-label={`${t.name} colour`} />
                </td>
                <td>
                  <input defaultValue={t.perks ?? ""} onBlur={(e) => e.target.value !== (t.perks ?? "") && patch(t.id, { perks: e.target.value })}
                    className="w-56 px-2 py-1 rounded bg-secondary border border-border text-xs" />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={t.active} onChange={(e) => patch(t.id, { active: e.target.checked })}
                    aria-label={`${t.name} active`} />
                </td>
                <td className="p-3">
                  <ConfirmDestructive
                    title={`Delete the ${t.name} tier?`}
                    description={<>Affiliates currently on this level drop to the next lowest tier. Commission history is unaffected.</>}
                    confirmLabel="Delete tier"
                    typeToConfirm="DELETE"
                    onConfirm={async () => { await remove(t.id); }}
                  >
                    <span role="button" tabIndex={0} className="text-destructive cursor-pointer inline-flex">
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </ConfirmDestructive>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="elev-2 rounded-xl p-4 grid gap-3 sm:grid-cols-6 items-end">
        <label className="text-xs text-muted-foreground sm:col-span-1">
          Key
          <input name="key" required placeholder="legend" className="mt-1 w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm" />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-1">
          Name
          <input name="name" required placeholder="Legend" className="mt-1 w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm" />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-1">
          Min referrals
          <input name="min_referrals" type="number" min={0} defaultValue={50} className="mt-1 w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm" />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-1">
          Bonus %
          <input name="bonus_rate" type="number" min={0} step="0.5" defaultValue={0} className="mt-1 w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm" />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-1">
          Colour
          <input name="color" type="color" defaultValue="#245f73" className="mt-1 h-9 w-full rounded bg-secondary border border-border" /> {/* theme-token-ok */}
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-5">
          Perks
          <input name="perks" placeholder="What this level unlocks" className="mt-1 w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm" />
        </label>
        <button disabled={creating} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add tier
        </button>
      </form>
    </div>
  );
}
