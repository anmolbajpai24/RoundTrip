import Icon from "./icons.jsx";
import s from "./Segmented.module.css";

// Segmented control (List/Map, gallery modes, theme picker…).
//   <Segmented value={view} onChange={setView}
//     options={[{ id: "list", label: "List", icon: "grip" }, …]} />
export default function Segmented({ value, onChange, options, className }) {
  return (
    <div role="tablist" className={[s.track, className].filter(Boolean).join(" ")}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={[s.seg, value === o.id && s.active].filter(Boolean).join(" ")}
          onClick={() => onChange(o.id)}
        >
          {o.icon && <Icon name={o.icon} size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
