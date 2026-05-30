"use client";

import {
  Building2,
  Globe,
  Hexagon,
  LogOut,
  Moon,
  RefreshCcw,
  Search,
  Share2,
  Sun,
  User as UserIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { getUser, signOut } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ initials: string; email: string; name: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Hydrate user data from localStorage on mount.
  useEffect(() => {
    const u = getUser();
    if (u) setUser({ initials: u.initials, email: u.email, name: u.name });
  }, []);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
  };

  const initials = user?.initials ?? "AD";
  const displayName = user?.name ?? "admin";
  const nextLang: Record<Lang, Lang> = { tr: "en", en: "az", az: "tr" };

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
        title={t.searchSoon ?? "Search coming soon"}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder={`${t.searchPh} (${t.searchSoon ?? "soon"})`}
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

      <Button size="sm" className="h-9 gap-1.5 text-[12px]">
        <Share2 className="h-3.5 w-3.5" />
        {t.export}
      </Button>

      <button
        onClick={() => onLangChange(nextLang[lang])}
        className="flex h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Toggle language"
      >
        <Globe className="h-3.5 w-3.5" />
        {lang}
      </button>

      <button
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Toggle theme"
      >
        {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </button>

      {/* User chip + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((s) => !s)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border bg-background pl-1 pr-2.5 transition-colors hover:bg-muted/40",
            menuOpen && "bg-muted/40"
          )}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-600)] text-[11px] font-bold text-white">
            {initials}
          </span>
          <span className="text-[12.5px] font-medium text-foreground">
            {displayName}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border bg-card shadow-lg"
          >
            {/* Header — name + email */}
            <div className="border-b px-3 py-3">
              <div className="text-[13px] font-semibold text-foreground">
                {displayName}
              </div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {user?.email ?? "admin@homora.ai"}
              </div>
            </div>

            <MenuItem
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label={t.menuAccount ?? "Hesabım"}
              onClick={() => setMenuOpen(false)}
            />
            <MenuItem
              icon={
                theme === "light" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )
              }
              label={`${t.menuTheme ?? "Tema"} · ${theme === "light" ? "Light" : "Dark"}`}
              onClick={() => {
                toggleTheme();
              }}
            />

            <div className="border-t" />

            <MenuItem
              icon={<LogOut className="h-3.5 w-3.5" />}
              label={t.menuSignOut ?? "Çıkış yap"}
              destructive
              onClick={handleSignOut}
            />
          </div>
        )}
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium transition-colors hover:bg-muted/60",
        destructive ? "text-red-500" : "text-foreground"
      )}
    >
      <span className={destructive ? "text-red-500" : "text-muted-foreground"}>
        {icon}
      </span>
      {label}
    </button>
  );
}
