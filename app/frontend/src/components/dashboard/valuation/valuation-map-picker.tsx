"use client";

// "Xəritədən seç" — interactive map picker (team #1/#2). Opens over the entry
// form; the user clicks the apartment's location and we read the coordinates
// straight off the click (no extra API) and try to reverse-geocode a readable
// address. Confirming feeds address + lat/lng back to the form, exactly like
// the autocomplete pick.

import { useEffect, useRef, useState } from "react";
import { T } from "@/components/dashboard/valuation/valuation-i18n";
import { loadMaps } from "@/components/dashboard/valuation/valuation-maps";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BAKU = { lat: 40.4093, lng: 49.8671 };

export function MapPicker({
  initial,
  onClose,
  onConfirm
}: {
  initial?: { lat: number; lng: number } | null;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, address: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [addr, setAddr] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadMaps().then((maps) => {
      if (cancelled || !maps?.Map || !mapRef.current) return;
      // loadMaps does a classic eager load, so Map / Marker / Geocoder are
      // available directly (no importLibrary, no loading=async race).
      const { Map, Marker, Geocoder } = maps;

      const map = new Map(mapRef.current, {
        center: initial ?? BAKU,
        zoom: initial ? 16 : 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      geocoderRef.current = new Geocoder();

      const place = (lat: number, lng: number) => {
        const pos = { lat, lng };
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new Marker({ position: pos, map });
        setPicked({ lat, lng });
        // Reverse geocode is best-effort — if it fails we just show coordinates.
        try {
          geocoderRef.current.geocode({ location: pos }, (res: any, status: string) => {
            setAddr(status === "OK" && res?.[0] ? res[0].formatted_address : "");
          });
        } catch {
          setAddr("");
        }
      };

      if (initial) place(initial.lat, initial.lng);
      map.addListener("click", (e: any) => {
        if (e.latLng) place(e.latLng.lat(), e.latLng.lng());
      });
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal" style={{ maxWidth: 760, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{T("Xəritədən seçin")}</div>
          <button className="modal-close" onClick={onClose} aria-label="close">✕</button>
        </div>
        <div className="modal-body">
          <div className="chart-sub" style={{ marginBottom: 8 }}>
            {T("Xəritədə mənzilin yerləşdiyi nöqtəni klikləyin.")}
          </div>
          <div
            ref={mapRef}
            style={{ width: "100%", height: 400, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}
          />
          {picked && (
            <div style={{ marginTop: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.6 }}>{T("Seçilən")}:</span>
              <strong>{addr || `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`}</strong>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={onClose}>{T("Ləğv et")}</button>
          <button
            className="btn btn-primary"
            disabled={!picked}
            onClick={() => picked && onConfirm(picked.lat, picked.lng, addr)}
          >
            {T("Təsdiq et")}
          </button>
        </div>
      </div>
    </div>
  );
}
