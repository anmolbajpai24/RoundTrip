import { getDayWeather, WMO } from "../lib/weather.js";
import { suggestOutfit } from "../lib/outfitAdvisor.js";
import WeatherIcon from "./WeatherIcon.jsx";

// Inline per-day weather + outfit widget for the Itinerary day card.
export default function DayWeather({ day, weather, legColor = "#1D2433", legSoft = "#F0EDE6" }) {
  const w = getDayWeather(weather, day);
  const { label } = WMO(w.code);
  const outfit = suggestOutfit(w);
  const typical = w.source === "typical";

  const chip = (item, i) => (
    <span
      key={i}
      className="text-[11px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1"
      style={{ backgroundColor: "#FFF", border: `1px solid ${legColor}22`, color: "#1D2433" }}
    >
      {item.text}
      {item.packed && <span title="On your packing list" style={{ color: "#2E7D4F" }}>✓</span>}
    </span>
  );

  return (
    <div className="mt-3 rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
      {/* Forecast row */}
      <div className="px-3.5 py-3 flex items-center gap-3">
        <div className="flex-shrink-0" style={{ width: 40 }}>
          <WeatherIcon code={w.code} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate" style={{ color: "#1D2433" }}>{w.place}</span>
            {typical && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#EDEAE2", color: "#8A8F98" }}>
                Typical for August
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#5A5F6A" }}>
            {label}
            <span className="mx-1.5" style={{ color: "#C9C5BB" }}>·</span>
            <span title="Chance of rain">🌧 {w.precipProb ?? "–"}%</span>
            {w.windMax != null && (
              <>
                <span className="mx-1.5" style={{ color: "#C9C5BB" }}>·</span>
                <span title="Max wind">💨 {w.windMax} km/h</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold leading-none" style={{ color: legColor, fontFamily: "ui-monospace, monospace" }}>{w.tempMax}°</div>
          <div className="text-xs mt-0.5" style={{ color: "#8A8F98", fontFamily: "ui-monospace, monospace" }}>{w.tempMin}°</div>
        </div>
      </div>

      {/* Outfit suggestion */}
      <div className="px-3.5 py-3 border-t" style={{ borderColor: "#F0EDE6", backgroundColor: legSoft }}>
        <div className="flex items-center gap-1.5 mb-2">
          <span>👕</span>
          <span className="text-xs font-bold" style={{ color: legColor }}>{outfit.headline}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {outfit.layers.map(chip)}
          {outfit.accessories.map((a, i) => chip(a, `a${i}`))}
        </div>
        <div className="text-[11px] mt-2" style={{ color: "#5A5F6A" }}>
          <span className="font-semibold">Feet:</span> {outfit.footwear}
        </div>
        {outfit.note && (
          <div className="text-[11px] mt-1" style={{ color: "#8A8F98" }}>{outfit.note}</div>
        )}
      </div>
    </div>
  );
}
