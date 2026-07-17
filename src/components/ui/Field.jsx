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

// Vertical form container that owns the rhythm between its children — Fields,
// toggle rows, FieldRows alike. Always wrap a form in this; Field itself
// carries no outer margin.
export function FormStack({ className, children }) {
  return <div className={[s.stack, className].filter(Boolean).join(" ")}>{children}</div>;
}

// Side-by-side pair inside a FormStack (e.g. first/last day). Children split
// the width evenly; give one a width via className for fixed columns.
export function FieldRow({ className, children }) {
  return <div className={[s.row, className].filter(Boolean).join(" ")}>{children}</div>;
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
