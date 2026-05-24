// Minimal i18n for the dashboard. TR is the default for Homora.ai.

export type Lang = "tr" | "en";

type Strings = Record<string, string>;

const TR: Strings = {
  // Brand / workspace
  workspace: "Çalışma Alanı",

  // Top bar
  dashTitle: "Analiz Paneli",
  dashSub: "H3 hexagonal emlak istihbaratı · Bakü",
  searchPh: "Bölge, hücre, ilan ara...",
  geom: "Geom",
  h3: "H3",
  refresh: "Yenile",
  export: "Dışa Aktar",

  // Nav
  navOverview: "Genel Bakış",
  navMap: "Harita",
  navRayons: "Bölgeler",
  navTrends: "Trendler",
  navListings: "İlanlar",
  navReports: "Raporlar",
  navAlerts: "Uyarılar",
  navSettings: "Ayarlar",
  navAccount: "Hesap",

  // Filters
  analysisType: "Analiz Tipi",
  period: "Dönem",
  categoriesL: "Kategoriler",
  resolution: "Çözünürlük",
  outlier: "Aykırı Eşik",
  outlierOff: "Kapalı",
  cellsLte: "Hücre ≤",
  colorBy: "Renklendirme",
  byPrice: "Fiyat",
  byListings: "İlan",

  // KPI
  kpiTotalAds: "Toplam İlan",
  kpiMedian: "Medyan Fiyat",
  kpiTrend: "Trend",
  kpiCells: "Aktif H3 Hücre",
  perM2: "AZN/m²",

  // Sections
  secMap: "Bakü H3 Isı Haritası",
  secMapSub: "Hücre başına medyan fiyat ve ilan yoğunluğu",
  secRayons: "Bölge Sıralaması",
  secRayonsSub: "Medyan fiyat ve trend",
  secTrend: "12 Aylık Fiyat Trendi",
  secTrendSub: "İlk 5 bölge, AZN/m²",
  secHisto: "Fiyat Dağılımı",
  secHistoSub: "AZN/m² (10 bin)",
  secActivity: "Son Aktivite",
  secActivitySub: "Sistem ve veri olayları",

  // Misc
  low: "Düşük",
  high: "Yüksek",
  hot: "Sıcak",
  viewAll: "Tümünü Gör",
  listings: "İlan",
  copyright: "© Homora.ai · 2026",

  // Connection
  connectTitle: "DEMO Modu",
  connectSub: "Canlı veri için backend'i başlatın. Birkaç saniye içinde otomatik bağlanacak.",
  connectStep1: "1. Backend'i başlat",
  connectStep2: "2. Bekle, otomatik LIVE olacak",
  connectingLive: "✓ Canlı veri akıyor",
  connectionLost: "Bağlantı kaybedildi"
};

const EN: Strings = {
  workspace: "Workspace",

  dashTitle: "Analytics",
  dashSub: "H3 hexagonal real estate intelligence · Baku",
  searchPh: "Search rayon, cell, listing...",
  geom: "Geom",
  h3: "H3",
  refresh: "Refresh",
  export: "Export",

  navOverview: "Overview",
  navMap: "Map",
  navRayons: "Rayons",
  navTrends: "Trends",
  navListings: "Listings",
  navReports: "Reports",
  navAlerts: "Alerts",
  navSettings: "Settings",
  navAccount: "Account",

  analysisType: "Analysis Type",
  period: "Period",
  categoriesL: "Categories",
  resolution: "Resolution",
  outlier: "Outlier Threshold",
  outlierOff: "Off",
  cellsLte: "Cells ≤",
  colorBy: "Color by",
  byPrice: "Price",
  byListings: "Listings",

  kpiTotalAds: "Total Ads",
  kpiMedian: "Median Price",
  kpiTrend: "Trend",
  kpiCells: "Active H3 Cells",
  perM2: "AZN/m²",

  secMap: "Baku H3 Heatmap",
  secMapSub: "Median price and listing density per cell",
  secRayons: "Rayon Ranking",
  secRayonsSub: "Median price and trend",
  secTrend: "12-Month Price Trend",
  secTrendSub: "Top 5 rayons, AZN/m²",
  secHisto: "Price Distribution",
  secHistoSub: "AZN/m² (10 bins)",
  secActivity: "Recent Activity",
  secActivitySub: "System and data events",

  low: "Low",
  high: "High",
  hot: "Hot",
  viewAll: "View all",
  listings: "Listings",
  copyright: "© Homora.ai · 2026",

  connectTitle: "DEMO Mode",
  connectSub: "Start the backend to see live data. Auto-connects in a few seconds.",
  connectStep1: "1. Start the backend",
  connectStep2: "2. Wait — it'll go LIVE automatically",
  connectingLive: "✓ Live data streaming",
  connectionLost: "Connection lost"
};

export const I18N: Record<Lang, Strings> = { tr: TR, en: EN };

export function useStrings(lang: Lang): Strings {
  return I18N[lang] ?? I18N.tr;
}
