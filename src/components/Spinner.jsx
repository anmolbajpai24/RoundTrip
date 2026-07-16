// Minimal inline spinner for busy buttons and loading rows.
export default function Spinner({ className = "w-4 h-4", light = false }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border-2 animate-spin align-middle ${className}`}
      style={{ borderColor: light ? "rgba(255,255,255,0.8)" : "var(--muted)", borderTopColor: "transparent" }}
    />
  );
}
