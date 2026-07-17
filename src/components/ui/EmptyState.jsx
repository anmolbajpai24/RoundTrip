import Icon from "./icons.jsx";
import s from "./EmptyState.module.css";

// Quiet centered empty/error/offline state.
//   <EmptyState icon="cloudoff" title="You're offline"
//     body="The map needs a connection — everything else keeps working." />
export default function EmptyState({ icon, title, body, action, className }) {
  return (
    <div className={[s.wrap, className].filter(Boolean).join(" ")}>
      {icon && (
        <div className={s.icon}>
          <Icon name={icon} size={22} />
        </div>
      )}
      {title && <p className={s.title}>{title}</p>}
      {body && <p className={s.body}>{body}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
