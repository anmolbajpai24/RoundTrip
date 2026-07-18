import { onColor } from "../theme.js";
import s from "./PersonBadge.module.css";

// A small coloured chip showing who a piece of data belongs to.
// `member` is { name, color }; falls back gracefully if unknown.
// size="disc" renders the compact 18px single-initial disc for list rows.
export default function PersonBadge({ member, size = "sm" }) {
  const name = member?.name || "Someone";
  const color = member?.color || "var(--ink-faint)";
  const ink = onColor(member?.color);
  if (size === "disc") {
    return (
      <span className={s.disc} title={name} style={{ backgroundColor: color, color: ink }}>
        {name.trim().charAt(0).toUpperCase() || "·"}
      </span>
    );
  }
  return (
    <span
      className={[s.badge, size === "xs" && s.xs].filter(Boolean).join(" ")}
      style={{ backgroundColor: color, color: ink, "--ink-on": ink }}
    >
      <span className={s.dot} />
      {name}
    </span>
  );
}
