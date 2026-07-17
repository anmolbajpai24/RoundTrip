import s from "./SwatchPicker.module.css";

// Colour swatch row (member colour in profile/onboarding/wizard, destination
// colour in settings). Pass MEMBER_COLORS or DEST_COLORS from theme.js.
//   <SwatchPicker colors={MEMBER_COLORS} value={color} onChange={setColor} />
export default function SwatchPicker({ colors, value, onChange, disabled = false }) {
  return (
    <div className={s.row} role="radiogroup" aria-label="Colour">
      {colors.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          disabled={disabled}
          className={[s.swatch, value === c && s.selected].filter(Boolean).join(" ")}
          style={{ "--c": c }}
          onClick={() => onChange?.(c)}
        />
      ))}
    </div>
  );
}
