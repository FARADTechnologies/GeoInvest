// Which rayon is an H3 cell in?
//
// The map's "pure_h3" aggregation groups purely by hexagon, so the backend has
// no rayon to attach and stamps every row "GLOBAL" — the tooltip then told you
// nothing about where you were pointing. The geom aggregation does join the
// rayon polygons, but it does so per listing, which splits a cell that straddles
// a boundary into several rows and drops listings that fall outside every
// polygon. Neither answers the simple question the map is being asked.
//
// A hexagon belongs to the rayon that contains its centre. That is one point
// against a dozen polygons, the polygons are already served by /boundaries, and
// h3-js (already here for the hexagon layer) turns a cell id into its centre —
// so the answer is computed on the client with nothing new added anywhere.
//
// Results are memoised per cell id: a cell's rayon never changes.

import { cellToLatLng } from "h3-js";

export type BoundaryFeature = {
  geometry: { type: string; coordinates: unknown };
  properties: { id?: number | null; name?: string | null; type_id?: number | null };
};

type Ring = [number, number][];      // [lng, lat] pairs, GeoJSON order
type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

type Shape = { rings: Ring[]; bbox: BBox };   // rings[0] outer, rest are holes
type NamedShapes = { name: string; shapes: Shape[] };

let prepared: NamedShapes[] | null = null;
const cache = new Map<string, string | null>();

/** Feed the polygons in once; later calls are cheap lookups. */
export function setRayonBoundaries(features: BoundaryFeature[]): void {
  prepared = [];
  cache.clear();
  for (const f of features) {
    const name = (f.properties?.name ?? "").trim();
    if (!name) continue;
    const shapes = toShapes(f.geometry);
    if (shapes.length > 0) prepared.push({ name, shapes });
  }
}

/** Rayon containing the cell's centre, or null when it falls outside them all. */
export function rayonForCell(h3Index: string): string | null {
  if (!prepared || prepared.length === 0 || !h3Index) return null;
  const hit = cache.get(h3Index);
  if (hit !== undefined) return hit;

  let name: string | null = null;
  try {
    // h3-js returns [lat, lng]; GeoJSON rings are [lng, lat].
    const [lat, lng] = cellToLatLng(h3Index);
    name = rayonAt(lng, lat);
  } catch {
    name = null; // not a valid cell id
  }
  cache.set(h3Index, name);
  return name;
}

/** Rayon containing an arbitrary point, in GeoJSON order. */
export function rayonAt(lng: number, lat: number): string | null {
  if (!prepared) return null;
  for (const { name, shapes } of prepared) {
    for (const shape of shapes) {
      const [minLng, minLat, maxLng, maxLat] = shape.bbox;
      // The bounding box rejects most polygons without touching their rings.
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (!pointInRing(lng, lat, shape.rings[0])) continue;
      // Inside the outer ring — unless it sits in one of the holes.
      const inHole = shape.rings.slice(1).some((r) => pointInRing(lng, lat, r));
      if (!inHole) return name;
    }
  }
  return null;
}

// ── Geometry ─────────────────────────────────────────────────────────

function toShapes(geometry: BoundaryFeature["geometry"]): Shape[] {
  if (!geometry) return [];
  const build = (rings: unknown): Shape | null => {
    if (!Array.isArray(rings) || rings.length === 0) return null;
    const clean = (rings as unknown[])
      .map((r) => (Array.isArray(r) ? (r as Ring) : []))
      .filter((r) => r.length >= 4);
    if (clean.length === 0) return null;
    return { rings: clean, bbox: bboxOf(clean[0]) };
  };

  if (geometry.type === "Polygon") {
    const s = build(geometry.coordinates);
    return s ? [s] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const polys = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polys.map(build).filter((s): s is Shape => s !== null);
  }
  return [];
}

function bboxOf(ring: Ring): BBox {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Ray casting: count crossings of a ray running east from the point. */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Does this edge straddle the point's latitude, and is the crossing east?
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
