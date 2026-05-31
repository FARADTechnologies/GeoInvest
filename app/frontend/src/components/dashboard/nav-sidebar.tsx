"use client";

import {
  Bell,
  Building2,
  Globe,
  Heart,
  Layers,
  Mail,
  Network,
  Settings,
  Shield,
  TrendingUp,
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
  const nav: NavItem[] = [
    { id: "overview", icon: Layers, label: t.navOverview },
    { id: "map", icon: Globe, label: t.navMap },
    { id: "rayons", icon: Building2, label: t.navRayons, pill: "12" },
    { id: "trends", icon: TrendingUp, label: t.navTrends },
    { id: "listings", icon: Mail, label: t.navListings, pill: "12.8k" },
    { id: "b2c", icon: Heart, label: t.navB2C ?? "B2C Görünüm" },
    { id: "reports", icon: Shield, label: t.navReports },
    { id: "alerts", icon: Bell, label: t.navAlerts, pill: "3" },
    { id: "admin", icon: Network, label: t.navAdmin ?? "Admin / Companies" }
  ];
  const settings: NavItem[] = [
    { id: "settings", icon: Settings, label: t.navSettings },
    { id: "account", icon: User, label: t.navAccount }
  ];

  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {/* Brand — clickable, returns to /(dashboard) */}
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40"
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

      {/* Main nav */}
      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.dashTitle}
        </div>
        {nav.map((n) => (
          <NavRow
            key={n.id}
            item={n}
            active={activeView === n.id}
            onClick={() => onViewChange(n.id)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.navAccount}
        </div>
        {settings.map((n) => (
          <NavRow
            key={n.id}
            item={n}
            active={activeView === n.id}
            onClick={() => onViewChange(n.id)}
          />
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
