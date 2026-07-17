import { useTripConfig, softBg, softBorder } from "../lib/tripConfig.js";
import s from "./LegChip.module.css";

export default function LegChip({ leg }) {
  const config = useTripConfig();
  const L = config.legs[leg];
  if (!L) return null;
  return (
    <span
      className={s.chip}
      style={{ "--c": L.color, backgroundColor: softBg(L.color), borderColor: softBorder(L.color) }}
    >
      {L.name}
    </span>
  );
}
