import { useState } from "react";
import { saveKey } from "../lib/storage.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

export default function BookingsTab({ bookings, setBookings, membersById, myId }) {
  const [newItem, setNewItem] = useState("");
  const done = bookings.filter((b) => b.done).length;
  const persist = (next) => { setBookings(next); saveKey("trip-bookings", next); };
  const toggle = (id) => persist(bookings.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    persist([...bookings, { id: Date.now(), text: t, urgent: false, done: false, addedBy: myId }]);
    setNewItem("");
  };
  const remove = (id) => persist(bookings.filter((b) => b.id !== id));

  const sorted = [...bookings].sort((a, b) => (a.done - b.done) || (b.urgent - a.urgent));

  return (
    <div>
      <SectionTitle sub={`${done} of ${bookings.length} booked · shared`}>Booking checklist</SectionTitle>
      <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        {sorted.map((b, i) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < sorted.length - 1 ? "1px solid #F0EDE6" : "none", backgroundColor: b.urgent && !b.done ? "#FBE9EC" : "transparent" }}>
            <button
              onClick={() => toggle(b.id)}
              className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ borderColor: b.done ? "#2E7D4F" : b.urgent ? "#C8102E" : "#C9C5BB", backgroundColor: b.done ? "#2E7D4F" : "transparent" }}
            >
              {b.done ? "✓" : ""}
            </button>
            <div className="flex-1">
              <span className="text-sm" style={{ color: b.done ? "#B8B5AD" : "#1D2433", textDecoration: b.done ? "line-through" : "none" }}>{b.text}</span>
              {b.urgent && !b.done && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#C8102E", color: "#FFF" }}>URGENT</span>}
              {b.addedBy && <span className="ml-2 align-middle"><PersonBadge member={membersById[b.addedBy]} size="xs" /></span>}
            </div>
            <button onClick={() => remove(b.id)} className="text-xs px-1" style={{ color: "#C9C5BB" }}>✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a booking…"
          className="flex-1 text-sm rounded-full border px-4 py-2.5"
          style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: "#1D2433" }}
        />
        <button onClick={add} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "#1D2433" }}>Add</button>
      </div>
    </div>
  );
}
