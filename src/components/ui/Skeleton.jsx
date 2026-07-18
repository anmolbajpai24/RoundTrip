import s from "./Skeleton.module.css";

// Static loading placeholder block (mirrors the loaded layout, no motion).
// Size via width/height (numbers = px); `thumb` = 8px image radius.
//   <Skeleton height={92} />  <Skeleton width="60%" height={14} />
export default function Skeleton({ width = "100%", height = 14, round = false, thumb = false, className }) {
  return (
    <div
      aria-hidden="true"
      className={[s.block, thumb && s.thumb, round && s.round, className].filter(Boolean).join(" ")}
      style={{ width, height }}
    />
  );
}
