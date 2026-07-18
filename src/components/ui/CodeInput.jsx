import s from "./CodeInput.module.css";

// Six serif code cells over one real (invisible) input, so paste, autofill
// and mobile keyboards all behave. Fires onComplete when the last cell fills.
//   <CodeInput value={code} onChange={setCode} onComplete={doJoin} />
export default function CodeInput({ value, onChange, onComplete, length = 6, autoFocus = false, label = "Trip code" }) {
  const handle = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, length);
    onChange(v);
    if (v.length === length && v !== value) onComplete?.(v);
  };
  return (
    <label className={s.wrap}>
      <input
        className={s.hidden}
        value={value}
        onChange={handle}
        autoFocus={autoFocus}
        aria-label={label}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        maxLength={length}
      />
      <span className={s.cells} aria-hidden="true">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={[s.cell, i === Math.min(value.length, length - 1) && value.length < length && s.cellCursor].filter(Boolean).join(" ")}>
            {value[i] || ""}
          </span>
        ))}
      </span>
    </label>
  );
}
