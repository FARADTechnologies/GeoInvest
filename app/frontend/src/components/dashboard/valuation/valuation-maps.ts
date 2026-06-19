// Google Places address autocomplete (team #1/#2) for the valuation form.
//
// Uses the NEW Places API (AutocompleteSuggestion) because the legacy
// google.maps.places.Autocomplete widget is not available to new customers
// (Google, March 2025). We fetch suggestions programmatically and render our
// own dropdown in valuation-core so the form keeps its styling; on selection
// we resolve the place's coordinates and feed them to the predict server.
//
// Degrades gracefully: with no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, an
// unwhitelisted referrer, or any load error, the hook simply returns no
// suggestions and the address field stays a plain text input (DB-median
// fallback). The Maps key is referrer-locked and public by design.

import { useCallback, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let mapsPromise: Promise<any> | null = null;

function loadMaps(): Promise<any> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve) => {
    if (typeof window === "undefined" || !MAPS_KEY) return resolve(null);
    const w = window as any;
    if (w.google?.maps?.importLibrary) return resolve(w.google.maps);
    const existing = document.getElementById("gmaps-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.google?.maps ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const s = document.createElement("script");
    s.id = "gmaps-js";
    s.async = true;
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}` +
      `&libraries=places&language=az&region=AZ&loading=async`;
    s.onload = () => resolve(w.google?.maps ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export const mapsAutocompleteEnabled = (): boolean => !!MAPS_KEY;

export type AddrSuggestion = { id: string; text: string };
export type PickedPlace = { address: string; lat: number; lng: number };

// Programmatic Places autocomplete. `search(text)` updates `suggestions`;
// `pick(id)` resolves the chosen suggestion to an address + coordinates.
export function usePlacesAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddrSuggestion[]>([]);
  const sessionRef = useRef<any>(null);
  const predRef = useRef<Map<string, any>>(new Map());
  const seqRef = useRef(0);

  const search = useCallback(async (input: string) => {
    const text = input.trim();
    if (!MAPS_KEY || text.length < 3) {
      setSuggestions([]);
      return;
    }
    const seq = ++seqRef.current;
    const maps = await loadMaps();
    if (!maps) return;
    let places: any;
    try {
      places = await maps.importLibrary("places");
    } catch {
      return;
    }
    if (!sessionRef.current) sessionRef.current = new places.AutocompleteSessionToken();
    let res: any[] | undefined;
    try {
      ({ suggestions: res } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        sessionToken: sessionRef.current,
        includedRegionCodes: ["az"],
        language: "az"
      }));
    } catch {
      setSuggestions([]);
      return;
    }
    if (seq !== seqRef.current) return; // a newer keystroke superseded this one
    predRef.current.clear();
    const list: AddrSuggestion[] = [];
    for (const s of res ?? []) {
      const p = s.placePrediction;
      if (!p) continue;
      predRef.current.set(p.placeId, p);
      list.push({ id: p.placeId, text: p.text?.text ?? String(p.text ?? "") });
    }
    setSuggestions(list);
  }, []);

  const pick = useCallback(async (id: string): Promise<PickedPlace | null> => {
    const p = predRef.current.get(id);
    setSuggestions([]);
    if (!p) return null;
    try {
      const place = p.toPlace();
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      sessionRef.current = null; // a pick ends the billing session
      const loc = place.location;
      if (!loc) return null;
      return {
        address: place.formattedAddress || p.text?.text || "",
        lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
        lng: typeof loc.lng === "function" ? loc.lng() : loc.lng
      };
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, search, pick, clear };
}
