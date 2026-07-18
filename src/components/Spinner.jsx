import s from "./Spinner.module.css";

// Minimal inline spinner for busy buttons and loading rows.
// `on` names the token the ring rides on: "ink" (default) or "accent" (on an
// accent-filled button, where the ring must read against accent-ink).
export default function Spinner({ size = 16, on = "ink", className }) {
  return (
    <span
      aria-hidden="true"
      className={[s.spinner, on === "accent" && s.onAccent, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    />
  );
}
