import s from "./Toggle.module.css";

// Switch. Accessible checkbox under the hood.
//   <Toggle checked={on} onChange={setOn} label="Shared with the group" />
export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={[s.wrap, disabled && s.disabled].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        role="switch"
        className={s.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className={s.track} aria-hidden="true">
        <span className={s.knob} />
      </span>
      {label && <span className={s.label}>{label}</span>}
    </label>
  );
}
