// Initials-in-a-circle avatar, same colour language as PersonBadge.
const SIZES = { xs: 24, sm: 30, md: 38, lg: 64 };

export default function Avatar({ name, color, size = "md", onClick, title }) {
  const px = SIZES[size] || SIZES.md;
  const initial = (name || "").trim().charAt(0).toUpperCase() || "☺";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none"
      style={{ width: px, height: px, backgroundColor: color || "#8A8F98", fontSize: Math.round(px * 0.42) }}
    >
      {initial}
    </Tag>
  );
}
