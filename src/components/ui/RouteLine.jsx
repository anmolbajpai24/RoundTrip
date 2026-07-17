import s from "./RouteLine.module.css";

// THE motif: destination-coloured dots joined by hairline rules, tracked-caps
// labels in a darker tint of each stop's colour. Recurs on trip cards, day
// headers and budget progress (brief §4). Stops: [{ name, color }].
//   <RouteLine stops={config.legs} />           — dots + labels
//   <RouteLine stops={legs} labels={false} />   — bare spine (day strip)
export default function RouteLine({ stops = [], labels = true, className }) {
  if (stops.length === 0) return null;
  return (
    <div className={[s.line, className].filter(Boolean).join(" ")} aria-hidden="true">
      {stops.map((stop, i) => (
        <span key={`${stop.name || "stop"}-${i}`} className={s.stop} style={{ "--c": stop.color }}>
          {i > 0 && <span className={s.rule} />}
          <span className={s.dot} />
          {labels && stop.name && <span className={s.label}>{stop.name}</span>}
        </span>
      ))}
      <span className={s.tail} />
    </div>
  );
}
