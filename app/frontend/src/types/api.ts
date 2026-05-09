export type FiltersResponse = {
  periods: string[];
  categories: string[];
  resolutions: number[];
  analysis_types: string[];
};

export type DashboardFilters = {
  period: string;
  categories: string[];
  resolution: number;
  analysis_type: string;
};

export type MetricsResponse = {
  total_ads: number;
  avg_median_price: number;
  trend_percentage: number;
  active_h3_cells: number;
  previous_period: string | null;
};

export type MapDataPoint = {
  h3_index: string;
  ad_count: number;
  median_price_kvm: number;
  category: string;
  rayon_name: string;
};
