// Report adapter — maps our valuation output into the predict-server report
// contract (types/valuation.ts → RateReportData) that the BA document
// specifies. The RateReport modal renders against this contract only, so
// when the real /api/v1/model/predict[/link] endpoints land (team #3/#12)
// the data source swaps here and the report UI is untouched.

import type {
  AiEstimate,
  RateReportData,
  ReportFeatures,
  ValuationInput
} from "@/types/valuation";
import { apiUrl } from "@/lib/api-url";

function featuresFromInput(input: ValuationInput): ReportFeatures {
  return {
    address: input.address ?? null,
    type: input.type ?? null,
    repair: input.repair ?? null,
    extract: input.extract ?? null,
    area: input.area ?? null,
    total_floors: input.total_floors ?? null,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    residential_complex: input.residence ? 1 : 0,
    residence_owner: input.residence ?? null
  };
}

// A reportFromResult() sat here, converting the backend's own valuation engine
// into this report contract. That engine has been removed (it invented rent,
// yield, payback and liquidity), so the only path into the report is the real
// predict model below.

// ── Parametrlə flow: REAL predict server (team #3/#12) ──────────────────
//
// When the form carries coordinates (filled by the Maps autocomplete, #1/#2)
// we call the real model via our backend proxy (/api/v1/model/predict, which
// keeps the secret server-side). The predict response is top-level
// (sale_estimate / rent_estimate / investment_metrics — no `ai_data` wrapper),
// so the mapping into our report contract is a near pass-through. When there
// are no coordinates, or the model is unreachable, valuation-single falls back
// to reportFromResult (DB-median synthesis) so the feature still works.

const todayISO = (): string => new Date().toISOString().slice(0, 10);

type PredictPayload = {
  latitude: number;
  longitude: number;
  otaq_sayi: number;
  sahe_kvm: number;
  mertebe_yer: number;
  mertebe_say: number;
  date2: string;
  kateqoriya: string;
  temir: string;
  cixaris: string;
  residential_complex: number;
  residence_owner: string;
};

// Map our form input to the predict server's exact contract (proven by the
// team's sample payload): kateqoriya lowercase ("köhnə tikili"), təmir/çıxarış
// as "var"/"yox", residence_owner defaults to "mülkiyyətçi" when there is no
// residential complex.
export function buildPredictPayload(input: ValuationInput): PredictPayload {
  return {
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    otaq_sayi: input.rooms ?? 0,
    sahe_kvm: input.area ?? 0,
    mertebe_yer: input.floor ?? 0,
    mertebe_say: input.total_floors ?? 0,
    date2: input.valuation_date || todayISO(),
    // Send the category EXACTLY as the UI shows it ("Yeni tikili" / "Köhnə
    // tikili"). The predict model is case-sensitive: lowercasing it (old bug)
    // made "yeni tikili" unrecognised → a lower valuation that didn't match
    // homora.ai/rate-my-apartment. The official site sends it unchanged.
    kateqoriya: input.type || "",
    temir: (input.repair || "").trim() === "Təmirli" ? "var" : "yox",
    cixaris: (input.extract || "").trim() === "Var" ? "var" : "yox",
    residential_complex: input.residence ? 1 : 0,
    residence_owner: input.residence || "mülkiyyətçi"
  };
}

// The predict server's raw response shape (top-level, no ai_data wrapper).
type PredictResponse = {
  sale_estimate: AiEstimate;
  rent_estimate: AiEstimate;
  investment_metrics: RateReportData["ai_data"]["investment_metrics"];
  as_of_date?: string | null;
  accessibility_data?: RateReportData["accessibility_data"];
  rayon?: string | null;
};

export function reportFromPredict(resp: PredictResponse, input: ValuationInput): RateReportData {
  return {
    ai_data: {
      sale_estimate: resp.sale_estimate,
      rent_estimate: resp.rent_estimate,
      investment_metrics: resp.investment_metrics,
      as_of_date: resp.as_of_date ?? null
    },
    accessibility_data: resp.accessibility_data ?? {},
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    listing_price: null, // form flow → mortgage uses predicted sale price
    rayon: resp.rayon ?? input.rayon ?? null,
    features: featuresFromInput(input),
    source: { kind: "form" }
  };
}

// Call the real predict model through our backend proxy. Slow (~19–60s; cold
// start can exceed a minute), so the timeout is generous. Throws a typed
// LinkValuationError on HTTP failure so the caller can fall back.
export async function predictByParams(input: ValuationInput): Promise<RateReportData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 125000);
  let res: Response;
  try {
    res = await fetch(apiUrl(`/model/predict`), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildPredictPayload(input)),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string; detail?: string };
      msg = j?.detail || j?.message || "";
    } catch {
      /* no body */
    }
    throw new LinkValuationError(res.status, msg);
  }
  const resp = (await res.json()) as PredictResponse;
  return reportFromPredict(resp, input);
}

// ── Elan linki flow ────────────────────────────────────────────────────

// Thrown for explicit HTTP failures from the real predict-link endpoint so
// the UI can map 400/404/other to the BA-specified copy (§17).
export class LinkValuationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "LinkValuationError";
  }
}

export type LinkResult = { data: RateReportData; source: "db" | "mock" };

// Link flow request. Sends ONLY { flat_link } (BA §2.2 / §15) to the real
// predict-link endpoint. While that endpoint is unwired (team #3/#12) the
// call fails at the network layer and we fall back to a URL-only placeholder
// so the link report is demoable today. A real 4xx/5xx throws a typed error.
export async function valuateByLink(url: string): Promise<LinkResult> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      res = await fetch(apiUrl(`/model/predict/link`), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ flat_link: url }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network/abort: never show fabricated numbers for a real listing (BA §17).
    throw new LinkValuationError(
      0,
      "Qiymətləndirmə xidmətinə qoşulmaq mümkün olmadı, yenidən cəhd edin."
    );
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string; detail?: string };
      msg = j?.message || j?.detail || "";
    } catch {
      /* no body */
    }
    throw new LinkValuationError(res.status, msg);
  }
  const resp = (await res.json()) as {
    ai_data: RateReportData["ai_data"];
    accessibility_data?: RateReportData["accessibility_data"];
    latitude?: number | null;
    longitude?: number | null;
    listing_price?: number | null;
    actual_price?: number | null;
    rayon?: string | null;
  };
  return {
    data: {
      ai_data: resp.ai_data,
      accessibility_data: resp.accessibility_data ?? {},
      latitude: resp.latitude ?? null,
      longitude: resp.longitude ?? null,
      listing_price: resp.listing_price ?? resp.actual_price ?? null,
      rayon: resp.rayon ?? null,
      features: null,
      source: { kind: "link", url }
    },
    source: "db"
  };
}

// A `reportFromLinkMock(url)` used to live here: when the predict-link
// endpoint was unreachable it produced a complete valuation — price, area,
// rent, yield, payback — by hashing the URL string. Nothing about it came from
// the property. It is deleted; an unreachable endpoint is now reported as an
// error instead of being papered over with a number.

// ── §9/§12 Nearby objects (accessibility) ───────────────────────────────
// Fetched on demand by the report when coordinates are present, from our
// backend proxy over the source-DB function get_nearby_objects_by_lon_lat.

export type NearbyObject = { name: string; latitude: number; longitude: number; distance: number };
export type NearbyCategory = { category: string; items: NearbyObject[] };

export async function fetchNearby(lat: number, lon: number): Promise<NearbyCategory[]> {
  try {
    const res = await fetch(apiUrl(`/model/nearby`), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { categories?: NearbyCategory[] };
    return j.categories ?? [];
  } catch {
    return [];
  }
}
