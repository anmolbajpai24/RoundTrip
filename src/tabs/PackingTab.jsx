import { useState } from "react";
import { saveKey } from "../lib/storage.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

export default function PackingTab({ packingAll, setPackingAll, membersById, myId }) {
  const [newItem, setNewItem] = useState("");

  const mine = packingAll[myId] || [];
  const persistMine = (next) => {
    setPackingAll((prev) => ({ ...prev, [myId]: next }));
    saveKey("trip-packing", next);
  };
  const toggle = (id) => persistMine(mine.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  const remove = (id) => persistMine(mine.filter((p) => p.id !== id));
  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    persistMine([...mine, { id: Date.now(), cat: "Other", text: t, done: false }]);
    setNewItem("");
  };

  // Merge every member's items, tagged with their owner.
  const allItems = Object.entries(packingAll).flatMap(([owner, items]) =>
    (items || []).map((it) => ({ ...it, owner }))
  );
  const cats = [...new Set(allItems.map((p) => p.cat))];

  // Per-person progress.
  const perPerson = Object.entries(packingAll).map(([owner, items]) => ({
    member: membersById[owner],
    owner,
    done: (items || []).filter((i) => i.done).length,
    total: (items || []).length,
  })).filter((x) => x.total > 0);

  const doneAll = allItems.filter((p) => p.done).length;

  return (
    <div>
      <SectionTitle sub={`${doneAll} of ${allItems.length} packed · everyone`}>Packing list</SectionTitle>

      <div className="h-2 rounded-full mb-3" style={{ backgroundColor: "var(--chip)" }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${allItems.length ? (doneAll / allItems.length) * 100 : 0}%`, backgroundColor: "#2E7D4F" }} />
      </div>

      {perPerson.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {perPerson.map((p) => (
            <span key={p.owner} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--chip)", color: "var(--ink)" }}>
              <PersonBadge member={p.member} size="xs" /> {p.done}/{p.total}
            </span>
          ))}
        </div>
      )}

      {cats.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>{cat}</div>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            {allItems.filter((p) => p.cat === cat).map((p, i, arr) => {
              const isMine = p.owner === myId;
              return (
                <div key={`${p.owner}-${p.id}`} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--divider)" : "none" }}>
                  <button
                    onClick={() => isMine && toggle(p.id)}
                    disabled={!isMine}
                    className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ borderColor: p.done ? "#2E7D4F" : "var(--faint)", backgroundColor: p.done ? "#2E7D4F" : "transparent", opacity: isMine ? 1 : 0.7 }}
                  >
                    {p.done ? "✓" : ""}
                  </button>
                  <span className="text-sm flex-1" style={{ color: p.done ? "var(--faint)" : "var(--ink)", textDecoration: p.done ? "line-through" : "none" }}>{p.text}</span>
                  <PersonBadge member={membersById[p.owner]} size="xs" />
                  {isMine && <button onClick={() => remove(p.id)} className="text-xs px-1" style={{ color: "var(--faint)" }}>✕</button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an item to your list…"
          className="flex-1 text-sm rounded-full border px-4 py-2.5"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--ink)" }}
        />
        <button onClick={add} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "var(--solid)" }}>Add</button>
      </div>
    </div>
  );
}
