import { useTripConfig, weekday, dayOfMonth } from "../lib/tripConfig.js";
import { onColor } from "../theme.js";
import s from "./DayStrip.module.css";

// Destination-tinted day selector: each cell tints its leg colour toward the
// surface (selected = full colour), with a route-line spine of dots beneath.
export default function DayStrip({ selected, onSelect }) {
  const config = useTripConfig();
  const fits = config.days.length <= 10;
  return (
    <div className={[s.strip, !fits && s.stripScroll].filter(Boolean).join(" ")}>
      {config.days.map((day) => {
        const L = config.legs[day.leg] || {};
        const active = selected === day.date;
        const color = L.color || "var(--ink-faint)";
        return (
          <button
            key={day.date}
            onClick={() => onSelect(day.date)}
            className={[s.cell, active && s.active].filter(Boolean).join(" ")}
            style={{ "--c": color, "--on": onColor(L.color) }}
          >
            <span className={s.weekday}>{weekday(day.date)}</span>
            <span className={s.date}>{dayOfMonth(day.date)}</span>
            <span className={s.dot} />
          </button>
        );
      })}
    </div>
  );
}
