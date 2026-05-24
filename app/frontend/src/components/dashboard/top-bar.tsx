"use client";

import { Building2, Globe, Hexagon, Moon, RefreshCcw, Search, Share2, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

type Props = {
  t: Record<string, string>;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  analysisType: "geom" | "pure_h3";
  onAnalysisTypeChange: (v: "geom" | "pure_h3") => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

export function TopBar({
  t,
  lang,
  onLangChange,
  analysisType,
  onAnalysisTypeChange,
  onRefresh,
  refreshing
}: Props) {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <header className="flex items-center gap-3 border-b bg-card px-5 py-3">
      <div className="flex flex-col">
        <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
          {t.dashTitle}
        </h1>
        <span className="text-[11.5px] text-muted-foreground">{t.dashSub}</span>
      </div>

      <div className="flex-1" />

      {/* Search — not yet wired to backend */}
      <div
        className="hidden h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 md:flex md:w-[280px]"
        title="Arama özelliği yakında"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder={`${t.searchPh} (yakında)`}
          disabled
          className="flex-1 cursor-not-allowed bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Geom / H3 segmented */}
      <div className="flex h-9 items-center gap-0.5 rounded-lg border bg-background p-0.5">
        <button
          onClick={() => onAnalysisTypeChange("geom")}
          className={cn(
            "flex h-full items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
            analysisType === "geom"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          {t.geom}
        </button>
        <button
          onClick={() => onAnalysisTypeChange("pure_h3")}
          className={cn(
            "flex h-full items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
            analysisType === "pure_h3"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Hexagon className="h-3.5 w-3.5" />
          {t.h3}
        </button>
      </div>

      {/* Refresh */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-9 gap-1.5 text-[12px]"
      >
        <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        {t.refresh}
      </Button>

      {/* Export */}
      <Button size="sm" className="h-9 gap-1.5 text-[12px]">
        <Share2 className="h-3.5 w-3.5" />
        {t.export}
      </Button>

      {/* Lang */}
      <button
        onClick={() => onLangChange(lang === "tr" ? "en" : "tr")}
        className="flex h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Toggle language"
      >
        <Globe className="h-3.5 w-3.5" />
        {lang}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Toggle theme"
      >
        {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </button>

      {/* User chip */}
      <button className="flex h-9 items-center gap-2 rounded-lg border bg-background pl-1 pr-2.5 transition-colors hover:bg-muted/40">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-600)] text-[11px] font-bold text-white">
          AD
        </span>
        <span className="text-[12.5px] font-medium text-foreground">admin</span>
      </button>
    </header>
  );
}
