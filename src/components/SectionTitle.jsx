export default function SectionTitle({ children, sub }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold" style={{ color: "#1D2433" }}>{children}</h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#8A8F98" }}>{sub}</p>}
    </div>
  );
}
