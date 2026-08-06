"use client";

import {
  BarChart3,
  Boxes,
  Calculator,
  Globe,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Settings,
  Shield,
  User
} from "lucide-react";
import Link from "next/link";

import { HomoraLogo } from "@/components/brand/homora-logo";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Props = {
  t: Record<string, string>;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  /** Real listing count for the Elanlar badge; hidden until it loads. */
  listingCount?: number;
  /** Rail collapsed to icons only. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export type DashboardView =
  | "overview"
  | "map"
  | "rayons"
  | "trends"
  | "valuation-single"
  | "valuation-mass"
  | "valuation-analysis"
  | "valuation-market"
  | "valuation-hexmap"
  | "valuation-map"
  | "listings"
  | "b2c"
  | "reports"
  | "alerts"
  | "admin"
  | "settings"
  | "account";

type NavItem = {
  id: DashboardView;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  pill?: string;
};

/** 168575 → "168.6k" — keeps the badge narrow without inventing a number. */
function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function NavSidebar({ t, activeView, onViewChange, listingCount, collapsed, onToggleCollapsed }: Props) {
  // Single navigation group. Legacy "Homora V1" views (overview / map /
  // rayons / trends / b2c / reports / secondary system) stay hidden from the
  // menu per team request — their code stays in the shell.
  // Elanlar (listings) was moved up from V1 into this group.
  // "Admin / Şirkətlər" came back out of V1 because account approval lives
  // there; it's only rendered for a super admin.
  const isSuperAdmin = getUser()?.role === "super_admin";
  const items: NavItem[] = [
    { id: "valuation-single", icon: Calculator, label: t.navValSingle ?? "Tək qiymətləndirmə" },
    { id: "valuation-mass", icon: Boxes, label: t.navValMass ?? "Kütləvi qiymətləndirmə" },
    { id: "valuation-analysis", icon: PieChart, label: t.navValAnalysis ?? "Portfel analizi" },
    { id: "valuation-market", icon: BarChart3, label: t.navValMarket ?? "Bazar analizi" },
    { id: "valuation-hexmap", icon: Globe, label: t.navValHexMap ?? "Xəritə analizi" },
    {
      id: "listings",
      icon: Mail,
      label: t.navListings,
      // Was hardcoded "12.8k" while the view itself showed 168k.
      pill: listingCount ? compactCount(listingCount) : undefined
    },
    ...(isSuperAdmin
      ? [{ id: "admin" as const, icon: Shield, label: t.navAdmin ?? "Admin / Şirkətlər" }]
      : [])
  ];
  const settings: NavItem[] = [
    { id: "settings", icon: Settings, label: t.navSettings },
    { id: "account", icon: User, label: t.navAccount }
  ];

  const toggleLabel = collapsed
    ? (t.sidebarExpand ?? "Yan paneli aç")
    : (t.sidebarCollapse ?? "Yan paneli bağla");

  return (
    <nav className={cn("flex flex-col gap-2 py-4", collapsed ? "px-2" : "px-3")}>
      {/* Brand + collapse control — pinned while the nav list scrolls */}
      <div
        className={cn(
          "sticky top-0 z-10 -mt-4 mb-1 flex items-center border-b bg-card py-3",
          collapsed ? "-mx-2 justify-center px-2" : "-mx-3 gap-2 px-5"
        )}
      >
        {/* Official Homora.ai wordmark (team #4), inlined so it can't 404 on
            deploy; `.app-logo` inverts it to white in dark mode. */}
        {/* The wordmark used to sit next to "İş sahəsi · Caspian Realty" — a
            hardcoded tenant name every user saw regardless of who they were.
            Dropped rather than faked; re-add it here once real companies
            exist and the signed-in user can be mapped to one. */}
        {!collapsed && (
          <Link href="/" className="min-w-0 flex-1" aria-label="Homora.ai dashboard">
            <HomoraLogo height={22} className="app-logo" />
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={`${toggleLabel} (Ctrl+B)`}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {items.map((n) => (
          <NavRow key={n.id} item={n} active={activeView === n.id} collapsed={collapsed} onClick={() => onViewChange(n.id)} />
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        {collapsed ? (
          <div className="my-2 border-t" />
        ) : (
          <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.navAccount}
          </div>
        )}
        {settings.map((n) => (
          <NavRow key={n.id} item={n} active={activeView === n.id} collapsed={collapsed} onClick={() => onViewChange(n.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onClick
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      // Collapsed rows carry the label as a tooltip, so the icon alone is
      // still identifiable.
      title={collapsed ? (item.pill ? `${item.label} · ${item.pill}` : item.label) : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "flex h-9 items-center rounded-lg text-[12.5px] font-medium transition-colors",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
        active
          ? "bg-[var(--brand-600)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && item.pill ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider",
            active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {item.pill}
        </span>
      ) : null}
    </button>
  );
}
