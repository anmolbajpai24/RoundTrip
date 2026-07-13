import { useTripConfig } from "../lib/tripConfig.js";

export default function LegChip({ leg }) {
  const config = useTripConfig();
  const L = config.legs[leg];
  if (!L) return null;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: L.color, backgroundColor: L.soft }}
    >
      {L.name}
    </span>
  );
}
