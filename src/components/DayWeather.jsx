import { useTripConfig } from "../lib/tripConfig.js";
import { getDayWeather, WMO } from "../lib/weather.js";
import { suggestOutfit } from "../lib/outfitAdvisor.js";
import WeatherIcon from "./WeatherIcon.jsx";
import Icon from "./ui/icons.jsx";
import s from "./DayWeather.module.css";

// Compact per-day forecast line inside the itinerary day card: a hairline,
// one line of weather, and (when the advisor has something worth saying) a
// packing nudge. `packingItems` = the viewer's own packing-list texts.
export default function DayWeather({ day, weather, packingItems }) {
  const config = useTripConfig();
  const w = getDayWeather(weather, day, config);

  // No live forecast yet and no climate normals for this place → quiet placeholder.
  if (!w) {
    return (
      <>
        <div className={s.rule} />
        <div className={s.placeholder}>
          <Icon name="cloudrain" size={14} />
          Forecast opens ~16 days before this date.
        </div>
      </>
    );
  }

  const { label } = WMO(w.code);
  const outfit = suggestOutfit(w, packingItems);
  const typical = w.source === "typical";

  // The nudge: an already-packed advisor item ("it's on your list — pack it")
  // beats the generic headline.
  const packed = [...(outfit.layers || []), ...(outfit.accessories || [])].find((i) => i.packed);
  const nudge = packed ? `${packed.text} is on your packing list — pack it` : outfit.headline;

  return (
    <>
      <div className={s.rule} />
      <div className={s.line}>
        <WeatherIcon code={w.code} size={17} />
        <span className={s.lineText}>
          {w.tempMax}° {label.toLowerCase()} · {w.precipProb ?? "–"}% rain
        </span>
        {typical && <span className={s.seasonal}>Seasonal average</span>}
      </div>
      {nudge && (
        <div className={s.nudge}>
          <Icon name="case" size={14} />
          <span className={s.nudgeText}>{nudge}</span>
        </div>
      )}
    </>
  );
}
