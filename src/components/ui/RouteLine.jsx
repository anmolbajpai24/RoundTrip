import s from "./RouteLine.module.css";

// THE motif: destination-coloured dots joined by hairline rules, tracked-caps
// labels in a darker tint of each stop's colour. Recurs on trip cards, day
// headers and budget progress (brief §4). Stops: [{ name, color }].
// `active` (a stop index) renders travelled rules solid and the rules ahead
// dashed — progress along the spine.
//   <RouteLine stops={stops} />                  — dots + labels
//   <RouteLine stops={stops} labels={false} />   — bare spine
//   <RouteLine stops={stops} active={legIdx} />  — solid behind, dashed ahead
export default function RouteLine({ stops = [], labels = true, active, className }) {
  if (stops.length === 0) return null;
  const progress = typeof active === "number";
  return (
    <div className={[s.line, className].filter(Boolean).join(" ")} aria-hidden="true">
      {stops.map((stop, i) => (
        <span key={`${stop.name || "stop"}-${i}`} className={s.stop} style={{ "--c": stop.color }}>
          {i > 0 && <span className={progress && i > active ? s.ruleAhead : s.rule} />}
          <span className={s.dot} />
          {labels && stop.name && <span className={s.label}>{stop.name}</span>}
        </span>
      ))}
      <span className={progress && active < stops.length - 1 ? s.tailAhead : s.tail} />
    </div>
  );
}
