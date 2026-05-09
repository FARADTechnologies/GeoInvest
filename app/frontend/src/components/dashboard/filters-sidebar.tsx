"use client";

import { CheckCheck, Layers, SlidersHorizontal } from "lucide-react";

import type { DashboardFilters, FiltersResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type Props = {
  catalog: FiltersResponse;
  value: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  disabled?: boolean;
  minAdsThreshold: number;
  onMinAdsThresholdChange: (value: number) => void;
};

function nearestResolution(value: number, options: number[]) {
  return options.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
}

export function FiltersSidebar({ catalog, value, onChange, disabled, minAdsThreshold, onMinAdsThresholdChange }: Props) {
  const setCategories = (categories: string[]) => {
    if (categories.length === 0) {
      return;
    }
    onChange({ ...value, categories });
  };

  const minResolution = Math.min(...catalog.resolutions);
  const maxResolution = Math.max(...catalog.resolutions);

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Analytics
          </div>
          <div className="text-lg font-semibold">H3 Control</div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Analysis Type
        </div>
        <RadioGroup
          value={value.analysis_type}
          onValueChange={(analysis_type) => onChange({ ...value, analysis_type })}
          className="grid grid-cols-1 gap-2"
          disabled={disabled}
        >
          {catalog.analysis_types.map((type) => (
            <label
              key={type}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                value.analysis_type === type ? "border-primary bg-primary/10" : "bg-background/40"
              )}
            >
              <RadioGroupItem value={type} />
              <span className="font-medium">{type}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Period</label>
        <Select
          value={value.period}
          onValueChange={(period) => onChange({ ...value, period })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {catalog.periods.map((period) => (
              <SelectItem key={period} value={period}>
                {period}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium">Categories</label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCategories(catalog.categories)}
            disabled={disabled}
          >
            <CheckCheck className="h-4 w-4" />
            All
          </Button>
        </div>
        <div className="max-h-44 space-y-2 overflow-auto pr-1">
          {catalog.categories.map((category) => {
            const checked = value.categories.includes(category);
            return (
              <label
                key={category}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                  checked ? "border-primary/60 bg-primary/10" : "bg-background/40"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(next) => {
                    setCategories(
                      next
                        ? [...value.categories, category]
                        : value.categories.filter((item) => item !== category)
                    );
                  }}
                />
                <span className="break-words">{category}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Resolution</label>
          <span className="rounded-md bg-secondary px-2 py-1 text-sm font-semibold">
            H{value.resolution}
          </span>
        </div>
        <Slider
          value={[value.resolution]}
          min={minResolution}
          max={maxResolution}
          step={1}
          disabled={disabled}
          onValueChange={([next]) =>
            onChange({
              ...value,
              resolution: nearestResolution(next, catalog.resolutions)
            })
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          {catalog.resolutions.map((resolution) => (
            <span key={resolution}>H{resolution}</span>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Outlier Filter</label>
          <span className="rounded-md bg-secondary px-2 py-1 text-sm font-semibold">
            {minAdsThreshold === 0 ? "Off" : `≤ ${minAdsThreshold}`}
          </span>
        </div>
        <Slider
          value={[minAdsThreshold]}
          min={0}
          max={10}
          step={1}
          onValueChange={([next]) => onMinAdsThresholdChange(next)}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Off</span>
          <span>10 ads</span>
        </div>
        {minAdsThreshold > 0 && (
          <p className="text-xs text-muted-foreground">
            Cells with ≤ {minAdsThreshold} ad{minAdsThreshold > 1 ? "s" : ""} hidden from map and analysis.
          </p>
        )}
      </div>
    </div>
  );
}
