// Homora.ai — v3 mock listings generator (TS port of homora-v3/data.js).
// Seeded RNG → reproducible LISTINGS / RAYON_STATS / B2C_SUMMARY across reloads.
// Feeds ONLY the Rayons / Listings / B2C views. Does NOT touch the
// Overview / Map fallback data (those live in lib/mock-data.ts).

import type { B2CSummary, Listing, RayonStat } from "@/types/api";

// Mulberry32 seeded RNG
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

const R = rng(20260530);
const pick = <T,>(arr: T[]): T => arr[Math.floor(R() * arr.length)];
const between = (lo: number, hi: number) => lo + R() * (hi - lo);
const gauss = (mean: number, sd: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = R();
  while (v === 0) v = R();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

type RayonSeed = {
  id: string;
  name: string;
  base: number;
  trend: number;
  col: number;
  row: number;
};

const RAYONS: RayonSeed[] = [
  { id: "bineqedi", name: "Binəqədi", base: 2480, trend: -0.8, col: 0, row: 0 },
  { id: "yasamal", name: "Yasamal", base: 2880, trend: 1.4, col: 1, row: 0 },
  { id: "nesimi", name: "Nəsimi", base: 3450, trend: 4.2, col: 2, row: 0 },
  { id: "sabuncu", name: "Sabunçu", base: 4363, trend: 12.4, col: 3, row: 0 },
  { id: "qaradag", name: "Qaradağ", base: 1620, trend: -1.1, col: 0, row: 1 },
  { id: "nerimanov", name: "Nərimanov", base: 3268, trend: 2.1, col: 1, row: 1 },
  { id: "sebail", name: "Səbail", base: 3820, trend: 6.8, col: 2, row: 1 },
  { id: "nizami", name: "Nizami", base: 2248, trend: 0.6, col: 3, row: 1 },
  { id: "pirallahi", name: "Pirallahı", base: 1362, trend: -3.4, col: 0, row: 2 },
  { id: "absheron", name: "Abşeron", base: 1787, trend: 0.9, col: 1, row: 2 },
  { id: "xetai", name: "Xətai", base: 3737, trend: 3.5, col: 2, row: 2 },
  { id: "suraxani", name: "Suraxanı", base: 1985, trend: -2.3, col: 3, row: 2 }
];

const STREETS_AZ = [
  "Nizami küç.", "Bülbül pr.", "Fəvvarələr meyd.", "28 May küç.", "Xaqani küç.",
  "Rəşid Behbudov", "Əhməd Rəcəbli", "Nobel pr.", "Heydər Əliyev pr.", "Tbilisi pr.",
  "Mətbuat pr.", "Zərifə Əliyeva", "Şərifzadə küç.", "Atatürk pr.", "İnşaatçılar pr."
];
const SOURCES = ["bina.az", "tap.az", "lalafo.az", "emlak.az", "yeniemlak.az"];

function rayonListingCount(r: RayonSeed) {
  const heat = (r.base - 1300) / 3100; // 0..1
  return Math.round(120 + heat * 320 + Math.abs(r.trend) * 6);
}

const LISTINGS: Listing[] = [];
let lid = 1000;
const now = new Date(2026, 4, 30);
RAYONS.forEach((r) => {
  const n = rayonListingCount(r);
  for (let i = 0; i < n; i++) {
    const cat: Listing["cat"] = R() < (r.trend > 3 ? 0.62 : 0.42) ? "Yeni tikili" : "Köhnə tikili";
    const rooms = 1 + Math.floor(R() * 4); // 1..4
    const area = Math.max(28, Math.round(gauss(38 + rooms * 24, 14)));
    const catMult = cat === "Yeni tikili" ? 1.12 : 0.9;
    const ppm = Math.max(900, Math.round(gauss(r.base * catMult, r.base * 0.16)));
    const price = ppm * area;
    const daysAgo = Math.floor(Math.pow(R(), 1.7) * 120);
    const d = new Date(now.getTime() - daysAgo * 864e5);
    const roll = R();
    const status: Listing["status"] = roll < 0.78 ? "active" : roll < 0.92 ? "paused" : "sold";
    LISTINGS.push({
      id: "HM-" + ++lid,
      rayonId: r.id,
      rayon: r.name,
      title: `${rooms} otaqlı, ${pick(STREETS_AZ)}`,
      rooms,
      area,
      ppm,
      price,
      cat,
      source: pick(SOURCES),
      status,
      date: d.toISOString().slice(0, 10),
      floor: 1 + Math.floor(R() * 16)
    });
  }
});
LISTINGS.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

const RAYON_STATS: RayonStat[] = RAYONS.map((r) => {
  const rows = LISTINGS.filter((l) => l.rayonId === r.id);
  const ppms = rows.map((l) => l.ppm).sort((a, b) => a - b);
  const median = ppms[Math.floor(ppms.length / 2)] || r.base;
  const avgArea = Math.round(rows.reduce((s, l) => s + l.area, 0) / rows.length);
  return {
    id: r.id,
    name: r.name,
    short: r.name,
    listings: rows.length,
    median,
    trend: r.trend,
    hot: r.trend > 3,
    avgArea,
    newShare: Math.round((rows.filter((l) => l.cat === "Yeni tikili").length / rows.length) * 100),
    base: r.base,
    col: r.col,
    row: r.row
  };
});

const allPpm = LISTINGS.map((l) => l.ppm).sort((a, b) => a - b);
const cityMedian = allPpm[Math.floor(allPpm.length / 2)];

const median = (arr: number[]) => {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
};

const B2C_SUMMARY: B2CSummary = {
  cityMedian,
  cityTrend: 4.6,
  affordableRayon: RAYON_STATS.slice().sort((a, b) => a.median - b.median)[0],
  premiumRayon: RAYON_STATS.slice().sort((a, b) => b.median - a.median)[0],
  fastestRayon: RAYON_STATS.slice().sort((a, b) => b.trend - a.trend)[0],
  byRooms: [1, 2, 3, 4].map((rooms) => {
    const rows = LISTINGS.filter((l) => l.rooms === rooms);
    return {
      rooms,
      count: rows.length,
      medianPpm: median(rows.map((l) => l.ppm)),
      medianPrice: median(rows.map((l) => l.price))
    };
  }),
  newVsOld: (() => {
    const nu = LISTINGS.filter((l) => l.cat === "Yeni tikili");
    const old = LISTINGS.filter((l) => l.cat === "Köhnə tikili");
    return {
      newMed: median(nu.map((l) => l.ppm)),
      oldMed: median(old.map((l) => l.ppm)),
      newCount: nu.length,
      oldCount: old.length
    };
  })()
};

export { LISTINGS, RAYON_STATS, B2C_SUMMARY };
