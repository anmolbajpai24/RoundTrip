import { useTripConfig, softBg } from "../lib/tripConfig.js";
import { getDayWeather, WMO } from "../lib/weather.js";
import { suggestOutfit } from "../lib/outfitAdvisor.js";
import WeatherIcon from "./WeatherIcon.jsx";

// Inline per-day weather + outfit widget for the Itinerary day card.
// `packingItems` (optional) = the viewer's own packing-list texts, used to tick
// suggested items they've already packed.
export default function DayWeather({ day, weather, legColor = "#1D2433", packingItems }) {
  const legSoft = softBg(legColor);
  const config = useTripConfig();
  const w = getDayWeather(weather, day, config);

  // No live forecast yet and no climate normals for this place → quiet placeholder.
  if (!w) {
    return (
      <div className="mt-3 rounded-2xl border px-3.5 py-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          🌤 Forecast opens ~16 days before this date.
        </div>
      </div>
    );
  }

  const { label } = WMO(w.code);
  const outfit = suggestOutfit(w, packingItems);
  const typical = w.source === "typical";

  const chip = (item, i) => (
    <span
      key={i}
      className="text-[11px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1"
      style={{ backgroundColor: "var(--card)", border: `1px solid ${legColor}22`, color: "var(--ink)" }}
    >
      {item.text}
      {item.packed && <span title="On your packing list" style={{ color: "#2E7D4F" }}>✓</span>}
    </span>
  );

  return (
    <div className="mt-3 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      {/* Forecast row */}
      <div className="px-3.5 py-3 flex items-center gap-3">
        <div className="flex-shrink-0" style={{ width: 40 }}>
          <WeatherIcon code={w.code} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{w.place}</span>
            {typical && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--chip)", color: "var(--muted)" }}>
                Seasonal average
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--chip-ink)" }}>
            {label}
            <span className="mx-1.5" style={{ color: "var(--faint)" }}>·</span>
            <span title="Chance of rain">🌧 {w.precipProb ?? "–"}%</span>
            {w.windMax != null && (
              <>
                <span className="mx-1.5" style={{ color: "var(--faint)" }}>·</span>
                <span title="Max wind">💨 {w.windMax} km/h</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold leading-none" style={{ color: legColor, fontFamily: "ui-monospace, monospace" }}>{w.tempMax}°</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontFamily: "ui-monospace, monospace" }}>{w.tempMin}°</div>
        </div>
      </div>

      {/* Outfit suggestion */}
      <div className="px-3.5 py-3 border-t" style={{ borderColor: "var(--divider)", backgroundColor: legSoft }}>
        <div className="flex items-center gap-1.5 mb-2">
          <span>👕</span>
          <span className="text-xs font-bold" style={{ color: legColor }}>{outfit.headline}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {outfit.layers.map(chip)}
          {outfit.accessories.map((a, i) => chip(a, `a${i}`))}
        </div>
        <div className="text-[11px] mt-2" style={{ color: "var(--chip-ink)" }}>
          <span className="font-semibold">Feet:</span> {outfit.footwear}
        </div>
        {outfit.note && (
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{outfit.note}</div>
        )}
      </div>
    </div>
  );
}
