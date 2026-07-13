import { useTripConfig, weekday, dayOfMonth } from "../lib/tripConfig.js";

export default function DayStrip({ selected, onSelect }) {
  const config = useTripConfig();
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
      {config.days.map((day) => {
        const L = config.legs[day.leg] || {};
        const active = selected === day.date;
        return (
          <button
            key={day.date}
            onClick={() => onSelect(day.date)}
            className="flex-shrink-0 rounded-xl px-3 py-2 text-center border transition-transform"
            style={{
              backgroundColor: active ? L.color : "var(--card)",
              borderColor: active ? L.color : "var(--border)",
              color: active ? "#FFF" : "var(--ink)",
              minWidth: 56,
              transform: active ? "scale(1.05)" : "none",
            }}
          >
            <div className="text-[10px] font-medium" style={{ opacity: 0.7 }}>{weekday(day.date)}</div>
            <div className="text-base font-bold" style={{ fontFamily: "ui-monospace, monospace" }}>{dayOfMonth(day.date)}</div>
            <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1" style={{ backgroundColor: active ? "#FFF" : L.color }} />
          </button>
        );
      })}
    </div>
  );
}
