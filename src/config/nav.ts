import {
  Image as ImageIcon,
  BadgePercent,
  LayoutDashboard,
  FileText,
  Briefcase,
  Target,
  KanbanSquare,
  Zap,
  Mic,
  History,
  Rocket,
  TrendingUp,
  Sparkles,
  BookOpen,
  CreditCard,
  Settings,
  User,
  Gift,
  Mail,
  ScrollText,
  Search,
  ShieldCheck,
  BarChart3,
  Wallet,
  Activity,
  Gauge,
  Globe,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import type { Surface } from "@/config/domains";

export type NavItem = {
  title: string;
  /** In-surface route path, or the path on `surface` when that is set. */
  url: string;
  icon: LucideIcon;
  /** match nested routes as active */
  matchPrefix?: boolean;
  /**
   * Renders the item as a cross-surface link (docs, news, affiliate portal…).
   * The href is resolved with `urlFor()` so it stays on the current origin in
   * dev/preview and points at the real subdomain in production.
   */
  surface?: Surface;
};

export type NavGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** where clicking the group header itself goes (also used in collapsed rail) */
  url: string;
  items: NavItem[];
  adminOnly?: boolean;
};

/** Single top-level link (no children) */
export const dashboardItem: NavItem = {
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard,
};

export const navGroups: NavGroup[] = [
  {
    id: "career",
    title: "Career",
    icon: Briefcase,
    url: "/resume",
    items: [
      { title: "Resume Intelligence", url: "/resume", icon: FileText },
      { title: "Job Feed", url: "/jobs", icon: Briefcase },
      { title: "AI Match", url: "/match", icon: Target },
      { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
      { title: "Application Engine", url: "/apply", icon: Zap },
    ],
  },
  {
    id: "interview",
    title: "Interview",
    icon: Mic,
    url: "/interview",
    items: [
      { title: "Interview Coach", url: "/interview", icon: Mic },
      { title: "History & Reports", url: "/interview/history", icon: History, matchPrefix: true },
    ],
  },
  {
    id: "growth",
    title: "Growth",
    icon: Rocket,
    url: "/growth",
    items: [
      { title: "Growth & Proof", url: "/growth", icon: Rocket },
      { title: "Skill gaps", url: "/growth#skill-gaps", icon: TrendingUp },
      { title: "Proof tools", url: "/growth#proof", icon: Sparkles },
      { title: "Career strategy", url: "/career-advice", icon: BookOpen, matchPrefix: true },
    ],
  },
  {
    id: "account",
    title: "Account",
    icon: User,
    url: "/settings",
    items: [
      { title: "Profile & Settings", url: "/settings", icon: Settings },
      { title: "Billing & Subscription", url: "/billing", icon: CreditCard },
      { title: "Credits", url: "/credits", icon: Wallet },
      { title: "Pricing & Plans", url: "/pricing", icon: Sparkles },
    ],
  },
  {
    id: "more",
    title: "More",
    icon: Gift,
    url: "/pricing",
    items: [
      { title: "Affiliate Program", url: "/", icon: Gift, surface: "affiliates" },
      { title: "Affiliate Dashboard", url: "/dashboard", icon: BarChart3, surface: "affiliates" },
      { title: "Documentation", url: "/", icon: BookOpen, surface: "docs" },
      { title: "Gradr News", url: "/", icon: Newspaper, surface: "news" },
      { title: "Product site", url: "/", icon: Globe, surface: "marketing" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    icon: ShieldCheck,
    url: "/admin",
    adminOnly: true,
    items: [
      { title: "Control Room", url: "/admin", icon: LayoutDashboard },
      { title: "Revenue", url: "/admin/revenue", icon: Wallet },
      { title: "Usage & AI Cost", url: "/admin/usage", icon: Gauge },
      { title: "Affiliate Admin", url: "/admin/affiliates", icon: Gift },
      { title: "Verifications", url: "/admin/verifications", icon: ShieldCheck },
      { title: "Discounts", url: "/admin/discounts", icon: BadgePercent },
      { title: "Legal Documents", url: "/admin/legal", icon: ScrollText },
      { title: "Audit Log", url: "/admin/audit-log", icon: ScrollText },
      { title: "Security Log", url: "/admin/security-log", icon: ShieldCheck },
      { title: "Security Findings", url: "/admin/security-findings", icon: ShieldCheck },
      { title: "Search Console", url: "/admin/search-console", icon: Search },
      { title: "Blog Analytics", url: "/admin/blog-analytics", icon: BarChart3 },
      { title: "Nav Analytics", url: "/admin/nav-analytics", icon: BarChart3 },
      { title: "SEO Monitor", url: "/admin/seo-monitor", icon: BarChart3 },
      { title: "Digest Preview", url: "/admin/digest-preview", icon: Mail },
      { title: "Paddle Customers", url: "/admin/paddle", icon: Wallet },
      { title: "Payments Status", url: "/admin/payments-status", icon: Activity },
      { title: "Brand Assets", url: "/admin/brand-assets", icon: ImageIcon },
    ],
  },
];
