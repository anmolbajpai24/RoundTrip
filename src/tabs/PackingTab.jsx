import { useState } from "react";
import { saveKey } from "../lib/storage.js";
import PersonBadge from "../components/PersonBadge.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import s from "./PackingTab.module.css";

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
      {!isEmpty && (
        <>
          <div className={s.hero}>
            <span className={s.heroNum}>{doneAll}</span>
            <span className={s.heroText}>of {allItems.length} packed · everyone</span>
          </div>
          <ProgressBar value={doneAll} max={allItems.length} color="var(--success)" route className={s.progress} />
        </>
      )}

      {perPerson.length > 1 && (
        <div className={s.people}>
          {perPerson.map((p) => (
            <span key={p.owner} className={s.personChip}>
              <PersonBadge member={p.member} size="xs" /> {p.done}/{p.total}
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <EmptyState hero title="Pack together, forget nothing." body="Pick a category below, then add what you want to bring — everyone sees everyone's list." className={s.empty} />
      ) : (
        cats.map((cat) => (
          <div key={cat} className={s.catBlock}>
            <div className={s.catHead}>{cat}</div>
            <div className={s.list}>
              {allItems.filter((p) => p.cat === cat).map((p) => {
                const isMine = p.owner === myId;
                return (
                  <div key={`${p.owner}-${p.id}`} className={[s.row, p.done && s.rowDone].filter(Boolean).join(" ")}>
                    <button
                      onClick={() => isMine && toggle(p.id)}
                      disabled={!isMine}
                      aria-label={p.text}
                      className={[s.check, p.done && s.checkDone].filter(Boolean).join(" ")}
                    >
                      {p.done && <Icon name="check" size={12} strokeWidth={2} />}
                    </button>
                    <span className={s.itemText}>{p.text}</span>
                    <PersonBadge member={membersById[p.owner]} size="disc" />
                    {isMine && <button onClick={() => remove(p.id)} aria-label="Remove" className={s.rowRemove}><Icon name="x" size={13} strokeWidth={2} /></button>}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div className={s.addCard}>
        <div className={s.catPicker}>
          {catOptions.map((c) => {
            const active = !addingCat && c === selectedCat;
            return (
              <button key={c} onClick={() => { setSelectedCat(c); setAddingCat(false); }}
                className={[s.catChip, active && s.catChipActive].filter(Boolean).join(" ")}>
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
              className={s.catInput}
            />
          ) : (
            <button onClick={() => setAddingCat(true)} className={s.catChipAdd}>+ Category</button>
          )}
        </div>
        <div className={s.addRow}>
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Add to ${addingCat && customCat.trim() ? customCat.trim() : selectedCat}…`}
          />
          <Button onClick={add}>Add</Button>
        </div>
      </div>
    </div>
  );
}
