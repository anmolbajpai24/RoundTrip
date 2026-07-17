import { onColor } from "../theme.js";
import s from "./Avatar.module.css";

// Initials-in-a-circle avatar, same colour language as PersonBadge.
const SIZES = { xs: 24, sm: 30, md: 38, lg: 64 };

export default function Avatar({ name, color, size = "md", onClick, title }) {
  const px = SIZES[size] || SIZES.md;
  const initial = (name || "").trim().charAt(0).toUpperCase() || "·";
  const Tag = onClick ? "button" : "div";
  const c = color || "var(--ink-faint)";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={s.avatar}
      style={{ width: px, height: px, backgroundColor: c, color: onColor(color), fontSize: Math.round(px * 0.42) }}
    >
      {initial}
    </Tag>
  );
}
