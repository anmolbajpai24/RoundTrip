import { useState } from "react";
import { saveKey } from "../lib/storage.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

// Categories offered before the list has any of its own.
const SUGGESTED_CATS = ["Documents", "Clothes", "Toiletries", "Tech", "Other"];

export default function PackingTab({ packingAll, setPackingAll, membersById, myId }) {
  const [newItem, setNewItem] = useState("");
  const [selectedCat, setSelectedCat] = useState("Documents");
  const [addingCat, setAddingCat] = useState(false);
  const [customCat, setCustomCat] = useState("");

  const mine = packingAll[myId] || [];
  const persistMine = (next) => {
    setPackingAll((prev) => ({ ...prev, [myId]: next }));
    saveKey("trip-packing", next);
  };
  const toggle = (id) => persistMine(mine.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  const remove = (id) => persistMine(mine.filter((p) => p.id !== id));

  const commitCat = () => {
    const c = customCat.trim();
    if (c) setSelectedCat(c);
    setCustomCat("");
    setAddingCat(false);
  };

  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    const cat = (addingCat && customCat.trim()) ? customCat.trim() : selectedCat;
    persistMine([...mine, { id: Date.now(), cat, text: t, done: false }]);
    setNewItem("");
    if (addingCat && customCat.trim()) commitCat();
    else setSelectedCat(cat);
  };

  // Merge every member's items, tagged with their owner.
  const allItems = Object.entries(packingAll).flatMap(([owner, items]) =>
    (items || []).map((it) => ({ ...it, owner }))
  );
  const cats = [...new Set(allItems.map((p) => p.cat))];

  // Category chips to pick from: the standard suggestions are always shown, plus
  // any custom categories already in use and whatever is currently selected.
  const catOptions = [...new Set([...SUGGESTED_CATS, ...cats, selectedCat])];

  // Per-person progress.
  const perPerson = Object.entries(packingAll).map(([owner, items]) => ({
    member: membersById[owner],
    owner,
    done: (items || []).filter((i) => i.done).length,
    total: (items || []).length,
  })).filter((x) => x.total > 0);

  const doneAll = allItems.filter((p) => p.done).length;
  const isEmpty = allItems.length === 0;

  return (
    <div>
      <SectionTitle sub={isEmpty ? "Nothing packed yet" : `${doneAll} of ${allItems.length} packed · everyone`}>Packing list</SectionTitle>

      {!isEmpty && (
        <div className="h-2 rounded-full mb-3" style={{ backgroundColor: "var(--chip)" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${(doneAll / allItems.length) * 100}%`, backgroundColor: "#2E7D4F" }} />
        </div>
      )}

      {perPerson.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {perPerson.map((p) => (
            <span key={p.owner} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--chip)", color: "var(--ink)" }}>
              <PersonBadge member={p.member} size="xs" /> {p.done}/{p.total}
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-2xl border border-dashed px-5 py-7 mb-4 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="text-3xl mb-2">🧳</div>
          <div className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>Start your packing list</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Pick a category below, then add what you want to bring.
          </div>
        </div>
      ) : (
        cats.map((cat) => (
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
        ))
      )}

      <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {catOptions.map((c) => {
            const active = !addingCat && c === selectedCat;
            return (
              <button
                key={c}
                onClick={() => { setSelectedCat(c); setAddingCat(false); }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: active ? "#2E7D4F" : "var(--border)",
                  backgroundColor: active ? "#2E7D4F" : "transparent",
                  color: active ? "#fff" : "var(--muted)",
                }}
              >
                {c}
              </button>
            );
          })}
          {addingCat ? (
            <input
              autoFocus
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCat();
                if (e.key === "Escape") { setCustomCat(""); setAddingCat(false); }
              }}
              onBlur={commitCat}
              placeholder="New category…"
              className="text-[11px] font-semibold rounded-full border px-2.5 py-1 w-28"
              style={{ borderColor: "#2E7D4F", backgroundColor: "transparent", color: "var(--ink)" }}
            />
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed"
              style={{ borderColor: "var(--faint)", color: "var(--muted)" }}
            >
              + Category
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Add to ${addingCat && customCat.trim() ? customCat.trim() : selectedCat}…`}
            className="flex-1 text-sm rounded-full border px-4 py-2.5"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: "var(--ink)" }}
          />
          <button onClick={add} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "var(--solid)" }}>Add</button>
        </div>
      </div>
    </div>
  );
}
