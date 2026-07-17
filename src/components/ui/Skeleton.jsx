import s from "./Skeleton.module.css";

// Loading placeholder block. Size via width/height (numbers = px).
//   <Skeleton height={92} />  <Skeleton width="60%" height={14} />
export default function Skeleton({ width = "100%", height = 14, round = false, className }) {
  return (
    <div
      aria-hidden="true"
      className={[s.block, round && s.round, className].filter(Boolean).join(" ")}
      style={{ width, height }}
    />
  );
}
