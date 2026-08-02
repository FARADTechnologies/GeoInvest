"use client";

// Homora.ai — Super Admin console. 1:1 port of homora-v4/views-admin.jsx
// (AdminView + CompanyDrawer + AddCompany). Scoped under .hm-v3; styles in
// v3-views.css (shared) + admin.css (admin-specific). Text routed through
// t.* so it localizes to TR / EN / AZ. Design unchanged from the prototype.

import {
  ArrowRight,
  Ban,
  Building2,
  Check,
  Download,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  Users,
  X
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import {
  fetchPendingAccounts,
  setAccountStatus,
  type PendingAccount
} from "@/lib/auth";

import {
  brandColor,
  monogram,
  PLANS,
  ROLES,
  SECTORS,
  SUPER_COMPANIES,
  SUPER_REQUESTS,
  type Role,
  type SuperCompany,
  type SuperRequest
} from "@/lib/super-admin-data";
import "@/components/dashboard/v3-views.css";
import "@/components/dashboard/admin.css";

const nf = (n: number) => Math.round(n).toLocaleString("az-AZ").replace(/,/g, " ");

function Badge({ tone = "muted", children }: { tone?: string; children: ReactNode }) {
  return <span className={`hm-badge hm-badge-${tone}`}>{children}</span>;
}

function Card({
  title,
  sub,
  action,
  pad = true,
  children
}: {
  title?: string;
  sub?: string;
  action?: ReactNode;
  pad?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="hm-card">
      {(title || action) && (
        <div className="hm-card-head">
          <div style={{ minWidth: 0 }}>
            {title && <div className="hm-card-title">{title}</div>}
            {sub && <div className="hm-card-sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={pad ? "hm-card-body" : ""}>{children}</div>
    </div>
  );
}

function Logo({ name, size = 34 }: { name: string; size?: number }) {
  const c = brandColor(name);
  return (
    <span
      className="hm-logo-mono"
      style={{ width: size, height: size, background: c + "1a", color: c, fontSize: size * 0.36 }}
    >
      {monogram(name)}
    </span>
  );
}

type AddForm = {
  name: string;
  short: string;
  title: string;
  voen: string;
  sector: string;
  plan: SuperCompany["plan"];
  adminName: string;
  adminEmail: string;
  emp: number;
};

export function AdminView({ t }: { t: Record<string, string> }) {
  // Real accounts awaiting super-admin approval (backend /auth/pending).
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [acctLoading, setAcctLoading] = useState(true);
  const [acctErr, setAcctErr] = useState("");
  const [acctBusy, setAcctBusy] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setAcctLoading(true);
    setAcctErr("");
    try {
      setAccounts(await fetchPendingAccounts());
    } catch (e) {
      setAcctErr(e instanceof Error ? e.message : "…");
    }
    setAcctLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const decide = async (email: string, status: "active" | "rejected") => {
    setAcctBusy(email);
    try {
      await setAccountStatus(email, status);
      setAccounts((prev) => prev.filter((a) => a.email !== email));
      setToast(
        `${email} · ${status === "active" ? (t.admApproved ?? "") : (t.admRejected ?? "")}`
      );
    } catch (e) {
      setAcctErr(e instanceof Error ? e.message : "…");
    }
    setAcctBusy(null);
  };

  const [reqs, setReqs] = useState<SuperRequest[]>(() => SUPER_REQUESTS.map((r) => ({ ...r })));
  const [companies, setCompanies] = useState<SuperCompany[]>(() => SUPER_COMPANIES.map((c) => ({ ...c })));
  const [openCo, setOpenCo] = useState<string | null>(null);
  const [tab, setTab] = useState<"companies" | "requests">("companies");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  };

  const addCompany = (f: AddForm) => {
    const id = "C" + (Date.now() % 100000);
    setCompanies((cs) => [
      {
        id,
        name: f.name,
        short: f.short || f.name,
        title: f.title,
        voen: f.voen,
        sector: f.sector,
        plan: f.plan,
        status: "active",
        employees: f.emp || 1,
        seats: (f.emp || 1) + 4,
        activeUsers: 1,
        mau: 1,
        apiCalls: 0,
        created: new Date().toISOString().slice(0, 10),
        adminName: f.adminName,
        adminEmail: f.adminEmail,
        users: [
          { id: "U" + id, name: f.adminName, email: f.adminEmail, role: "Admin", status: "active", lastSeen: "yeni" }
        ]
      },
      ...cs
    ]);
  };

  const setReqStatus = (id: string, status: SuperRequest["status"]) => {
    const r = reqs.find((x) => x.id === id);
    setReqs(reqs.map((x) => (x.id === id ? { ...x, status } : x)));
    if (status === "approved" && r) {
      addCompany({
        name: r.company,
        short: r.company,
        title: "MMC",
        voen: r.voen,
        sector: "Digər",
        plan: "Starter",
        adminName: r.firstName + " " + r.lastName,
        adminEmail: r.email,
        emp: r.employees
      });
      flash(`${r.company} ${t.admApprovedToast ?? "onaylandı ve müşteri olarak eklendi"}`);
    } else if (status === "rejected") {
      flash(t.admRejectedToast ?? "Talep reddedildi");
    }
  };

  const toggleBlock = (id: string) => {
    setCompanies((cs) =>
      cs.map((c) => (c.id === id ? { ...c, status: c.status === "blocked" ? "active" : "blocked" } : c))
    );
    setMenuId(null);
  };
  const removeCompany = (id: string) => {
    setCompanies((cs) => cs.filter((c) => c.id !== id));
    setMenuId(null);
    setOpenCo(null);
    flash(t.admRemovedToast ?? "Şirket sistemden çıkarıldı");
  };
  const setUserRole = (coId: string, uId: string, role: Role) =>
    setCompanies((cs) =>
      cs.map((c) => (c.id === coId ? { ...c, users: c.users.map((u) => (u.id === uId ? { ...u, role } : u)) } : c))
    );
  const toggleUser = (coId: string, uId: string) =>
    setCompanies((cs) =>
      cs.map((c) =>
        c.id === coId
          ? { ...c, users: c.users.map((u) => (u.id === uId ? { ...u, status: u.status === "blocked" ? "active" : "blocked" } : u)) }
          : c
      )
    );

  const pending = reqs.filter((r) => r.status === "pending").length;
  const totalEmp = companies.reduce((s, c) => s + c.employees, 0);
  const totalMau = companies.reduce((s, c) => s + c.mau, 0);
  const stats = [
    { k: t.admStatCompanies ?? "Müşteri şirket", v: companies.length, d: t.admStatCompaniesD ?? "+2 bu ay" },
    {
      k: t.admStatLicenses ?? "Aktif lisans",
      v: companies.filter((c) => c.status === "active").length,
      d: `${companies.filter((c) => c.status === "blocked").length} ${t.admBlockedSuffix ?? "bloklu"}`
    },
    { k: t.admStatUsers ?? "Toplam kullanıcı", v: totalEmp, d: t.admStatUsersD ?? "tüm şirketler" },
    {
      k: t.admStatMau ?? "Aylık aktif (MAU)",
      v: totalMau,
      d: `${totalEmp ? Math.round((totalMau / totalEmp) * 100) : 0}% ${t.admEngagement ?? "etkileşim"}`
    },
    {
      k: t.admStatPending ?? "Bekleyen talep",
      v: pending,
      d: pending ? (t.admReviewNeeded ?? "incelenmeli") : (t.admClean ?? "temiz"),
      warn: pending > 0
    }
  ];

  const co = openCo ? companies.find((c) => c.id === openCo) ?? null : null;
  const coStatus: Record<SuperCompany["status"], [string, string]> = {
    active: ["ok", t.statusActiveCo ?? "Aktif"],
    pending: ["warn", t.statusPendingCo ?? "Beklemede"],
    blocked: ["err", t.statusBlockedCo ?? "Bloklu"]
  };

  const rows = companies.filter(
    (c) =>
      (sector === "all" || c.sector === sector) &&
      (statusF === "all" || c.status === statusF) &&
      (q === "" || (c.name + c.voen + c.adminName).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="hm-v3 hm-admin" onClick={() => setMenuId(null)}>
      {/* header */}
      <div className="hm-admin-head">
        <div>
          <div className="hm-admin-eyebrow">
            <Shield size={13} /> {t.admEyebrow ?? "Süper Admin Konsolu"}
          </div>
          <h2 className="hm-admin-h2">{t.admTitle ?? "Müşteri & Lisans Yönetimi"}</h2>
        </div>
        <div className="hm-admin-head-actions">
          <button className="hm-btn-ghost lg">
            <Download size={15} /> {t.admReport ?? "Rapor"}
          </button>
          <button
            className="hm-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              setAddOpen(true);
            }}
          >
            <Building2 size={15} /> {t.admAddCompany ?? "Şirkət əlavə et"}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="hm-admin-stats">
        {stats.map((s) => (
          <div className="hm-astat" key={s.k}>
            <div className="hm-astat-k">{s.k}</div>
            <div className="hm-astat-v">{nf(s.v)}</div>
            <div className={"hm-astat-d " + (s.warn ? "warn" : "")}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="hm-tabs">
        <button
          className={tab === "companies" ? "on" : ""}
          onClick={(e) => {
            e.stopPropagation();
            setTab("companies");
          }}
        >
          {t.admTabCompanies ?? "Müşteri Şirketler"} <span className="hm-tab-count">{companies.length}</span>
        </button>
        <button
          className={tab === "requests" ? "on" : ""}
          onClick={(e) => {
            e.stopPropagation();
            setTab("requests");
          }}
        >
          {t.admTabRequests ?? "Hesap Talepleri"} {pending > 0 && <span className="hm-tab-pill">{pending}</span>}
        </button>
      </div>

      {tab === "companies" && (
        <Card
          pad={false}
          title={t.admTabCompanies ?? "Müşteri Şirketler"}
          sub={`${rows.length} ${t.admCompaniesSub ?? "şirket · platformu kullanan tüm B2B müşterileri"}`}
          action={
            <div className="hm-toolbar" onClick={(e) => e.stopPropagation()}>
              <div className="hm-search-sm">
                <Search size={14} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.admSearchPh ?? "Şirkət, VÖEN, admin…"} />
              </div>
              <select className="hm-select" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="all">{t.admAllSectors ?? "Tüm sektör"}</option>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select className="hm-select" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
                <option value="all">{t.admAllStatus ?? "Tüm durum"}</option>
                <option value="active">{t.statusActiveCo ?? "Aktif"}</option>
                <option value="blocked">{t.statusBlockedCo ?? "Bloklu"}</option>
                <option value="pending">{t.statusPendingCo ?? "Beklemede"}</option>
              </select>
            </div>
          }
        >
          <div className="hm-table-wrap">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>{t.admColCompany ?? "Şirkət"}</th>
                  <th>{t.admColSector ?? "Sektor"}</th>
                  <th>VÖEN</th>
                  <th>{t.admColAdmin ?? "Admin (rəhbər)"}</th>
                  <th className="num">{t.admColUsers ?? "İstifadəçi"}</th>
                  <th>{t.admColLicense ?? "Lisans"}</th>
                  <th>{t.admColStatus ?? "Durum"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => setOpenCo(c.id)}>
                    <td>
                      <div className="hm-co-cell">
                        <Logo name={c.short || c.name} />
                        <div style={{ minWidth: 0 }}>
                          <b>{c.short || c.name}</b>
                          <div className="hm-cell-sub">{c.title} · {c.created}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{c.sector}</td>
                    <td className="muted mono">{c.voen}</td>
                    <td>
                      <div>{c.adminName}</div>
                      <div className="hm-cell-sub">{c.adminEmail}</div>
                    </td>
                    <td className="num">
                      {c.activeUsers}
                      <span className="muted">/{c.seats}</span>
                    </td>
                    <td>
                      <Badge tone={c.plan === "Enterprise" ? "brand" : c.plan === "Pro" ? "info" : "muted"}>{c.plan}</Badge>
                    </td>
                    <td>
                      <span className={"hm-dot hm-dot-" + coStatus[c.status][0]} />
                      {coStatus[c.status][1]}
                    </td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <div className="hm-kebab-wrap">
                        <button
                          className="hm-icon-btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === c.id ? null : c.id);
                          }}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuId === c.id && (
                          <div className="hm-kebab" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setOpenCo(c.id); setMenuId(null); }}>
                              <ArrowRight size={14} /> {t.admMenuOpen ?? "Detayı aç"}
                            </button>
                            <button onClick={() => { setOpenCo(c.id); setMenuId(null); }}>
                              <Users size={14} /> {t.admMenuRoles ?? "Rolleri yönet"}
                            </button>
                            <button onClick={() => toggleBlock(c.id)}>
                              <Ban size={14} /> {c.status === "blocked" ? (t.admUnblock ?? "Engeli kaldır") : (t.admBlock ?? "Blokla")}
                            </button>
                            <div className="hm-kebab-sep" />
                            <button className="danger" onClick={() => removeCompany(c.id)}>
                              <X size={14} /> {t.admMenuRemove ?? "Sistemden çıkar"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "requests" && (
        <Card title={t.admReqTitle} sub={t.admReqSub}>
          {/* Real pending accounts from the backend. This used to render the
              SUPER_REQUESTS demo array; a super admin acting on fake rows
              would have been meaningless, so it now drives /auth/pending. */}
          {acctErr ? (
            <div className="hm-empty">
              <X size={22} />
              <span>{acctErr}</span>
            </div>
          ) : acctLoading ? (
            <div className="hm-empty">
              <span>{t.loading}…</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="hm-empty">
              <Check size={22} />
              <span>{t.admNoRequests}</span>
            </div>
          ) : (
            <div className="hm-req-list">
              {accounts.map((a) => (
                <div className="hm-req" key={a.email}>
                  <Logo name={a.name || a.email} size={42} />
                  <div className="hm-req-main">
                    <div className="hm-req-name">{a.name || a.email}</div>
                    <div className="hm-req-contact">{a.email}</div>
                  </div>
                  <div className="hm-req-meta">
                    <span className="muted">{a.created_at.slice(0, 10)}</span>
                  </div>
                  <div className="hm-req-actions">
                    <button
                      className="hm-btn-ok"
                      disabled={acctBusy === a.email}
                      onClick={() => decide(a.email, "active")}
                    >
                      <Check size={14} /> {t.approve}
                    </button>
                    <button
                      className="hm-btn-err"
                      disabled={acctBusy === a.email}
                      onClick={() => decide(a.email, "rejected")}
                    >
                      <X size={14} /> {t.reject}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {co && (
        <CompanyDrawer
          t={t}
          co={co}
          status={coStatus}
          onClose={() => setOpenCo(null)}
          onToggleBlock={() => toggleBlock(co.id)}
          onRemove={() => removeCompany(co.id)}
          onRole={setUserRole}
          onToggleUser={toggleUser}
        />
      )}
      {addOpen && (
        <AddCompany
          t={t}
          onClose={() => setAddOpen(false)}
          onSubmit={(f) => {
            addCompany(f);
            setAddOpen(false);
            flash(`${f.name} ${t.admAddedToast ?? "müşteri olarak eklendi"}`);
          }}
        />
      )}
      {toast && (
        <div className="hm-toast">
          <Check size={15} /> {toast}
        </div>
      )}
    </div>
  );
}

function CompanyDrawer({
  t,
  co,
  status,
  onClose,
  onToggleBlock,
  onRemove,
  onRole,
  onToggleUser
}: {
  t: Record<string, string>;
  co: SuperCompany;
  status: Record<SuperCompany["status"], [string, string]>;
  onClose: () => void;
  onToggleBlock: () => void;
  onRemove: () => void;
  onRole: (coId: string, uId: string, role: Role) => void;
  onToggleUser: (coId: string, uId: string) => void;
}) {
  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div className="hm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hm-drawer-head">
          <div className="hm-co-cell">
            <Logo name={co.short || co.name} size={46} />
            <div>
              <div className="hm-drawer-title">
                {co.short || co.name} <span className={"hm-dot hm-dot-" + status[co.status][0]} />
                <span className="hm-drawer-status">{status[co.status][1]}</span>
              </div>
              <div className="hm-drawer-sub">
                {co.name} · {co.title} · VÖEN {co.voen} · {co.sector}
              </div>
            </div>
          </div>
          <button className="hm-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="hm-drawer-stats">
          <div><span>{t.admDrPlan ?? "Lisans planı"}</span><b>{co.plan}</b></div>
          <div><span>{t.admColUsers ?? "İstifadəçi"}</span><b>{co.activeUsers}/{co.seats}</b></div>
          <div><span>MAU</span><b>{co.mau}</b></div>
          <div><span>{t.admDrApi ?? "API çağrı (ay)"}</span><b>{nf(co.apiCalls)}</b></div>
        </div>
        <div className="hm-drawer-actions">
          <button className="hm-btn-ghost"><Settings size={14} /> {t.admChangePlan ?? "Planı değiştir"}</button>
          <button className="hm-btn-ghost"><Download size={14} /> {t.admExport ?? "Dışa aktar"}</button>
          <button className="hm-btn-warn" onClick={onToggleBlock}>
            <Ban size={14} /> {co.status === "blocked" ? (t.admUnblockCo ?? "Engeli kaldır") : (t.admBlockCo ?? "Şirketi blokla")}
          </button>
          <button className="hm-btn-err" onClick={onRemove}><X size={14} /> {t.admRemove ?? "Çıkar"}</button>
        </div>
        <div className="hm-drawer-sec">
          {t.admEmployeesRoles ?? "Çalışanlar & Roller"} <span className="muted">({co.users.length})</span>
        </div>
        <div className="hm-table-wrap" style={{ padding: "0 12px 22px" }}>
          <table className="hm-table compact">
            <thead>
              <tr>
                <th>{t.admColEmployee ?? "Çalışan"}</th>
                <th>{t.admColRole ?? "Rol"}</th>
                <th>{t.admColLastSeen ?? "Son aktivite"}</th>
                <th>{t.admColStatus ?? "Durum"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {co.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="hm-co-cell">
                      <span className="hm-uava">{u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                      <div>
                        <b>{u.name}</b>
                        <div className="hm-cell-sub">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="hm-role-select"
                      value={u.role}
                      disabled={u.role === "Admin"}
                      onChange={(e) => onRole(co.id, u.id, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="muted">{u.lastSeen}</td>
                  <td>
                    <Badge tone={u.status === "blocked" ? "err" : "ok"}>
                      {u.status === "blocked" ? (t.admBlocked ?? "Bloklu") : (t.admActive ?? "Aktif")}
                    </Badge>
                  </td>
                  <td className="num">
                    {u.role !== "Admin" && (
                      <button className="hm-icon-btn sm" title={t.admBlock ?? "Blokla/Aç"} onClick={() => onToggleUser(co.id, u.id)}>
                        <Ban size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddCompany({
  t,
  onClose,
  onSubmit
}: {
  t: Record<string, string>;
  onClose: () => void;
  onSubmit: (f: AddForm) => void;
}) {
  const [f, setF] = useState<AddForm>({
    name: "",
    short: "",
    title: "MMC",
    voen: "",
    sector: "Bank",
    plan: "Pro",
    adminName: "",
    adminEmail: "",
    emp: 1
  });
  const set = (k: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: k === "emp" ? Number(e.target.value) : e.target.value });
  const valid = Boolean(f.name.trim() && f.voen.trim() && f.adminEmail.trim());

  return (
    <div className="hm-drawer-overlay" onClick={onClose}>
      <div className="hm-modal-card lg" onClick={(e) => e.stopPropagation()}>
        <div className="hm-drawer-head">
          <div>
            <div className="hm-drawer-title">{t.admNewCompany ?? "Yeni Müşteri Şirket"}</div>
            <div className="hm-drawer-sub">{t.admNewCompanySub ?? "Şirketi platforma manuel ekle"}</div>
          </div>
          <button className="hm-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="hm-form">
          <div className="hm-form-row">
            <Field label={t.admFName ?? "Şirkət adı"} wide>
              <input className="hm-input" value={f.name} onChange={set("name")} placeholder="Kapital Bank" />
            </Field>
          </div>
          <div className="hm-form-row">
            <Field label={t.admFShort ?? "Qısa ad"}>
              <input className="hm-input" value={f.short} onChange={set("short")} placeholder="Kapital" />
            </Field>
            <Field label={t.admFLegal ?? "Ünvan (hüquqi)"}>
              <select className="hm-input" value={f.title} onChange={set("title")}>
                <option>MMC</option>
                <option>ASC</option>
                <option>QSC</option>
                <option>KB ASC</option>
              </select>
            </Field>
          </div>
          <div className="hm-form-row">
            <Field label="VÖEN">
              <input className="hm-input" value={f.voen} onChange={set("voen")} placeholder="1700038881" />
            </Field>
            <Field label={t.admColSector ?? "Sektor"}>
              <select className="hm-input" value={f.sector} onChange={set("sector")}>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="hm-form-row">
            <Field label={t.admFPlan ?? "Lisans planı"}>
              <select className="hm-input" value={f.plan} onChange={set("plan")}>
                {PLANS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label={t.admFEmp ?? "Çalışan sayısı"}>
              <input className="hm-input" type="number" min={1} value={f.emp} onChange={set("emp")} />
            </Field>
          </div>
          <div className="hm-form-sep">{t.admFAdminSep ?? "Şirket admini (rəhbər)"}</div>
          <div className="hm-form-row">
            <Field label={t.admFAdminName ?? "Ad Soyad"}>
              <input className="hm-input" value={f.adminName} onChange={set("adminName")} placeholder="Rəşad Əliyev" />
            </Field>
            <Field label={t.admFAdminEmail ?? "E-poçt"}>
              <input className="hm-input" value={f.adminEmail} onChange={set("adminEmail")} placeholder="admin@kapital.az" />
            </Field>
          </div>
        </div>
        <div className="hm-form-foot">
          <button className="hm-btn-ghost" onClick={onClose}>{t.admCancel ?? "Vazgeç"}</button>
          <button className="hm-btn-primary" disabled={!valid} onClick={() => onSubmit(f)}>
            <Check size={15} /> {t.admDoAdd ?? "Şirketi ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={"hm-field " + (wide ? "wide" : "")}>
      <span className="hm-field-lbl">{label}</span>
      {children}
    </label>
  );
}
