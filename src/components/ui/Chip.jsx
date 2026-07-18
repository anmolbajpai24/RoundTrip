import s from "./Chip.module.css";

// Fully-round pill chip. With `color`, shows a member/destination dot (the
// custom-property bridge keeps data-driven colour out of inline styles).
//   <Chip color={member.color}>{member.name}</Chip>
//   <Chip active onClick={…}>Food</Chip>
export default function Chip({ color, active = false, onClick, className, children, ...rest }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={[s.chip, active && s.active, className].filter(Boolean).join(" ")}
      style={color ? { "--c": color } : undefined}
      {...rest}
    >
      {color && <span className={s.dot} />}
      {children}
    </Tag>
  );
}
