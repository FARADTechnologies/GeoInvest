// Token-based auth helpers.
// In this prototype we don't have a real backend yet — `signIn` accepts any
// non-empty credentials. When the FastAPI backend exposes POST /api/auth/login,
// swap the body of signIn() to a real fetch and keep the same return contract.

const STORAGE_KEY = "homora-auth-token";
const USER_KEY = "homora-auth-user";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

async function detail(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { detail?: string }).detail ?? "";
  } catch {
    return "";
  }
}

export type LoginResult =
  | { otpRequired: true; email: string }
  | { otpRequired: false; user: AuthUser };

// Persist the token + user returned by the backend and shape it into AuthUser.
// Shared by the direct login (seed admin) and the OTP verification step.
function storeSession(
  token: string,
  u: { email: string; name: string; role: string }
): AuthUser {
  const user: AuthUser = {
    email: u.email,
    name: u.name || u.email.split("@")[0],
    initials: deriveInitials(u.email, u.name),
    role: (u.role as AuthUser["role"]) ?? "company_admin",
    companyId: "company-caspian",
    permissions: ["dashboard:read", "reports:export", "users:manage", "companies:manage"]
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota errors */
  }
  return user;
}

// Step 1 (team #8): verify email+password on the backend. Normally it emails a
// 6-digit OTP and returns { otp_required: true } without logging in. The seed
// admin (dev access) instead gets a token immediately ({ otp_required: false });
// we persist the session and report otpRequired:false so the caller can enter
// the dashboard directly. Throws AuthError on bad creds.
export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Giriş alınmadı");
  const data = (await res.json()) as {
    otp_required?: boolean;
    token?: string;
    email?: string;
    user?: { email: string; name: string; role: string };
  };
  if (data.otp_required === false && data.token && data.user) {
    const user = storeSession(data.token, data.user);
    return { otpRequired: false, user };
  }
  return { otpRequired: true, email: data.email ?? email };
}

// Step 2: verify the OTP; on success stores the token + user and returns it.
export async function verifyOtp(email: string, code: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, code })
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "OTP yanlışdır");
  const data = (await res.json()) as { token: string; user: { email: string; name: string; role: string } };
  return storeSession(data.token, data.user);
}

// Create the pending account (team #7). Throws AuthError so the form can show
// why it failed — most usefully 409 "this email is already registered".
export async function registerRequest(data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Müraciət göndərilmədi");
}

// ── Super-admin account approval (team: pending-account flow) ─────────
export type PendingAccount = { email: string; name: string; created_at: string };

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Accounts waiting for super-admin approval. */
export async function fetchPendingAccounts(): Promise<PendingAccount[]> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/pending`, {
    headers: { Accept: "application/json", ...authHeaders() }
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Siyahı alınmadı");
  return ((await res.json()) as { items: PendingAccount[] }).items ?? [];
}

/** Approve ("active") or turn down ("rejected") a pending account. */
export async function setAccountStatus(
  email: string,
  status: "active" | "rejected"
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email, status })
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Əməliyyat alınmadı");
}

// ── User directory (super admin) ──────────────────────────────────────
export type DirectoryUser = {
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string | null;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Əməliyyat alınmadı");
  return (await res.json()) as T;
}

/** Every account on the platform. */
export async function fetchUsers(): Promise<DirectoryUser[]> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/users`, {
    headers: { Accept: "application/json", ...authHeaders() }
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Siyahı alınmadı");
  return ((await res.json()) as { items: DirectoryUser[] }).items ?? [];
}

export function setUserRole(email: string, role: string) {
  return postJson<DirectoryUser>("/auth/user/role", { email, role });
}

export function setUserStatus(email: string, status: string) {
  return postJson<DirectoryUser>("/auth/user/status", { email, status });
}

// ── Own account ───────────────────────────────────────────────────────
export function updateProfile(name: string) {
  return postJson<DirectoryUser>("/auth/profile", { name });
}

export function changePassword(current_password: string, new_password: string) {
  return postJson<{ ok: boolean }>("/auth/change-password", {
    current_password,
    new_password
  });
}

/** Revoke the session server-side, then clear it locally. */
export async function signOutEverywhere(): Promise<void> {
  try {
    await postJson<{ ok: boolean }>("/auth/logout", {});
  } catch {
    /* the local session is cleared regardless */
  }
  signOut();
}

export type AuthUser = {
  email: string;
  name: string;
  initials: string;
  role: "super_admin" | "company_admin" | "employee";
  companyId: string;
  permissions: string[];
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function isAuthed(): boolean {
  return Boolean(getToken());
}

function deriveInitials(email: string, name?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase().slice(0, 2);
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "AD";
}

/**
 * Sign in. Mock implementation:
 *  - empty fields → throw
 *  - everything else → accept, mint a fake token
 *
 * Replace with real fetch when backend lands:
 *   const res = await fetch("/api/auth/login", { method: "POST", ... });
 *   if (!res.ok) throw new Error("Invalid credentials");
 *   const { token, user } = await res.json();
 */
export async function signIn(
  email: string,
  password: string,
  opts: { name?: string } = {}
): Promise<AuthUser> {
  if (!email.trim() || !password.trim()) {
    throw new Error("EMPTY_CREDENTIALS");
  }

  // Simulate network latency so loading states render.
  await new Promise((r) => setTimeout(r, 350));

  const user: AuthUser = {
    email: email.trim(),
    name: opts.name?.trim() || email.split("@")[0],
    initials: deriveInitials(email, opts.name),
    role: email.trim().toLowerCase().includes("admin") ? "super_admin" : "company_admin",
    companyId: "company-caspian",
    permissions: ["dashboard:read", "reports:export", "users:manage", "companies:manage"]
  };
  const fakeToken = "local." + btoa(`${email}:${Date.now()}`);

  try {
    window.localStorage.setItem(STORAGE_KEY, fakeToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota errors in private mode */
  }
  return user;
}

export function signOut(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}
