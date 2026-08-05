// Homora.ai — Super Admin (B2B) types + presentation helpers.
//
// This file used to build the customer list itself: ten companies carrying the
// names and VÖEN numbers of real Azerbaijani banks, each with a generated
// staff roster, seat count, MAU and API-call volume, and one of them marked
// "blocked". None of it existed — and attributing an account status to a named
// real bank is worse than showing nothing. The generator is gone.
//
// There is no companies table behind the platform yet (tracker S6). Until the
// team provides one, the Companies tab renders an empty state; the account
// requests and the user directory next to it are already real (/auth/pending,
// /auth/users).

export type Role = "Admin" | "Data Scientist" | "Data Analyst" | "İzləyici";

export type SuperUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "blocked";
  lastSeen: string;
};

export type SuperCompany = {
  id: string;
  name: string;
  short: string;
  title: string; // legal form: MMC / ASC / QSC / KB ASC
  voen: string;
  sector: string;
  plan: "Starter" | "Pro" | "Enterprise";
  status: "active" | "blocked" | "pending";
  employees: number;
  seats: number;
  activeUsers: number;
  mau: number;
  apiCalls: number;
  created: string;
  adminName: string;
  adminEmail: string;
  users: SuperUser[];
};

export type SuperRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  voen: string;
  title: string;
  employees: number;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
};

export const ROLES: Role[] = ["Admin", "Data Scientist", "Data Analyst", "İzləyici"];
export const SECTORS = ["Bank", "İnvestisiya", "Daşınmaz əmlak", "Tikinti", "Sığorta", "Digər"];
export const PLANS: SuperCompany["plan"][] = ["Starter", "Pro", "Enterprise"];

// Deterministic brand color per company (mirrors prototype brandColor()).
const PALETTE = ["#1e4fd6", "#0e8a6a", "#b4452a", "#7c3aed", "#0891b2", "#c026a3", "#475569", "#b45309"];
export function brandColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function monogram(name: string) {
  const words = name.replace(/—.*/, "").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const SUPER_COMPANIES: SuperCompany[] = [];
export const SUPER_REQUESTS: SuperRequest[] = [];
