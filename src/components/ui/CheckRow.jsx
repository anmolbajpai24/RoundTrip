import Icon from "./icons.jsx";
import s from "./CheckRow.module.css";

// Checklist row (packing items, booking done-marks): round check target,
// label, optional meta line and trailing slot (member dot, remove button…).
//   <CheckRow checked={item.done} onToggle={…} label={item.name} meta="2×" />
export default function CheckRow({ checked, onToggle, label, meta, trailing, className }) {
  return (
    <div className={[s.row, checked && s.done, className].filter(Boolean).join(" ")}>
      <button
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        className={s.box}
        onClick={onToggle}
      >
        {checked && <Icon name="check" size={12} strokeWidth={2} />}
      </button>
      <div className={s.body} onClick={onToggle}>
        <span className={s.label}>{label}</span>
        {meta && <span className={s.meta}>{meta}</span>}
      </div>
      {trailing}
    </div>
  );
}
