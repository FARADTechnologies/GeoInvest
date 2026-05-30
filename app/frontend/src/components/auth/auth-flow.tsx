"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";

import { HMIcon, type IconName } from "@/components/auth/auth-icons";
import { submitAccountRequest } from "@/lib/admin-data";
import { signIn } from "@/lib/auth";

// ──────────────────────────────────────────────────────────────────────
// HMAuthFlow — single state machine for signin / signup / forgot / otp /
// verify. Pure UI; auth side-effects happen via lib/auth.ts.
// ──────────────────────────────────────────────────────────────────────

type Mode = "signin" | "signup" | "forgot" | "otp" | "verify";

type Props = {
  t: Record<string, string>;
};

export function HMAuthFlow({ t }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search?.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("admin@homora.ai");
  const [password, setPassword] = useState("12345");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [title, setTitle] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [remember, setRemember] = useState(true);
  const [otp, setOtp] = useState("");
  const [otpOrigin, setOtpOrigin] = useState<Mode>("signin");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const goto = (m: Mode) => {
    setOtp("");
    setError("");
    setMode(m);
  };

  const enterDashboard = () => {
    router.replace(nextParam.startsWith("/") ? nextParam : "/");
  };

  const handleSignIn = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError(t.errEmpty || "Email ve şifre gerekli.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password, { name });
      enterDashboard();
    } catch (e) {
      setError(t.errEmpty || "Giriş başarısız.");
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    if (
      !name.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !company.trim() ||
      !taxId.trim() ||
      !title.trim() ||
      !password.trim()
    ) {
      setError(t.errEmpty || "Email ve şifre gerekli.");
      return;
    }
    setSubmitting(true);
    submitAccountRequest({
      firstName: name,
      lastName,
      email,
      phone,
      companyName: company,
      taxId,
      title,
      password,
      employeeCount: employeeCount || undefined
    });
    goto("verify");
    setSubmitting(false);
  };

  const onOtpComplete = async (code: string) => {
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      await signIn(email, password || code, { name });
      enterDashboard();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="hm-auth"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%"
      }}
    >
      {(mode === "signin" || mode === "signup") && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 24
          }}
        >
          <div className="hm-tabs">
            <button
              type="button"
              className="hm-tab"
              data-active={mode === "signin"}
              onClick={() => goto("signin")}
            >
              {t.signIn}
            </button>
            <button
              type="button"
              className="hm-tab"
              data-active={mode === "signup"}
              onClick={() => goto("signup")}
            >
              {t.signUp}
            </button>
          </div>
        </div>
      )}

      {/* ── Sign in ───────────────────────────────────────── */}
      {mode === "signin" && (
        <div className="hm-fade" key="signin">
          <h1 style={hmStyles.h1}>{t.signInTitle}</h1>
          <p style={hmStyles.sub}>{t.signInSub}</p>

          {/* Demo credentials banner */}
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "var(--brand-50)",
              border: "1px solid var(--brand-200)",
              borderRadius: 10,
              fontSize: 12.5,
              color: "var(--brand-800)",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <HMIcon name="spark" size={14} />
            <span>
              <strong>Demo:</strong> herhangi bir e-posta + şifre çalışır
              (örn. <code>admin / 12345</code>).
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignIn();
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 20
            }}
          >
            <HMField
              icon="mail"
              label={t.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
            />
            <HMField
              icon="lock"
              label={t.password}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t.passwordPlaceholder}
              hint={t.forgot}
              onHintClick={() => goto("forgot")}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 2
              }}
            >
              <HMCheck checked={remember} onChange={setRemember}>
                {t.rememberMe}
              </HMCheck>
            </div>

            {error && <HMErrorBanner text={error} />}

            <button
              type="submit"
              className="hm-btn hm-btn-primary"
              style={{ marginTop: 6 }}
              disabled={submitting}
            >
              {submitting ? t.loading ?? "..." : t.signInBtn}
              {!submitting && <HMIcon name="arrow-right" size={16} />}
            </button>

            <div className="hm-divider" style={{ margin: "10px 0 4px" }}>
              {t.or}
            </div>

            <button
              type="button"
              className="hm-sso-btn"
              onClick={() => {
                setOtpOrigin("signin");
                goto("otp");
              }}
            >
              <HMIcon name="spark" size={17} /> {t.useOtp}
            </button>
          </form>
        </div>
      )}

      {/* ── Sign up ───────────────────────────────────────── */}
      {mode === "signup" && (
        <div className="hm-fade" key="signup">
          <h1 style={hmStyles.h1}>{t.signUpTitle}</h1>
          <p style={hmStyles.sub}>{t.signUpSub}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignUp();
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 28
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12
              }}
            >
              <HMField
                icon="user"
                label={t.firstName ?? t.fullName}
                value={name}
                onChange={setName}
                placeholder={t.fullNamePlaceholder}
              />
              <HMField
                icon="user"
                label={t.lastName ?? "Soyad"}
                value={lastName}
                onChange={setLastName}
                placeholder="Mammadova"
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12
              }}
            >
              <HMField
                icon="building"
                label={t.company}
                value={company}
                onChange={setCompany}
                placeholder={t.companyPlaceholder}
              />
              <HMField
                icon="building"
                label={t.taxId ?? "VOEN"}
                value={taxId}
                onChange={setTaxId}
                placeholder="1702458891"
              />
            </div>
            <HMField
              icon="mail"
              label={t.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12
              }}
            >
              <HMField
                icon="mail"
                label={t.phone ?? "Telefon"}
                value={phone}
                onChange={setPhone}
                placeholder="+994 50 000 00 00"
              />
              <HMField
                icon="user"
                label={t.title ?? "Unvan / pozisyon"}
                value={title}
                onChange={setTitle}
                placeholder="Director"
              />
            </div>
            <HMField
              icon="building"
              label={t.employeeCount ?? "Calisan sayisi"}
              value={employeeCount}
              onChange={setEmployeeCount}
              placeholder="Opsiyonel"
            />
            <HMField
              icon="lock"
              label={t.password}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t.passwordPlaceholder}
            />

            {error && <HMErrorBanner text={error} />}

            <button
              type="submit"
              className="hm-btn hm-btn-primary"
              style={{ marginTop: 4 }}
              disabled={submitting}
            >
              {t.submitAccountRequest ?? t.createAccount} <HMIcon name="arrow-right" size={16} />
            </button>

            <p style={{ ...hmStyles.fine, marginTop: 4 }}>
              {t.agreeStart}{" "}
              <a href="#" style={hmStyles.link}>
                {t.agreeTerms}
              </a>{" "}
              {t.agreeAnd}{" "}
              <a href="#" style={hmStyles.link}>
                {t.agreePrivacy}
              </a>
              {t.agreeEnd}
            </p>
          </form>
        </div>
      )}

      {/* ── Forgot ────────────────────────────────────────── */}
      {mode === "forgot" && (
        <div className="hm-fade" key="forgot">
          <button
            type="button"
            onClick={() => goto("signin")}
            style={hmStyles.backBtn}
          >
            <HMIcon name="arrow-left" size={14} /> {t.backToSignIn}
          </button>
          <h1 style={hmStyles.h1}>{t.forgotTitle}</h1>
          <p style={hmStyles.sub}>{t.forgotSub}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goto("signin");
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 28
            }}
          >
            <HMField
              icon="mail"
              label={t.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
              autoFocus
            />
            <button type="submit" className="hm-btn hm-btn-primary">
              {t.sendResetLink} <HMIcon name="send" size={15} />
            </button>
            <p style={hmStyles.fine}>
              {t.rememberItNow}{" "}
              <a
                href="#"
                style={hmStyles.link}
                onClick={(e) => {
                  e.preventDefault();
                  goto("signin");
                }}
              >
                {t.signIn}
              </a>
            </p>
          </form>
        </div>
      )}

      {/* ── OTP ──────────────────────────────────────────── */}
      {mode === "otp" && (
        <div className="hm-fade" key="otp">
          <button
            type="button"
            onClick={() => goto(otpOrigin)}
            style={hmStyles.backBtn}
          >
            <HMIcon name="arrow-left" size={14} /> {t.backToSignIn}
          </button>
          <h1 style={hmStyles.h1}>{t.otpTitle}</h1>
          <p style={hmStyles.sub}>
            {t.otpSubA}{" "}
            <strong style={{ color: "var(--ink-800)" }}>{email}</strong>
            {t.otpSubB}
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              marginTop: 28
            }}
          >
            <HMOtp value={otp} onChange={setOtp} onComplete={onOtpComplete} />
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              disabled={otp.length !== 6 || submitting}
              onClick={() => onOtpComplete(otp)}
            >
              {t.verifyOtp} <HMIcon name="arrow-right" size={16} />
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <span style={hmStyles.fine}>{t.otpResend}</span>
              <button
                type="button"
                className="hm-btn"
                style={{
                  padding: 0,
                  color: "var(--brand-600)",
                  background: "transparent",
                  fontSize: 13
                }}
              >
                <HMIcon name="refresh" size={13} /> {t.otpResendBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Verify (after sign up) ───────────────────────── */}
      {mode === "verify" && (
        <div className="hm-fade" key="verify">
          <div style={hmStyles.iconBubble}>
            <HMIcon name="check-circle" size={28} stroke={1.6} />
          </div>
          <h1 style={hmStyles.h1}>{t.requestReceivedTitle ?? t.verifyTitle}</h1>
          <p style={hmStyles.sub}>
            {t.requestReceivedBody ??
              "Talebiniz alindi, super admin onayindan sonra erisim acilacak."}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              onClick={enterDashboard}
            >
              <HMIcon name="arrow-right" size={15} />{" "}
              {t.continue ?? "Devam et"}
            </button>
            <button type="button" className="hm-btn hm-btn-ghost">
              <HMIcon name="refresh" size={14} /> {t.resendVerify}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function HMField({
  icon,
  label,
  hint,
  onHintClick,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus
}: {
  icon?: IconName;
  label?: string;
  hint?: string;
  onHintClick?: () => void;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const inputType = type === "password" && shown ? "text" : type;
  return (
    <div className="hm-field">
      {label && (
        <label className="hm-label">
          <span>{label}</span>
          {hint && (
            <button
              type="button"
              className="hm-label-hint"
              onClick={onHintClick}
            >
              {hint}
            </button>
          )}
        </label>
      )}
      <div className="hm-input-wrap">
        {icon && (
          <span className="hm-input-icon">
            <HMIcon name={icon} size={17} />
          </span>
        )}
        <input
          type={inputType}
          className="hm-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={type === "password" ? "current-password" : "email"}
        />
        {type === "password" && (
          <button
            type="button"
            className="hm-input-suffix"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "hide" : "show"}
          >
            <HMIcon name={shown ? "eye-off" : "eye"} size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

function HMCheck({
  checked,
  onChange,
  children
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="hm-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="hm-check-box">
        <HMIcon name="check" size={12} stroke={2.6} />
      </span>
      <span>{children}</span>
    </label>
  );
}

function HMOtp({
  value,
  onChange,
  onComplete
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const focusCell = (i: number) => refs.current[i]?.focus();
  const setAt = (i: number, v: string) => {
    const next = cells.slice();
    next[i] = v;
    const joined = next.join("");
    onChange(joined);
    if (joined.length === 6 && next.every((c) => c)) onComplete?.(joined);
  };
  return (
    <div className="hm-otp">
      {cells.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="hm-otp-cell"
          data-filled={c ? "true" : "false"}
          value={c}
          inputMode="numeric"
          maxLength={1}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, v);
            if (v && i < 5) focusCell(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c && i > 0) focusCell(i - 1);
            if (e.key === "ArrowLeft" && i > 0) focusCell(i - 1);
            if (e.key === "ArrowRight" && i < 5) focusCell(i + 1);
          }}
          onPaste={(e) => {
            const txt = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 6);
            if (txt.length) {
              e.preventDefault();
              onChange(txt.padEnd(6, "").slice(0, 6));
              if (txt.length === 6) onComplete?.(txt);
              focusCell(Math.min(txt.length, 5));
            }
          }}
        />
      ))}
    </div>
  );
}

function HMErrorBanner({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--err-50)",
        color: "var(--err-500)",
        fontSize: 13,
        fontWeight: 500
      }}
    >
      <HMIcon name="alert" size={15} />
      <span>{text}</span>
    </div>
  );
}

// ── Inline styles shared by all flow states ────────────────────────────

const hmStyles: Record<string, CSSProperties> = {
  h1: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.025em",
    color: "var(--ink-900)",
    lineHeight: 1.15
  },
  sub: {
    margin: "8px 0 0",
    fontSize: 14.5,
    color: "var(--ink-500)",
    lineHeight: 1.5,
    fontWeight: 450
  },
  fine: {
    fontSize: 12.5,
    color: "var(--ink-500)",
    lineHeight: 1.5,
    margin: 0
  },
  link: {
    color: "var(--brand-600)",
    fontWeight: 600,
    textDecoration: "none"
  },
  backBtn: {
    appearance: "none",
    border: 0,
    background: "transparent",
    cursor: "pointer",
    color: "var(--ink-500)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0 0 16px"
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "color-mix(in oklab, var(--brand-500) 12%, transparent)",
    color: "var(--brand-700)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  }
};
