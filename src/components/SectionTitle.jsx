import s from "./SectionTitle.module.css";

export default function SectionTitle({ children, sub }) {
  return (
    <div className={s.wrap}>
      <h2 className={s.title}>{children}</h2>
      {sub && <p className={s.sub}>{sub}</p>}
    </div>
  );
}
