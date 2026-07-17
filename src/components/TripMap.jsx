import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTripConfig, findDay } from "../lib/tripConfig.js";
import EmptyState from "./ui/EmptyState.jsx";
import s from "./TripMap.module.css";

// Trip map (Leaflet + OpenStreetMap, no API key): one pin per destination in
// leg colours, a route line following legOrder, plus a small pin for the
// selected day's place override (day trips). Tapping a destination pin selects
// that leg's first day in the DayStrip.
export default function TripMap({ selected, onSelectDay }) {
  const config = useTripConfig();
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.setView([20, 0], 2);
    mapRef.current = map;
    fittedRef.current = false;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !config) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    // Leg names/colors come from member-editable trip config and Leaflet
    // renders tooltip/divIcon content as raw HTML — escape/validate both.
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : "#6E604F");

    // White border + soft shadow are a deliberate on-map affordance (reads on
    // both light and dark-inverted tiles), not app chrome.
    const pin = (color, px = 16) => L.divIcon({
      className: "",
      html: `<div style="width:${px}px;height:${px}px;border-radius:50%;background:${safeColor(color)};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`,
      iconSize: [px, px],
      iconAnchor: [px / 2, px / 2],
    });

    // One stop per destination, in route order (repeat visits collapse).
    const seen = new Set();
    const stops = [];
    for (const key of config.legOrder) {
      const leg = config.legs[key];
      if (!leg || leg.lat == null || leg.lon == null) continue;
      stops.push({ key, leg });
      seen.add(key);
    }

    if (stops.length > 1) {
      // The route line, in the brand wine — reads on OSM tiles in both themes.
      L.polyline(stops.map((st) => [st.leg.lat, st.leg.lon]), {
        color: "#722F37", weight: 2.5, opacity: 0.75, dashArray: "2 7", lineCap: "round",
      }).addTo(layer);
    }

    const drawn = new Set();
    for (const { key, leg } of stops) {
      if (drawn.has(key)) continue;
      drawn.add(key);
      const m = L.marker([leg.lat, leg.lon], { icon: pin(leg.color) }).addTo(layer);
      m.bindTooltip(esc(leg.name), { direction: "top", offset: [0, -10] });
      m.on("click", () => {
        const first = config.days.find((d) => d.leg === key);
        if (first && onSelectDay) onSelectDay(first.date);
      });
    }

    // Selected day's place override (a day trip away from the leg's base).
    const day = selected ? findDay(config, selected) : null;
    if (day?.place && day.lat != null && day.lon != null) {
      const color = config.legs[day.leg]?.color || "#1D2433";
      const m = L.marker([day.lat, day.lon], { icon: pin(color, 12) }).addTo(layer);
      m.bindTooltip(`${esc(day.place)} · day trip`, { direction: "top", offset: [0, -8] });
    }

    if (!fittedRef.current && stops.length) {
      if (stops.length === 1) map.setView([stops[0].leg.lat, stops[0].leg.lon], 10);
      else map.fitBounds(L.latLngBounds(stops.map((st) => [st.leg.lat, st.leg.lon])).pad(0.25));
      fittedRef.current = true;
    }
  }, [config, selected, onSelectDay]);

  return (
    <div className={s.map}>
      <div ref={ref} className={s.canvas} />
      {offline && (
        <div className={s.offline}>
          <EmptyState icon="cloudoff" title="You're offline" body="The map needs a connection — everything else keeps working." />
        </div>
      )}
    </div>
  );
}
