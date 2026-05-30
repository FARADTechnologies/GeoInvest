import type { AccountRequest, Company } from "@/types/admin";

const REQUESTS_KEY = "homora-account-requests";

const SEEDED_REQUESTS: AccountRequest[] = [
  {
    id: "req-001",
    firstName: "Aysel",
    lastName: "Mammadova",
    email: "aysel@caspianinvest.az",
    phone: "+994 50 222 14 88",
    companyName: "Caspian Invest",
    taxId: "1702458891",
    title: "Investment Director",
    password: "********",
    employeeCount: "42",
    status: "pending",
    createdAt: "2026-05-29T10:30:00.000Z"
  },
  {
    id: "req-002",
    firstName: "Rauf",
    lastName: "Aliyev",
    email: "rauf@urbanline.az",
    phone: "+994 55 640 20 10",
    companyName: "Urban Line",
    taxId: "1508832012",
    title: "Commercial Lead",
    password: "********",
    employeeCount: "18",
    status: "pending",
    createdAt: "2026-05-28T15:15:00.000Z"
  }
];

export const COMPANIES: Company[] = [
  {
    id: "company-caspian",
    name: "Caspian Realty",
    taxId: "1304459021",
    adminName: "Maqsud Aydayev",
    adminEmail: "admin@homora.ai",
    employeeCount: 64,
    activeUsers: 51,
    status: "active",
    plan: "Enterprise",
    lastLogin: "Bugun 09:42",
    users: [
      { id: "u-1", name: "Maqsud Aydayev", email: "admin@homora.ai", role: "Director", status: "active", lastLogin: "Bugun 09:42" },
      { id: "u-2", name: "Leyla Huseynova", email: "leyla@caspian.az", role: "Data Scientist", status: "active", lastLogin: "Dunen 18:10" },
      { id: "u-3", name: "Nihad Karimov", email: "nihad@caspian.az", role: "Sales", status: "active", lastLogin: "2 gun once" }
    ],
    auditLog: ["Role changed: Leyla -> Data Scientist", "Report exported: May market pulse", "User invited: Nihad Karimov"]
  },
  {
    id: "company-absheron",
    name: "Absheron Advisory",
    taxId: "1601190084",
    adminName: "Farid Ismayilov",
    adminEmail: "farid@absheron.az",
    employeeCount: 27,
    activeUsers: 19,
    status: "trial",
    plan: "Growth",
    lastLogin: "Dunen 16:04",
    users: [
      { id: "u-4", name: "Farid Ismayilov", email: "farid@absheron.az", role: "Manager", status: "active", lastLogin: "Dunen 16:04" },
      { id: "u-5", name: "Gunel Rahimli", email: "gunel@absheron.az", role: "Data Analyst", status: "active", lastLogin: "3 gun once" }
    ],
    auditLog: ["Trial extended", "Alert rule created: Sabail +5%", "User invited: Gunel Rahimli"]
  },
  {
    id: "company-bakuprime",
    name: "Baku Prime Estates",
    taxId: "1903361180",
    adminName: "Samir Quliyev",
    adminEmail: "samir@bakuprime.az",
    employeeCount: 12,
    activeUsers: 0,
    status: "blocked",
    plan: "Starter",
    lastLogin: "2026-05-16",
    users: [
      { id: "u-6", name: "Samir Quliyev", email: "samir@bakuprime.az", role: "Manager", status: "blocked", lastLogin: "2026-05-16" }
    ],
    auditLog: ["Company blocked", "Payment failed", "Admin notified"]
  }
];

export function getAccountRequests(): AccountRequest[] {
  if (typeof window === "undefined") return SEEDED_REQUESTS;
  try {
    const raw = window.localStorage.getItem(REQUESTS_KEY);
    const stored = raw ? (JSON.parse(raw) as AccountRequest[]) : [];
    return [...stored, ...SEEDED_REQUESTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return SEEDED_REQUESTS;
  }
}

export function submitAccountRequest(
  request: Omit<AccountRequest, "id" | "status" | "createdAt">
): AccountRequest {
  const next: AccountRequest = {
    ...request,
    id: `req-${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(REQUESTS_KEY);
      const current = raw ? (JSON.parse(raw) as AccountRequest[]) : [];
      window.localStorage.setItem(REQUESTS_KEY, JSON.stringify([next, ...current]));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}
