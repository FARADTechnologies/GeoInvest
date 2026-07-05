"use client";

import { cn } from "@/lib/utils";
import type { DashboardFilters, FiltersResponse } from "@/types/api";

type Props = {
  catalog: FiltersResponse;
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  disabled?: boolean;
  t: Record<string, string>;
};

// Left-rail control. Per team request only the "Analiz növü" section is kept —
// everything that used to sit below it (Dövr / Kateqoriya / resolution +
// outlier sliders / rəngləndirmə) was removed because those live on the right
// side where needed. The old Geom/H3 toggle is replaced by a cell-size
// selector labelled Böyük / Orta / Kiçik (no "H3" jargon shown to users); it
// maps to the underlying H3 resolution (Böyük = widest cell … Kiçik = finest).
export function FiltersPanel({ catalog, value, onChange, disabled, t }: Props) {
  const res = [...catalog.resolutions].sort((a, b) => a - b);
  const large = res[0];
  const small = res[res.length - 1];
  const medium = res[Math.floor((res.length - 1) / 2)];
  const options = [
    { value: String(large), label: t.cellLarge ?? "Böyük" },
    { value: String(medium), label: t.cellMedium ?? "Orta" },
    { value: String(small), label: t.cellSmall ?? "Kiçik" }
  ];

  return (
    <div className="flex flex-col gap-4 border-t px-3 py-4">
      <Section label={t.analysisType}>
        <Segmented
          options={options}
          value={String(value.resolution)}
          onChange={(v) => onChange({ ...value, resolution: Number(v) })}
          disabled={disabled}
        />
      </Section>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
