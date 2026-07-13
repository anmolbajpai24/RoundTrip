import { LEGS } from "../data/trip.js";

export default function LegChip({ leg }) {
  const L = LEGS[leg];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: L.color, backgroundColor: L.soft }}
    >
      {L.name}
    </span>
  );
}
