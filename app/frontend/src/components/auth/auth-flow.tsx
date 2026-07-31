"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";

import { HMIcon, type IconName } from "@/components/auth/auth-icons";
import { submitAccountRequest } from "@/lib/admin-data";
import { AuthError, loginRequest, registerRequest, signIn, verifyOtp } from "@/lib/auth";

// ──────────────────────────────────────────────────────────────────────
// HMAuthFlow — single state machine for signin / signup / forgot / otp /
// verify. Pure UI; auth side-effects happen via lib/auth.ts.
// ──────────────────────────────────────────────────────────────────────

// Dev convenience is on everywhere EXCEPT production (team #2 — "prod olduqda
// göstəriş datası görsənməsin"). The prod deployment sets
// NEXT_PUBLIC_APP_ENV=production; dev/staging leave it unset so the seed-admin
// credentials stay prefilled for quick access.
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "";
const DEV_MODE = APP_ENV !== "production" && APP_ENV !== "prod";

type Mode = "signin" | "signup" | "forgot" | "otp" | "verify";

type Props = {
  t: Record<string, string>;
};

export function HMAuthFlow({ t }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search?.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(DEV_MODE ? "admin@homora.ai" : "");
  const [password, setPassword] = useState(DEV_MODE ? "12345" : "");
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
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Keep digits only (VOEN / phone / employee count). Phone also allows a
  // leading + and spaces so a formatted number can be typed.
  const digits = (v: string) => v.replace(/\D/g, "");
  const phoneChars = (v: string) => v.replace(/[^\d+\s]/g, "");

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
      // Step 1: verify credentials. Normally the backend emails an OTP and we
      // move to the OTP screen. The seed admin (dev access) is logged in
      // straight away — the backend returns a token with otp_required:false.
      const res = await loginRequest(email, password);
      setSubmitting(false);
      if (!res.otpRequired) {
        enterDashboard();
        return;
      }
      setOtpOrigin("signin");
      goto("otp");
    } catch (e) {
      setSubmitting(false);
      if (e instanceof AuthError) {
        // Wrong email/password (401) or "OTP could not be sent" (502).
        setError(e.message || (t.errWrongCreds));
      } else if (DEV_MODE) {
        // Backend unreachable in local dev → fall back to the local sign-in.
        try {
          await signIn(email, password, { name });
          enterDashboard();
        } catch {
          setError(t.errWrongCreds);
        }
      } else {
        setError(t.errWrongCreds);
      }
    }
  };

  const handleSignUp = async () => {
    setError("");
    // Per-field validation (team #7). Failing fields turn red.
    const req = t.errRequired;
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = req;
    if (!lastName.trim()) fe.lastName = req;
    if (company.trim().length < 3) fe.company = t.errMin3;
    if (title.trim().length < 3) fe.title = t.errMin3;
    if (!taxId.trim()) fe.taxId = req;
    else if (taxId.length > 15) fe.taxId = t.errMax15;
    if (!phone.trim()) fe.phone = req;
    else if (digits(phone).length < 7 || digits(phone).length > 15) fe.phone = t.errPhone;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fe.email = t.errEmail;
    if (!password.trim()) fe.password = req;
    setFieldErr(fe);
    if (Object.keys(fe).length > 0) {
      setError(t.errFix);
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
    // Email the request to the team (team #7, item 7). Best-effort — a network
    // failure must not block the user's confirmation screen.
    registerRequest({
      firstName: name,
      lastName,
      email,
      phone,
      companyName: company,
      taxId,
      title,
      employeeCount: employeeCount || undefined
    }).catch(() => {});
    goto("verify");
    setSubmitting(false);
  };

  const onOtpComplete = async (code: string) => {
    if (code.length !== 6) return;
    setSubmitting(true);
    setError("");
    try {
      // Step 2: verify the OTP against the backend → logs in (team #8).
      await verifyOtp(email, code);
      enterDashboard();
    } catch (e) {
      setSubmitting(false);
      if (e instanceof AuthError) {
        setError(e.message || (t.errOtp));
      } else if (DEV_MODE) {
        // Backend unreachable in local dev → local sign-in.
        try {
          await signIn(email, password || code, { name });
          enterDashboard();
        } catch {
          setError(t.errOtp);
        }
      } else {
        setError(t.errOtp);
      }
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
                label={t.firstName}
                value={name}
                onChange={setName}
                placeholder="Aysel"
                error={!!fieldErr.name}
                errorText={fieldErr.name}
              />
              <HMField
                icon="user"
                label={t.lastName}
                value={lastName}
                onChange={setLastName}
                placeholder="Məmmədova"
                error={!!fieldErr.lastName}
                errorText={fieldErr.lastName}
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
                error={!!fieldErr.company}
                errorText={fieldErr.company}
              />
              <HMField
                icon="building"
                label={t.taxId}
                value={taxId}
                onChange={(v) => setTaxId(digits(v))}
                placeholder="1702458891"
                inputMode="numeric"
                maxLength={15}
                error={!!fieldErr.taxId}
                errorText={fieldErr.taxId}
              />
            </div>
            <HMField
              icon="mail"
              label={t.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
              error={!!fieldErr.email}
              errorText={fieldErr.email}
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
                label={t.phone}
                value={phone}
                onChange={(v) => setPhone(phoneChars(v))}
                placeholder="+994 50 000 00 00"
                inputMode="tel"
                error={!!fieldErr.phone}
                errorText={fieldErr.phone}
              />
              <HMField
                icon="user"
                label={t.title}
                value={title}
                onChange={setTitle}
                placeholder="Director"
                error={!!fieldErr.title}
                errorText={fieldErr.title}
              />
            </div>
            <HMField
              icon="building"
              label={t.employeeCount}
              value={employeeCount}
              onChange={(v) => setEmployeeCount(digits(v))}
              placeholder={t.optional}
              inputMode="numeric"
            />
            <HMField
              icon="lock"
              label={t.password}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t.passwordPlaceholder}
              error={!!fieldErr.password}
              errorText={fieldErr.password}
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
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={hmStyles.link}>
                {t.agreeTerms}
              </a>{" "}
              {t.agreeAnd}{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={hmStyles.link}>
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
          <h1 style={hmStyles.h1}>{t.requestReceivedTitle}</h1>
          <p style={hmStyles.sub}>{t.requestReceivedBody}</p>
          {/* The account doesn't exist until a super admin approves it, so the
              only sensible action here is going back to sign-in. (The old
              screen offered "continue" into the dashboard plus a dead "resend"
              button — neither applied to an approval-gated request.) */}
          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              onClick={() => goto("signin")}
            >
              <HMIcon name="arrow-left" size={15} /> {t.backToSignIn}
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
  autoFocus,
  error = false,
  errorText,
  maxLength,
  inputMode
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
  error?: boolean;
  errorText?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel";
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
      <div className="hm-input-wrap" style={error ? { borderColor: "var(--err-500)", boxShadow: "0 0 0 3px var(--err-50)" } : undefined}>
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
          maxLength={maxLength}
          inputMode={inputMode}
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
      {error && errorText && (
        <span style={{ marginTop: 4, fontSize: 11.5, color: "var(--err-500)", fontWeight: 600 }}>{errorText}</span>
      )}
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
