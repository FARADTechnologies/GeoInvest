"use client";

import DeckGL from "@deck.gl/react";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import Map from "react-map-gl/maplibre";

import type { MapDataPoint } from "@/types/api";

export type ColorMetric = "median_price_kvm" | "ad_count";

const INITIAL_VIEW_STATE = {
  longitude: 49.8671,
  latitude: 40.4093,
  zoom: 10.6,
  pitch: 0,
  bearing: 0
};

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function interpolate(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function heatColor(value: number, min: number, max: number): [number, number, number, number] {
  const low = [28, 204, 153];
  const mid = [238, 185, 79];
  const high = [235, 89, 87];
  const ratio = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const from = ratio < 0.5 ? low : mid;
  const to = ratio < 0.5 ? mid : high;
  const localT = ratio < 0.5 ? ratio * 2 : (ratio - 0.5) * 2;

  return [
    interpolate(from[0], to[0], localT),
    interpolate(from[1], to[1], localT),
    interpolate(from[2], to[2], localT),
    190
  ];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTooltip(object: MapDataPoint, colorMetric: ColorMetric) {
  const highlightPrice = colorMetric === "median_price_kvm";
  const highlightAds = colorMetric === "ad_count";

  return `
    <div style="min-width: 190px">
      <div style="font-weight: 700; color: #1cc999; margin-bottom: 4px">${escapeHtml(object.rayon_name)}</div>
      <div style="color: #a8b3c7; margin-bottom: 8px">${escapeHtml(object.category)}</div>
      <div style="display: flex; justify-content: space-between; gap: 12px; ${highlightAds ? "color: #fff; font-weight: 600;" : ""}">
        <span>Ads</span>
        <strong>${object.ad_count.toLocaleString("en-US")}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px; ${highlightPrice ? "color: #fff; font-weight: 600;" : ""}">
        <span>Price</span>
        <strong>${Math.round(object.median_price_kvm).toLocaleString("en-US")} AZN/m²</strong>
      </div>
    </div>
  `;
}

type Props = {
  data: MapDataPoint[];
  colorMetric: ColorMetric;
};

export function DeckH3Map({ data, colorMetric }: Props) {
  const values = data.map((item) => item[colorMetric]);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;

  const layers = [
    new H3HexagonLayer<MapDataPoint>({
      id: "h3-layer",
      data,
      pickable: true,
      filled: true,
      stroked: true,
      extruded: false,
      highPrecision: true,
      getHexagon: (item) => item.h3_index,
      getFillColor: (item) => heatColor(item[colorMetric], minVal, maxVal),
      getLineColor: [255, 255, 255, 70],
      lineWidthMinPixels: 1,
      updateTriggers: {
        getFillColor: [colorMetric, minVal, maxVal]
      }
    })
  ];

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller
      layers={layers}
      getTooltip={({ object }) =>
        object
          ? {
              html: buildTooltip(object as MapDataPoint, colorMetric),
              style: {
                backgroundColor: "rgba(16, 22, 31, 0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "#f5f7fb",
                fontSize: "12px",
                padding: "10px"
              }
            }
          : null
      }
    >
      <Map reuseMaps mapStyle={MAP_STYLE} />
    </DeckGL>
  );
}
