import s from "./Field.module.css";

// Labeled form row: tracked-caps label above the control.
//   <Field label="Trip name"><Input value={…} onChange={…} /></Field>
export default function Field({ label, hint, children }) {
  return (
    <label className={s.field}>
      {label && <span className={s.label}>{label}</span>}
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
}

// Grand Tour text input: field bg, hairline border, control radius/height.
// `code` styles one-shot codes (tracked caps, centered, tabular).
export function Input({ code = false, className, ...rest }) {
  return <input className={[s.input, code && s.code, className].filter(Boolean).join(" ")} {...rest} />;
}

export function TextArea({ className, ...rest }) {
  return <textarea className={[s.input, s.area, className].filter(Boolean).join(" ")} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={[s.input, s.select, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}
