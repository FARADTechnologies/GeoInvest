// Google Places address autocomplete (team #1/#2) for the valuation form.
//
// Loads the Maps JS API once (with the Places library) and attaches an
// Autocomplete to the address input. On selection it reports the formatted
// address + latitude/longitude, which the form feeds to the predict server.
//
// Degrades gracefully: with no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, a referrer
// that isn't whitelisted, or any load error, the hook simply does nothing and
// the address field stays a plain text input (today's behaviour) — the form
// then falls back to the DB-median valuation. The Maps key is referrer-locked
// and public by design, so exposing it to the browser is expected.

import { useEffect, useRef, type RefObject } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let mapsPromise: Promise<any> | null = null;

function loadMaps(): Promise<any> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve) => {
    if (typeof window === "undefined" || !MAPS_KEY) return resolve(null);
    const w = window as any;
    if (w.google?.maps?.places) return resolve(w.google.maps);
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
      `&libraries=places&language=az&region=AZ`;
    s.onload = () => resolve(w.google?.maps ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export const mapsAutocompleteEnabled = (): boolean => !!MAPS_KEY;

// Attach Places Autocomplete to an input. `onPlace` fires with the chosen
// address + coordinates; `enabled` lets the caller switch it off (e.g. on the
// link tab). The callback is kept in a ref so re-renders don't re-bind.
export function useAddressAutocomplete(
  inputRef: RefObject<HTMLInputElement | null>,
  onPlace: (address: string, lat: number, lng: number) => void,
  enabled: boolean
): void {
  const cbRef = useRef(onPlace);
  cbRef.current = onPlace;

  useEffect(() => {
    if (!enabled || !MAPS_KEY) return;
    let autocomplete: any = null;
    let cancelled = false;

    loadMaps().then((maps) => {
      if (cancelled || !maps?.places || !inputRef.current) return;
      autocomplete = new maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry"],
        componentRestrictions: { country: "az" }
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const loc = place?.geometry?.location;
        if (!loc) return;
        cbRef.current(
          place.formatted_address || inputRef.current?.value || "",
          loc.lat(),
          loc.lng()
        );
      });
    });

    return () => {
      cancelled = true;
      const w = window as any;
      if (autocomplete && w.google?.maps?.event) {
        w.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [enabled, inputRef]);
}
