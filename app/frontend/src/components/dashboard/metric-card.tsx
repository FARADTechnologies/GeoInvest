"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Props = {
  title: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  loading?: boolean;
  signed?: boolean;
};

export function MetricCard({ title, value, suffix, icon: Icon, loading, signed }: Props) {
  const displayValue = suffix === "AZN/m2" ? formatCurrency(value) : formatNumber(value);
  const tone = signed && value < 0 ? "text-destructive" : signed ? "text-primary" : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className={cn("text-2xl font-semibold tracking-normal", tone)}>
            {signed && value > 0 ? "+" : ""}
            {displayValue}
            {suffix ? <span className="ml-1 text-sm text-muted-foreground">{suffix}</span> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
