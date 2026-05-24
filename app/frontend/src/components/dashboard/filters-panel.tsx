"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DashboardFilters, FiltersResponse } from "@/types/api";

type Props = {
  catalog: FiltersResponse;
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  minAdsThreshold: number;
  onMinAdsThresholdChange: (n: number) => void;
  colorBy: "price" | "listings";
  onColorByChange: (v: "price" | "listings") => void;
  disabled?: boolean;
  t: Record<string, string>;
};

export function FiltersPanel({
  catalog,
  value,
  onChange,
  minAdsThreshold,
  onMinAdsThresholdChange,
  colorBy,
  onColorByChange,
  disabled,
  t
}: Props) {
  const setPeriod = (period: string) => onChange({ ...value, period });
  const setResolution = (resolution: number) => onChange({ ...value, resolution });
  const setAnalysisType = (analysis_type: string) => onChange({ ...value, analysis_type });
  const toggleCat = (cat: string) => {
    const next = value.categories.includes(cat)
      ? value.categories.filter((c) => c !== cat)
      : [...value.categories, cat];
    if (next.length === 0) return; // keep at least one
    onChange({ ...value, categories: next });
  };

  return (
    <div className="flex flex-col gap-4 border-t px-3 py-4">
      {/* Analysis type */}
      <Section label={t.analysisType}>
        <Segmented
          options={[
            { value: "geom",    label: t.geom },
            { value: "pure_h3", label: t.h3   }
          ]}
          value={value.analysis_type}
          onChange={setAnalysisType}
          disabled={disabled}
        />
      </Section>

      {/* Period */}
      <Section label={t.period}>
        <select
          value={value.period}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded-lg border bg-background px-2.5 text-[12.5px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] disabled:opacity-60"
        >
          {catalog.periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Section>

      {/* Categories */}
      <Section label={t.categoriesL}>
        <div className="flex flex-wrap gap-1.5">
          {catalog.categories.map((c) => {
            const active = value.categories.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                disabled={disabled}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-transparent bg-[var(--brand-600)] text-white"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? <Check className="h-3 w-3" strokeWidth={2.6} /> : null}
                {c}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Resolution */}
      <Section
        label={t.resolution}
        pill={`H${value.resolution}`}
      >
        <input
          type="range"
          min={Math.min(...catalog.resolutions)}
          max={Math.max(...catalog.resolutions)}
          step={1}
          value={value.resolution}
          onChange={(e) => setResolution(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-[var(--brand-600)]"
        />
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
          {catalog.resolutions.map((r) => (
            <span key={r}>H{r}</span>
          ))}
        </div>
      </Section>

      {/* Outlier threshold */}
      <Section
        label={t.outlier}
        pill={minAdsThreshold === 0 ? t.outlierOff : `${t.cellsLte} ${minAdsThreshold}`}
      >
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={minAdsThreshold}
          onChange={(e) => onMinAdsThresholdChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-[var(--brand-600)]"
        />
      </Section>

      {/* Color by */}
      <Section label={t.colorBy}>
        <Segmented
          options={[
            { value: "price",    label: t.byPrice    },
            { value: "listings", label: t.byListings }
          ]}
          value={colorBy}
          onChange={(v) => onColorByChange(v as "price" | "listings")}
          disabled={disabled}
        />
      </Section>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function Section({
  label,
  pill,
  children
}: {
  label: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {pill ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground">
            {pill}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  disabled
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-9 items-center gap-0.5 rounded-lg border bg-background p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "flex h-full flex-1 items-center justify-center rounded-md text-[11.5px] font-medium transition-colors",
            value === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
