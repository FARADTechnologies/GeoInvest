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

// Step 1 (team #8): verify email+password on the backend; on success it emails
// a 6-digit OTP and returns without logging in. Throws AuthError on bad creds.
export async function loginRequest(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new AuthError(res.status, (await detail(res)) || "Giriş alınmadı");
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
  const user: AuthUser = {
    email: data.user.email,
    name: data.user.name || data.user.email.split("@")[0],
    initials: deriveInitials(data.user.email, data.user.name),
    role: (data.user.role as AuthUser["role"]) ?? "company_admin",
    companyId: "company-caspian",
    permissions: ["dashboard:read", "reports:export", "users:manage", "companies:manage"]
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, data.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota errors */
  }
  return user;
}

// Fire the account request to the team (team #7, item 7). Best-effort.
export async function registerRequest(data: Record<string, unknown>): Promise<void> {
  await fetch(`${API_BASE_URL}${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
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
  const fakeToken = "demo." + btoa(`${email}:${Date.now()}`);

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
