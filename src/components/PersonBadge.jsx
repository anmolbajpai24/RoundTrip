// A small coloured chip showing who a piece of data belongs to.
// `member` is { name, color }; falls back gracefully if unknown.
export default function PersonBadge({ member, size = "sm" }) {
  const name = member?.name || "Someone";
  const color = member?.color || "#8A8F98";
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${pad}`} style={{ backgroundColor: color, color: "#FFF" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
      {name}
    </span>
  );
}
