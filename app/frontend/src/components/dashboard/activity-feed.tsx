"use client";

import {
  Activity as ActivityIcon,
  AlertCircle,
  ArrowRight,
  Hexagon,
  Mail,
  RefreshCcw,
  Share2
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ActivityItem, ActivityTone } from "@/types/api";

type Props = {
  activity: ActivityItem[];
};

const ICONS: Record<ActivityItem["action"], React.ComponentType<{ className?: string }>> = {
  new_listings:  Mail,
  price_alert:   AlertCircle,
  price_drop:    ArrowRight,
  hexagon_added: Hexagon,
  report_export: Share2,
  data_sync:     RefreshCcw
};

const TONE_BG: Record<ActivityTone, string> = {
  ok:   "bg-emerald-500/10 text-emerald-500",
  warn: "bg-amber-500/10 text-amber-500",
  err:  "bg-red-500/10 text-red-500",
  info: "bg-[var(--brand-50)] text-[var(--brand-700)]"
};

export function ActivityFeed({ activity }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {activity.map((a, i) => {
        const Icon = ICONS[a.action] ?? ActivityIcon;
        return (
          <div
            key={i}
            className="grid grid-cols-[32px_1fr_auto] items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg",
                TONE_BG[a.tone]
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-foreground">
                {a.rayon}
              </div>
              <div className="text-[11.5px] text-muted-foreground">{a.detail}</div>
            </div>
            <span className="whitespace-nowrap pt-1 text-[11px] tabular-nums text-muted-foreground">
              {a.ts}
            </span>
          </div>
        );
      })}
    </div>
  );
}
