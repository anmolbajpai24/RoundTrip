import { onColor } from "../../theme.js";
import Icon from "./icons.jsx";
import s from "./SwatchPicker.module.css";

// Colour swatch row (member colour in profile/onboarding/wizard, destination
// colour in settings): ring targets around colour dots, check on the pick.
//   <SwatchPicker colors={MEMBER_COLORS} value={color} onChange={setColor} />
export default function SwatchPicker({ colors, value, onChange, disabled = false, size }) {
  return (
    <div className={[s.row, size === "lg" && s.lg].filter(Boolean).join(" ")} role="radiogroup" aria-label="Colour">
      {colors.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            role="radio"
            aria-checked={selected}
            aria-label={c}
            disabled={disabled}
            className={[s.swatch, selected && s.selected].filter(Boolean).join(" ")}
            style={{ "--c": c, "--on": onColor(c) }}
            onClick={() => onChange?.(c)}
          >
            <span className={s.dot}>
              {selected && <Icon name="check" size={size === "lg" ? 13 : 11} strokeWidth={2.4} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
