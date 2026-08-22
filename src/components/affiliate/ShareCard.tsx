import { useState } from "react";
import { Copy, Check, Share2, Twitter, Linkedin, Mail, MessageCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { yachtClub } from "@/lib/design/yachtClub";

const SHARE_COPY =
  "I use Gradr to run my whole job search — AI resume scoring, job matching and realistic mock interviews. Try it with my link:";

export function ShareCard({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const copy = async (value: string, what: "link" | "code") => {
    await navigator.clipboard.writeText(value);
    setCopied(what);
    toast.success(what === "link" ? "Referral link copied" : "Referral code copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const encoded = encodeURIComponent(link);
  const text = encodeURIComponent(SHARE_COPY);

  const socials = [
    { label: "X", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${text}&url=${encoded}` },
    { label: "LinkedIn", icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` },
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${text}%20${encoded}` },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("You should try Gradr")}&body=${text}%20${encoded}`,
    },
  ];

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Gradr", text: SHARE_COPY, url: link });
      } catch {
        /* user dismissed */
      }
    } else {
      copy(link, "link");
    }
  };

  /** Renders a shareable referral card as a PNG, entirely client-side. */
  const downloadCard = async () => {
    const w = 1200;
    const h = 630;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, yachtClub.deepSea);
    grad.addColorStop(1, yachtClub.harbour);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(115, 62, 36, 0.22)"; // theme-token-ok
    ctx.beginPath();
    ctx.arc(w - 140, 120, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = yachtClub.softWhite;
    ctx.font = "bold 64px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Gradr", 80, 140);

    ctx.font = "500 44px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillStyle = yachtClub.coolGray;
    ctx.fillText("Your AI career command center", 80, 220);

    ctx.font = "bold 92px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillStyle = yachtClub.seaGlass;
    ctx.fillText(code, 80, 380);

    ctx.font = "400 34px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillStyle = yachtClub.stone;
    ctx.fillText("Use my referral code to get started", 80, 440);
    ctx.fillText(link, 80, 520);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradr-referral-${code}.png`;
    a.click();
    toast.success("Referral card downloaded");
  };

  return (
    <div className="elev-2 rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Invite friends</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Share your link anywhere. You earn on every paid upgrade it drives.
          </p>
        </div>
        <button
          onClick={nativeShare}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition active:scale-[0.98]"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-border bg-secondary/40 p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral link</div>
          <div className="text-sm font-mono text-foreground truncate mt-1">{link}</div>
        </div>
        <button
          onClick={() => copy(link, "link")}
          className="inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-border bg-secondary/40 text-sm hover:bg-secondary transition active:scale-[0.98]"
        >
          {copied === "link" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral code</div>
          <div className="text-lg font-mono font-bold tracking-widest text-primary mt-1">{code}</div>
        </div>
        <button
          onClick={() => copy(code, "code")}
          className="inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-border bg-secondary/40 text-sm hover:bg-secondary transition active:scale-[0.98]"
        >
          {copied === "code" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-secondary transition"
          >
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </a>
        ))}
        <button
          onClick={downloadCard}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-secondary transition"
        >
          <Download className="h-3.5 w-3.5" /> Referral card
        </button>
      </div>
    </div>
  );
}
