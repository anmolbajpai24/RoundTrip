import { useTripConfig, softBg } from "../lib/tripConfig.js";
import { getDayWeather, WMO } from "../lib/weather.js";
import { suggestOutfit } from "../lib/outfitAdvisor.js";
import WeatherIcon from "./WeatherIcon.jsx";
import Icon from "./ui/icons.jsx";
import s from "./DayWeather.module.css";

// Inline per-day weather + outfit widget for the Itinerary day card.
// `packingItems` (optional) = the viewer's own packing-list texts, used to tick
// suggested items they've already packed.
export default function DayWeather({ day, weather, legColor = "var(--ink-faint)", packingItems }) {
  const config = useTripConfig();
  const w = getDayWeather(weather, day, config);

  // No live forecast yet and no climate normals for this place → quiet placeholder.
  if (!w) {
    return (
      <div className={s.placeholder}>
        <Icon name="cloudrain" size={14} />
        Forecast opens ~16 days before this date.
      </div>
    );
  }

  const { label } = WMO(w.code);
  const outfit = suggestOutfit(w, packingItems);
  const typical = w.source === "typical";

  const chip = (item, i) => (
    <span key={i} className={s.chip}>
      {item.text}
      {item.packed && <Icon name="check" size={11} strokeWidth={2} title="On your packing list" className={s.packed} />}
    </span>
  );

  return (
    <div className={s.card}>
      {/* Forecast row */}
      <div className={s.forecast}>
        <div className={s.glyph}>
          <WeatherIcon code={w.code} size={40} />
        </div>
        <div className={s.place}>
          <div className={s.placeRow}>
            <span className={s.placeName}>{w.place}</span>
            {typical && <span className={s.seasonal}>Seasonal average</span>}
          </div>
          <div className={s.meta}>
            {label}
            <span className={s.sep}>·</span>
            <Icon name="cloudrain" size={12} /> {w.precipProb ?? "–"}%
            {w.windMax != null && (
              <>
                <span className={s.sep}>·</span>
                {w.windMax} km/h wind
              </>
            )}
          </div>
        </div>
        <div className={s.temp} style={{ "--c": legColor }}>
          <div className={s.tempMax}>{w.tempMax}°</div>
          <div className={s.tempMin}>{w.tempMin}°</div>
        </div>
      </div>

      {/* Outfit suggestion */}
      <div className={s.outfit} style={{ "--c": legColor, backgroundColor: softBg(legColor) }}>
        <div className={s.outfitHead}>
          <Icon name="hanger" size={14} />
          <span>{outfit.headline}</span>
        </div>
        <div className={s.chips}>
          {outfit.layers.map(chip)}
          {outfit.accessories.map((a, i) => chip(a, `a${i}`))}
        </div>
        <div className={s.feet}>
          <span className={s.feetLabel}>Feet:</span> {outfit.footwear}
        </div>
        {outfit.note && <div className={s.note}>{outfit.note}</div>}
      </div>
    </div>
  );
}
