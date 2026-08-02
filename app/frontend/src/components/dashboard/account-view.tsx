"use client";

// Hesab (Account) and Ayarlar (Settings) — these were PlaceholderView stubs.
// Everything here is backed by a real endpoint or a persisted preference; no
// toggle is rendered unless it actually does something.

import { Check, KeyRound, LogOut, Monitor, Moon, Sun, User as UserIcon } from "lucide-react";
import { useState } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { useTheme } from "@/components/theme-provider";
import {
  AuthError,
  changePassword,
  getUser,
  signOutEverywhere,
  updateProfile
} from "@/lib/auth";
import type { Lang } from "@/lib/i18n";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  company_admin: "Şirkət admini",
  employee: "İşçi"
};

// Label above value, not label-left/value-far-right: on a wide dashboard that
// split leaves the eye travelling the full width of the card to pair them up.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

// Caps the reading width so form rows stay close to their labels instead of
// stretching across the whole dashboard.
function Pane({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full max-w-2xl flex-col gap-4">{children}</div>;
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function AccountView({ t }: { t: Record<string, string> }) {
  const user = getUser();
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const flash = (m: string) => {
    setMsg(m);
    setErr("");
    setTimeout(() => setMsg(""), 3000);
  };
  const fail = (e: unknown) => {
    setErr(e instanceof AuthError ? e.message : (t.errRegisterFailed ?? "…"));
    setMsg("");
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await updateProfile(name);
      // Keep the cached user (top-bar initials, greeting) in step.
      const u = getUser();
      if (u) {
        window.localStorage.setItem(
          "homora-auth-user",
          JSON.stringify({ ...u, name })
        );
      }
      flash(t.acSaved ?? "Yadda saxlanıldı");
    } catch (e) {
      fail(e);
    }
    setSavingName(false);
  };

  const savePassword = async () => {
    try {
      await changePassword(cur, next);
      setCur("");
      setNext("");
      flash(t.acPwChanged ?? "Şifrə dəyişdirildi");
    } catch (e) {
      fail(e);
    }
  };

  if (!user) {
    return (
      <DashboardCard title={t.navAccount} subtitle="">
        <div className="text-sm text-muted-foreground">{t.acNoSession ?? "—"}</div>
      </DashboardCard>
    );
  }

  return (
    <Pane>
      <DashboardCard title={t.acProfile ?? "Profil"} subtitle={user.email}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Row label={t.email} value={user.email} />
            <Row label={t.acRole ?? "Rol"} value={ROLE_LABEL[user.role] ?? user.role} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t.acFullName ?? "Ad Soyad"} value={name} onChange={setName} />
            </div>
            <button
              className="hm-btn hm-btn-primary h-9 shrink-0 px-4"
              disabled={savingName || !name.trim() || name === user.name}
              onClick={saveName}
            >
              <UserIcon className="h-3.5 w-3.5" /> {t.acSave ?? "Yadda saxla"}
            </button>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title={t.acPassword ?? "Şifrəni dəyiş"}
        subtitle={t.acPasswordSub ?? ""}
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t.acCurrentPw ?? "Cari şifrə"}
              type="password"
              value={cur}
              onChange={setCur}
            />
            <Field
              label={t.acNewPw ?? "Yeni şifrə"}
              type="password"
              value={next}
              onChange={setNext}
            />
          </div>
          <button
            className="hm-btn hm-btn-primary h-9 self-start px-4"
            disabled={!cur || next.length < 5}
            onClick={savePassword}
          >
            <KeyRound className="h-3.5 w-3.5" /> {t.acChangePw ?? "Dəyiş"}
          </button>
        </div>
      </DashboardCard>

      <DashboardCard title={t.acSession ?? "Sessiya"} subtitle={t.acSessionSub ?? ""}>
        <button
          className="hm-btn hm-btn-ghost h-9 self-start px-4"
          onClick={async () => {
            await signOutEverywhere();
            window.location.replace("/login");
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> {t.menuSignOut}
        </button>
      </DashboardCard>

      {(msg || err) && (
        <div
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (err ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")
          }
        >
          {err || msg}
        </div>
      )}
    </Pane>
  );
}

export function SettingsView({
  t,
  lang,
  onLangChange
}: {
  t: Record<string, string>;
  lang: Lang;
  onLangChange: (l: Lang) => void;
}) {
  const { theme, toggle } = useTheme();
  const env = process.env.NEXT_PUBLIC_APP_ENV || "development";

  return (
    <Pane>
      <DashboardCard title={t.stAppearance ?? "Görünüş"} subtitle={t.stAppearanceSub ?? ""}>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.menuTheme}</span>
          <button className="hm-btn hm-btn-ghost h-9 self-start px-4" onClick={toggle}>
            {theme === "light" ? (
              <>
                <Sun className="h-3.5 w-3.5" /> {t.stLight ?? "İşıqlı"}
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" /> {t.stDark ?? "Qaranlıq"}
              </>
            )}
          </button>
        </div>
      </DashboardCard>

      <DashboardCard title={t.stLanguage ?? "Dil"} subtitle={t.stLanguageSub ?? ""}>
        <div className="flex gap-2">
          {(["az", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              className={"hm-btn h-9 px-4 " + (lang === l ? "hm-btn-primary" : "hm-btn-ghost")}
              onClick={() => onLangChange(l)}
            >
              {lang === l && <Check className="h-3.5 w-3.5" />}
              {l === "az" ? "Azərbaycanca" : "English"}
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title={t.stSystem ?? "Sistem"} subtitle={t.stSystemSub ?? ""}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <Row label={t.stEnv ?? "Mühit"} value={env} />
            <Row
              label={t.stApi ?? "API"}
              value={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            {t.stSystemNote ?? ""}
          </div>
        </div>
      </DashboardCard>
    </Pane>
  );
}
