import s from "./ProgressBar.module.css";

// Hairline progress. `route` renders the route-line variant: a 1.5px solid
// travelled rule ending in a dot, dashed ahead. `color` overrides the accent
// fill via the bridge.
//   <ProgressBar value={spent} max={budget} route />
export default function ProgressBar({ value, max = 100, color, route = false, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={[s.track, route && s.routeTrack, className].filter(Boolean).join(" ")}
      style={color ? { "--c": color } : undefined}
    >
      <div className={[s.fill, route && s.route].filter(Boolean).join(" ")} style={{ width: `${pct}%` }} />
    </div>
  );
}
