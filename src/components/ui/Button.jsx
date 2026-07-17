import Icon from "./icons.jsx";
import s from "./Button.module.css";

const VARIANTS = { primary: s.primary, tonal: s.tonal, ghost: s.ghost, danger: s.danger };

// Grand Tour button: control height 46 (sm: 36), radius 6, sans 600.
// primary = accent fill + accent-ink; tonal = chip; ghost = borderless muted;
// danger = danger fill (accent-ink works as its on-colour in both themes).
export default function Button({
  variant = "primary",
  size = "md",
  icon,
  full = false,
  type = "button",
  className,
  children,
  ...rest
}) {
  const cls = [s.btn, VARIANTS[variant] || s.primary, size === "sm" && s.sm, full && s.full, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 15} />}
      {children}
    </button>
  );
}
