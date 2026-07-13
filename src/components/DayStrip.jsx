import { DAYS, LEGS, weekday } from "../data/trip.js";

export default function DayStrip({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
      {DAYS.map((day) => {
        const L = LEGS[day.leg];
        const active = selected === day.d;
        return (
          <button
            key={day.d}
            onClick={() => onSelect(day.d)}
            className="flex-shrink-0 rounded-xl px-3 py-2 text-center border transition-transform"
            style={{
              backgroundColor: active ? L.color : "#FFFFFF",
              borderColor: active ? L.color : "#E5E2DA",
              color: active ? "#FFF" : "#1D2433",
              minWidth: 56,
              transform: active ? "scale(1.05)" : "none",
            }}
          >
            <div className="text-[10px] font-medium" style={{ opacity: 0.7 }}>{weekday(day.d)}</div>
            <div className="text-base font-bold" style={{ fontFamily: "ui-monospace, monospace" }}>{day.d}</div>
            <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1" style={{ backgroundColor: active ? "#FFF" : L.color }} />
          </button>
        );
      })}
    </div>
  );
}
