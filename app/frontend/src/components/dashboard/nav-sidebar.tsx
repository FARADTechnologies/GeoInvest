"use client";

import {
  BarChart3,
  Boxes,
  Calculator,
  Globe,
  Mail,
  PieChart,
  Settings,
  User
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type Props = {
  t: Record<string, string>;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
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

export function NavSidebar({ t, activeView, onViewChange }: Props) {
  // Single navigation group. Legacy "Homora V1" views (overview / map /
  // rayons / trends / b2c / reports / alerts / admin / secondary system) are
  // hidden from the menu per team request — their code stays in the shell.
  // Elanlar (listings) was moved up from V1 into this group.
  const items: NavItem[] = [
    { id: "valuation-single", icon: Calculator, label: t.navValSingle ?? "Tək qiymətləndirmə" },
    { id: "valuation-mass", icon: Boxes, label: t.navValMass ?? "Kütləvi qiymətləndirmə" },
    { id: "valuation-analysis", icon: PieChart, label: t.navValAnalysis ?? "Portfel analizi" },
    { id: "valuation-market", icon: BarChart3, label: t.navValMarket ?? "Bazar analizi" },
    { id: "valuation-hexmap", icon: Globe, label: t.navValHexMap ?? "Xəritə analizi" },
    { id: "listings", icon: Mail, label: t.navListings, pill: "12.8k" }
  ];
  const settings: NavItem[] = [
    { id: "settings", icon: Settings, label: t.navSettings },
    { id: "account", icon: User, label: t.navAccount }
  ];

  return (
    <nav className="flex flex-col gap-2 px-3 py-4">
      {/* Brand — pinned to the top of the rail while the nav list scrolls */}
      <Link
        href="/"
        className="sticky top-0 z-10 -mx-3 -mt-4 mb-1 flex items-center gap-2 border-b bg-card px-5 py-3 transition-colors hover:bg-muted/40"
        aria-label="Homora.ai dashboard"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2.5 L21 7 V17 L12 21.5 L3 17 V7 Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="currentColor"
              fillOpacity="0.25"
            />
          </svg>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] font-bold tracking-tight">
            Homora
            <span className="font-medium text-muted-foreground">.ai</span>
          </span>
          <span className="truncate text-[10.5px] text-muted-foreground">
            {t.workspace} · Caspian Realty
          </span>
        </div>
      </Link>

      <div className="flex flex-col gap-0.5">
        {items.map((n) => (
          <NavRow key={n.id} item={n} active={activeView === n.id} onClick={() => onViewChange(n.id)} />
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.navAccount}
        </div>
        {settings.map((n) => (
          <NavRow key={n.id} item={n} active={activeView === n.id} onClick={() => onViewChange(n.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavRow({
  item,
  active,
  onClick
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-[var(--brand-600)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 truncate text-left">{item.label}</span>
      {item.pill ? (
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
