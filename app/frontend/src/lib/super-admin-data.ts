// Homora.ai — Super Admin (B2B) seed data. Faithful TS port of
// homora-v4/data.js company/role/request generation. Deterministic seeded
// RNG → reproducible across reloads. Self-contained; does NOT touch the
// signup flow's lib/admin-data.ts.

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

// Mulberry32 seeded RNG (same seed as prototype for identical output).
function rng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aysel", "Rəşad", "Leyla", "Tural", "Nigar", "Elvin", "Günel", "Murad", "Səbinə", "Kamran", "Aytən", "Orxan"];
const LAST = ["Məmmədova", "Əliyev", "Hüseynli", "Quliyev", "Rəhimova", "Cəfərov", "Abbaslı", "Nəbiyeva", "Süleymanlı", "Vəliyeva"];

type CompanyDef = {
  name: string;
  short: string;
  title: string;
  voen: string;
  sector: string;
  plan: SuperCompany["plan"];
  status: SuperCompany["status"];
  emp: number;
};

const COMPANY_DEFS: CompanyDef[] = [
  { name: "ABB — Azərbaycan Beynəlxalq Bankı", short: "ABB", title: "ASC", voen: "9900001948", sector: "Bank", plan: "Enterprise", status: "active", emp: 22 },
  { name: "Kapital Bank", short: "Kapital Bank", title: "ASC", voen: "9900003611", sector: "Bank", plan: "Enterprise", status: "active", emp: 18 },
  { name: "PAŞA Bank", short: "PAŞA Bank", title: "ASC", voen: "1700038881", sector: "Bank", plan: "Enterprise", status: "active", emp: 16 },
  { name: "Yelo Bank", short: "Yelo Bank", title: "ASC", voen: "1300016391", sector: "Bank", plan: "Pro", status: "active", emp: 9 },
  { name: "Unibank", short: "Unibank", title: "KB ASC", voen: "1700088901", sector: "Bank", plan: "Pro", status: "blocked", emp: 11 },
  { name: "PAŞA Holding — Real Estate", short: "PAŞA Holding", title: "MMC", voen: "1402567891", sector: "İnvestisiya", plan: "Enterprise", status: "active", emp: 14 },
  { name: "Caspian Realty", short: "Caspian Realty", title: "MMC", voen: "1305991240", sector: "Daşınmaz əmlak", plan: "Pro", status: "active", emp: 7 },
  { name: "Bank Respublika", short: "Bank Respublika", title: "ASC", voen: "1500037601", sector: "Bank", plan: "Pro", status: "active", emp: 8 },
  { name: "AccessBank", short: "AccessBank", title: "QSC", voen: "1400057421", sector: "Bank", plan: "Starter", status: "active", emp: 5 },
  { name: "Yeni Şəhər Tikinti", short: "Yeni Şəhər", title: "ASC", voen: "1408720193", sector: "Tikinti", plan: "Starter", status: "pending", emp: 4 }
];

const R = rng(20260530);
const pick = <T,>(arr: T[]): T => arr[Math.floor(R() * arr.length)];
const between = (lo: number, hi: number) => lo + R() * (hi - lo);
const slugFor = (c: CompanyDef) => (c.short || c.name).toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) || "co";
const translit = (s: string) =>
  s.toLowerCase().replace(/ə/g, "e").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");

function buildCompanies(): SuperCompany[] {
  let uid = 0;
  return COMPANY_DEFS.map((c, ci) => {
    const slug = slugFor(c);
    const users: SuperUser[] = [];
    for (let i = 0; i < c.emp; i++) {
      const fn = pick(FIRST);
      const ln = pick(LAST);
      users.push({
        id: "U" + ++uid,
        name: fn + " " + ln,
        email: translit(fn[0] + "." + ln) + "@" + slug + ".az",
        role: i === 0 ? "Admin" : (pick(ROLES.slice(1)) as Role),
        status: R() < 0.1 ? "blocked" : "active",
        lastSeen: pick(["5 dq", "1 saat", "3 saat", "dünən", "2 gün", "1 həftə"])
      });
    }
    const mau = Math.round(c.emp * between(0.55, 0.95));
    return {
      id: "C" + (ci + 1),
      name: c.name,
      short: c.short,
      title: c.title,
      voen: c.voen,
      sector: c.sector,
      plan: c.plan,
      status: c.status,
      employees: c.emp,
      seats: Math.max(c.emp + (c.plan === "Enterprise" ? 10 : c.plan === "Pro" ? 4 : 1), c.emp),
      activeUsers: users.filter((u) => u.status === "active").length,
      mau,
      apiCalls: Math.round(between(2, 40) * 1000),
      created: pick(["2025-06-14", "2025-09-12", "2025-11-03", "2026-01-20", "2026-02-14", "2026-03-30"]),
      adminName: users[0].name,
      adminEmail: users[0].email,
      users
    };
  });
}

export const SUPER_COMPANIES: SuperCompany[] = buildCompanies();

export const SUPER_REQUESTS: SuperRequest[] = [
  { id: "R1", firstName: "Elçin", lastName: "Hacıyev", email: "elcin@metro-realty.az", phone: "+994 50 412 33 21", company: "Metro Realty", voen: "1602773410", title: "Direktor", employees: 8, submittedAt: "2026-05-29", status: "pending" },
  { id: "R2", firstName: "Səbinə", lastName: "Qədirova", email: "sabina@bayview.az", phone: "+994 51 998 76 54", company: "Bay View Estates", voen: "1709004412", title: "CEO", employees: 5, submittedAt: "2026-05-28", status: "pending" },
  { id: "R3", firstName: "Tural", lastName: "Əhmədli", email: "tural@nardenco.az", phone: "+994 55 220 11 09", company: "Narden Construction", voen: "1310558820", title: "İnvestisiya rəhbəri", employees: 12, submittedAt: "2026-05-27", status: "pending" }
];
