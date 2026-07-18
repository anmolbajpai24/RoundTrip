import { DEST_COLORS } from "../../theme.js";
import Icon from "./icons.jsx";
import s from "./EmptyState.module.css";

// Quiet empty/error/offline state: the route motif (or an icon), an
// italic-serif line, one action — left-aligned, always.
//   <EmptyState title="Nothing here yet — happily."
//     action={<Button size="sm" variant="ghost">Add the first one</Button>} />
export default function EmptyState({ icon, title, body, action, hero = false, className }) {
  return (
    <div className={[s.wrap, hero && s.hero, className].filter(Boolean).join(" ")}>
      {icon ? (
        <div className={s.icon}><Icon name={icon} size={20} /></div>
      ) : (
        <div className={s.motif} aria-hidden="true">
          <span className={s.motifDot} style={{ backgroundColor: DEST_COLORS[0] }} />
          <span className={s.motifSeg} />
          <span className={s.motifDot} style={{ backgroundColor: DEST_COLORS[1] }} />
          <span className={s.motifSeg} />
          <span className={s.motifDot} style={{ backgroundColor: DEST_COLORS[2] }} />
        </div>
      )}
      {title && <p className={s.title}>{title}</p>}
      {body && <p className={s.body}>{body}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
