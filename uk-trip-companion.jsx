import { useState, useEffect, useRef } from "react";

// ---------- Trip constants ----------
const GBP_TO_INR = 127;
const BUDGET_GBP = 3415;
const TRIP_START = new Date("2026-08-07T00:00:00");

const LEGS = {
  london: { name: "London", color: "#C8102E", soft: "#FBE9EC" },
  bath: { name: "Bath", color: "#C77E1F", soft: "#FBF1E2" },
  lakes: { name: "Lake District", color: "#2E7D4F", soft: "#E7F3EC" },
  edinburgh: { name: "Edinburgh", color: "#5B3B8C", soft: "#EFE9F7" },
  york: { name: "York", color: "#0F7C8C", soft: "#E5F2F4" },
};

const DAYS = [
  { d: 7, leg: "london", title: "Arrive London", plan: "Land, settle in at your sister's place, easy evening walk nearby." },
  { d: 8, leg: "london", title: "London warm-up", plan: "Local exploring — South Bank stroll, adjust to the timezone." },
  { d: 9, leg: "london", title: "London · conference day 1", plan: "She's at the conference. Solo: British Museum (free), Covent Garden." },
  { d: 10, leg: "london", title: "London · conference day 2", plan: "Solo: Tower Bridge, Borough Market lunch. Evening together." },
  { d: 11, leg: "london", title: "London · conference day 3", plan: "Solo: National Gallery, Trafalgar Square. Evening: West End area." },
  { d: 12, leg: "london", title: "London · conference day 4", plan: "Last conference day. Pack for the loop, book any last trains." },
  { d: 13, leg: "bath", title: "Train to Bath", plan: "Paddington → Bath Spa (~1h20). Roman Baths in the afternoon." },
  { d: 14, leg: "bath", title: "Bath", plan: "Royal Crescent, Pulteney Bridge, Thermae Bath Spa rooftop (book ahead)." },
  { d: 15, leg: "lakes", title: "Bath → Lake District", plan: "Long rail day via Bristol/Birmingham → Oxenholme → Windermere." },
  { d: 16, leg: "lakes", title: "Lake District", plan: "Windermere lake cruise, Bowness, short fell walk (Orrest Head)." },
  { d: 17, leg: "edinburgh", title: "Lakes → Edinburgh", plan: "Oxenholme → Edinburgh Waverley (~2h). Evening: first Fringe show!" },
  { d: 18, leg: "edinburgh", title: "Edinburgh · Fringe", plan: "Royal Mile street acts, Edinburgh Castle, evening Fringe shows." },
  { d: 19, leg: "edinburgh", title: "Edinburgh · Fringe", plan: "Arthur's Seat hike (morning), Old Town, more Fringe — mix free + paid." },
  { d: 20, leg: "york", title: "Edinburgh → York", plan: "East Coast Main Line (~2h30). Evening: city walls walk at sunset." },
  { d: 21, leg: "york", title: "York", plan: "York Minster, The Shambles, Railway Museum (free), ghost walk." },
  { d: 22, leg: "london", title: "York → London", plan: "Train back to King's Cross (~2h). Rest evening at sister's." },
  { d: 23, leg: "london", title: "London · slow day", plan: "Laundry, recover, neighbourhood cafés, plan the day-trip week." },
  { d: 24, leg: "london", title: "Day trip · Oxford", plan: "Colleges, Bodleian, covered market. ~1h from Paddington/Marylebone." },
  { d: 25, leg: "london", title: "Day trip · Cambridge", plan: "Punting on the Cam, King's College. ~50min from King's Cross." },
  { d: 26, leg: "london", title: "Day trip · Brighton", plan: "Pier, The Lanes, beach. ~1h from Victoria. Fish & chips by the sea." },
  { d: 27, leg: "london", title: "Day trip · Windsor", plan: "Windsor Castle, Eton walk. ~40min from Paddington via Slough." },
  { d: 28, leg: "london", title: "London · shopping", plan: "Gifts + shopping: Oxford Street, Camden or Portobello Market." },
  { d: 29, leg: "london", title: "Last full day", plan: "Favourite spot revisit, dinner with your sister, pack properly." },
  { d: 30, leg: "london", title: "Fly home", plan: "Airport day. Leave buffer for the Tube/Elizabeth line with bags." },
];

const DEFAULT_PACKING = [
  ["Documents", ["Passports + visa printouts", "Travel insurance PDF", "Niyo Global SBM card", "ICICI Multicurrency backup card", "Two Together Railcard", "Flight + train confirmations"]],
  ["Clothes", ["Light rain jacket (UK August!)", "1 warm layer / fleece", "Comfortable walking shoes", "1 nicer outfit for evenings", "Compact umbrella"]],
  ["Tech", ["UK plug adapters (Type G) ×2", "Power bank", "Phone chargers", "Earphones"]],
  ["Other", ["Medicines + basic first aid", "Day backpack for the loop", "Gifts for Gemma & Neil", "Reusable water bottle"]],
];

const DEFAULT_BOOKINGS = [
  { text: "Edinburgh Fringe beds (17–20 Aug) — BOOK FIRST, scarce & 2–3× price", urgent: true },
  { text: "Two Together Railcard (£35, both photos needed)", urgent: true },
  { text: "Advance train tickets for the loop (cheapest ~12 weeks out)", urgent: true },
  { text: "Bath accommodation (13–15 Aug)", urgent: false },
  { text: "Lake District accommodation (15–17 Aug)", urgent: false },
  { text: "York accommodation (20–22 Aug)", urgent: false },
  { text: "Thermae Bath Spa slot", urgent: false },
  { text: "2–3 paid Fringe shows (rest free)", urgent: false },
  { text: "Edinburgh Castle tickets (timed entry)", urgent: false },
  { text: "Windsor Castle tickets", urgent: false },
];

const dayKey = (d) => `d${d}`;
const dateLabel = (d) => `${d} Aug`;
const weekday = (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(2026, 7, d).getDay()];

// ---------- Storage helpers ----------
async function loadKey(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("save failed", key, e);
  }
}

// ---------- Image compression ----------
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Small UI atoms ----------
function LegChip({ leg }) {
  const L = LEGS[leg];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: L.color, backgroundColor: L.soft }}
    >
      {L.name}
    </span>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold" style={{ color: "#1D2433" }}>{children}</h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#8A8F98" }}>{sub}</p>}
    </div>
  );
}

// ---------- Day selector (ticket strip) ----------
function DayStrip({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
      {DAYS.map((day) => {
        const L = LEGS[day.leg];
        const active = selected === day.d;
        return (
          <button
            key={day.d}
            onClick={() => onSelect(day.d)}
            className="flex-shrink-0 rounded-xl px-3 py-2 text-center border transition-transform"
            style={{
              backgroundColor: active ? L.color : "#FFFFFF",
              borderColor: active ? L.color : "#E5E2DA",
              color: active ? "#FFF" : "#1D2433",
              minWidth: 56,
              transform: active ? "scale(1.05)" : "none",
            }}
          >
            <div className="text-[10px] font-medium" style={{ opacity: 0.7 }}>{weekday(day.d)}</div>
            <div className="text-base font-bold" style={{ fontFamily: "ui-monospace, monospace" }}>{day.d}</div>
            <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1" style={{ backgroundColor: active ? "#FFF" : L.color }} />
          </button>
        );
      })}
    </div>
  );
}

// ---------- Itinerary tab ----------
function ItineraryTab({ overrides, setOverrides, outfits, goToOutfit }) {
  const today = new Date();
  const isDuringTrip = today.getFullYear() === 2026 && today.getMonth() === 7 && today.getDate() >= 7 && today.getDate() <= 30;
  const [selected, setSelected] = useState(isDuringTrip ? today.getDate() : 7);
  const day = DAYS.find((x) => x.d === selected);
  const ov = overrides[dayKey(selected)] || {};
  const L = LEGS[day.leg];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => { setDraft(ov.notes || ""); setEditing(true); };
  const saveEdit = () => {
    const next = { ...overrides, [dayKey(selected)]: { ...ov, notes: draft } };
    setOverrides(next);
    saveKey("trip-itinerary", next);
    setEditing(false);
  };

  const outfit = outfits[dayKey(selected)];

  return (
    <div>
      <SectionTitle sub="7 – 30 August 2026 · tap a day">Itinerary</SectionTitle>
      <DayStrip selected={selected} onSelect={(d) => { setSelected(d); setEditing(false); }} />

      <div className="mt-3 rounded-2xl overflow-hidden border" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: L.color }}>
          <div>
            <div className="text-white font-bold text-base">{day.title}</div>
            <div className="text-white text-xs" style={{ opacity: 0.85, fontFamily: "ui-monospace, monospace" }}>
              {weekday(day.d)} · {dateLabel(day.d)}
            </div>
          </div>
          <LegChip leg={day.leg} />
        </div>
        <div className="p-4">
          <p className="text-sm leading-relaxed" style={{ color: "#1D2433" }}>{day.plan}</p>

          {outfit?.photo && (
            <button onClick={() => goToOutfit(selected)} className="mt-3 flex items-center gap-3 w-full rounded-xl border p-2" style={{ borderColor: "#E5E2DA" }}>
              <img src={outfit.photo} alt="Outfit" className="w-12 h-12 rounded-lg object-cover" />
              <div className="text-left">
                <div className="text-xs font-semibold" style={{ color: "#1D2433" }}>Outfit planned</div>
                <div className="text-xs" style={{ color: "#8A8F98" }}>{outfit.desc || "Tap to view"}</div>
              </div>
            </button>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Your notes</span>
              {!editing && (
                <button onClick={startEdit} className="text-xs font-semibold" style={{ color: L.color }}>
                  {ov.notes ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="Bookings, timings, addresses, show names…"
                  className="w-full text-sm rounded-xl border p-3"
                  style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveEdit} className="text-xs font-bold text-white px-4 py-2 rounded-full" style={{ backgroundColor: L.color }}>Save note</button>
                  <button onClick={() => setEditing(false)} className="text-xs font-semibold px-4 py-2 rounded-full" style={{ color: "#8A8F98" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: ov.notes ? "#1D2433" : "#B8B5AD" }}>
                {ov.notes || "Nothing yet — add train times, addresses, or show bookings."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Outfits tab ----------
function OutfitsTab({ outfits, setOutfits, initialDay }) {
  const [selected, setSelected] = useState(initialDay || 7);
  const day = DAYS.find((x) => x.d === selected);
  const L = LEGS[day.leg];
  const key = dayKey(selected);
  const outfit = outfits[key] || {};
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(outfit.desc || "");

  useEffect(() => { setDesc((outfits[dayKey(selected)] || {}).desc || ""); }, [selected, outfits]);

  const persist = async (next) => {
    setOutfits((prev) => ({ ...prev, [key]: next }));
    await saveKey(`outfit:${key}`, next);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const photo = await compressImage(file);
      await persist({ ...outfit, photo, desc });
    } catch (err) {
      console.error(err);
    }
    setBusy(false);
    e.target.value = "";
  };

  const saveDesc = () => persist({ ...outfit, desc });
  const removePhoto = async () => {
    const next = { ...outfit, photo: null };
    await persist(next);
  };

  const plannedCount = Object.values(outfits).filter((o) => o?.photo || o?.desc).length;

  return (
    <div>
      <SectionTitle sub={`${plannedCount} of 24 days planned`}>Outfit planner</SectionTitle>
      <DayStrip selected={selected} onSelect={setSelected} />

      <div className="mt-3 rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "#F0EDE6" }}>
          <span className="text-sm font-bold" style={{ color: "#1D2433" }}>{weekday(selected)} {dateLabel(selected)} · {day.title}</span>
          <LegChip leg={day.leg} />
        </div>

        <div className="p-4">
          {outfit.photo ? (
            <div className="relative">
              <img src={outfit.photo} alt={`Outfit for ${dateLabel(selected)}`} className="w-full rounded-xl object-cover" style={{ maxHeight: 380 }} />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "rgba(29,36,51,0.75)" }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-2"
              style={{ borderColor: L.color, backgroundColor: L.soft }}
            >
              <span className="text-3xl">📸</span>
              <span className="text-sm font-bold" style={{ color: L.color }}>
                {busy ? "Saving photo…" : "Add outfit photo"}
              </span>
              <span className="text-xs" style={{ color: "#8A8F98" }}>Lay it out on the bed & snap it</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

          {outfit.photo && (
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="mt-2 text-xs font-semibold" style={{ color: L.color }}>
              {busy ? "Saving…" : "Replace photo"}
            </button>
          )}

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A8F98" }}>What you're wearing</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              rows={2}
              placeholder="e.g. Black tee, olive chinos, rain jacket, white sneakers"
              className="mt-1 w-full text-sm rounded-xl border p-3"
              style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#B8B5AD" }}>Saved automatically when you tap away.</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>All planned outfits</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {DAYS.map((d) => {
            const o = outfits[dayKey(d.d)];
            const Lg = LEGS[d.leg];
            return (
              <button key={d.d} onClick={() => { setSelected(d.d); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl overflow-hidden border text-left" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
                {o?.photo ? (
                  <img src={o.photo} alt="" className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center text-lg" style={{ backgroundColor: Lg.soft }}>
                    {o?.desc ? "📝" : "＋"}
                  </div>
                )}
                <div className="px-1.5 py-1 text-[10px] font-semibold" style={{ color: "#1D2433" }}>{d.d} Aug</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Packing tab ----------
function PackingTab({ packing, setPacking }) {
  const [newItem, setNewItem] = useState("");
  const done = packing.filter((p) => p.done).length;

  const persist = (next) => { setPacking(next); saveKey("trip-packing", next); };
  const toggle = (id) => persist(packing.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    persist([...packing, { id: Date.now(), cat: "Other", text: t, done: false }]);
    setNewItem("");
  };
  const remove = (id) => persist(packing.filter((p) => p.id !== id));

  const cats = [...new Set(packing.map((p) => p.cat))];

  return (
    <div>
      <SectionTitle sub={`${done} of ${packing.length} packed`}>Packing list</SectionTitle>

      <div className="h-2 rounded-full mb-4" style={{ backgroundColor: "#EDEAE2" }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${packing.length ? (done / packing.length) * 100 : 0}%`, backgroundColor: "#2E7D4F" }} />
      </div>

      {cats.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#8A8F98" }}>{cat}</div>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
            {packing.filter((p) => p.cat === cat).map((p, i, arr) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid #F0EDE6" : "none" }}>
                <button
                  onClick={() => toggle(p.id)}
                  className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ borderColor: p.done ? "#2E7D4F" : "#C9C5BB", backgroundColor: p.done ? "#2E7D4F" : "transparent" }}
                >
                  {p.done ? "✓" : ""}
                </button>
                <span className="text-sm flex-1" style={{ color: p.done ? "#B8B5AD" : "#1D2433", textDecoration: p.done ? "line-through" : "none" }}>{p.text}</span>
                <button onClick={() => remove(p.id)} className="text-xs px-1" style={{ color: "#C9C5BB" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an item…"
          className="flex-1 text-sm rounded-full border px-4 py-2.5"
          style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: "#1D2433" }}
        />
        <button onClick={add} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "#1D2433" }}>Add</button>
      </div>
    </div>
  );
}

// ---------- Budget tab ----------
function BudgetTab({ expenses, setExpenses }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const CATS = ["Food", "Transport", "Stay", "Sights", "Shows", "Shopping", "Other"];

  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = BUDGET_GBP - spent;
  const pct = Math.min(100, (spent / BUDGET_GBP) * 100);

  const persist = (next) => { setExpenses(next); saveKey("trip-expenses", next); };
  const add = () => {
    const a = parseFloat(amount);
    if (!desc.trim() || isNaN(a) || a <= 0) return;
    persist([{ id: Date.now(), desc: desc.trim(), amount: a, cat, ts: new Date().toISOString() }, ...expenses]);
    setDesc(""); setAmount("");
  };
  const remove = (id) => persist(expenses.filter((e) => e.id !== id));

  const byCat = CATS.map((c) => ({ c, total: expenses.filter((e) => e.cat === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.total > 0);

  return (
    <div>
      <SectionTitle sub={`Budget £${BUDGET_GBP.toLocaleString()} for two · £1 ≈ ₹${GBP_TO_INR}`}>Budget</SectionTitle>

      <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Spent</div>
            <div className="text-2xl font-bold" style={{ color: "#1D2433", fontFamily: "ui-monospace, monospace" }}>£{spent.toFixed(0)}</div>
            <div className="text-xs" style={{ color: "#8A8F98" }}>≈ ₹{(spent * GBP_TO_INR).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A8F98" }}>{remaining >= 0 ? "Left" : "Over"}</div>
            <div className="text-2xl font-bold" style={{ color: remaining >= 0 ? "#2E7D4F" : "#C8102E", fontFamily: "ui-monospace, monospace" }}>£{Math.abs(remaining).toFixed(0)}</div>
          </div>
        </div>
        <div className="h-2.5 rounded-full mt-3" style={{ backgroundColor: "#EDEAE2" }}>
          <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct > 90 ? "#C8102E" : pct > 70 ? "#C77E1F" : "#2E7D4F" }} />
        </div>
        {byCat.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {byCat.map((x) => (
              <span key={x.c} className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#F5F3EC", color: "#1D2433" }}>
                {x.c} £{x.total.toFixed(0)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="flex gap-2 mb-2">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What was it?" className="flex-1 text-sm rounded-xl border px-3 py-2.5" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£" inputMode="decimal" className="w-20 text-sm rounded-xl border px-3 py-2.5" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border" style={{ borderColor: cat === c ? "#1D2433" : "#E5E2DA", backgroundColor: cat === c ? "#1D2433" : "#FFF", color: cat === c ? "#FFF" : "#8A8F98" }}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={add} className="w-full text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: "#C8102E" }}>Add expense</button>
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "#B8B5AD" }}>No expenses yet — log your first coffee.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
          {expenses.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < expenses.length - 1 ? "1px solid #F0EDE6" : "none" }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "#1D2433" }}>{e.desc}</div>
                <div className="text-[11px]" style={{ color: "#8A8F98" }}>{e.cat} · {new Date(e.ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
              </div>
              <div className="text-sm font-bold" style={{ color: "#1D2433", fontFamily: "ui-monospace, monospace" }}>£{e.amount.toFixed(2)}</div>
              <button onClick={() => remove(e.id)} className="text-xs px-1" style={{ color: "#C9C5BB" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Bookings tab ----------
function BookingsTab({ bookings, setBookings }) {
  const [newItem, setNewItem] = useState("");
  const done = bookings.filter((b) => b.done).length;
  const persist = (next) => { setBookings(next); saveKey("trip-bookings", next); };
  const toggle = (id) => persist(bookings.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    persist([...bookings, { id: Date.now(), text: t, urgent: false, done: false }]);
    setNewItem("");
  };
  const remove = (id) => persist(bookings.filter((b) => b.id !== id));

  const sorted = [...bookings].sort((a, b) => (a.done - b.done) || (b.urgent - a.urgent));

  return (
    <div>
      <SectionTitle sub={`${done} of ${bookings.length} booked`}>Booking checklist</SectionTitle>
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

// ---------- Main app ----------
export default function UKTripCompanion() {
  const [tab, setTab] = useState("itinerary");
  const [loaded, setLoaded] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [outfits, setOutfits] = useState({});
  const [packing, setPacking] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [outfitDay, setOutfitDay] = useState(7);

  useEffect(() => {
    (async () => {
      const [ov, pk, ex, bk] = await Promise.all([
        loadKey("trip-itinerary", {}),
        loadKey("trip-packing", null),
        loadKey("trip-expenses", []),
        loadKey("trip-bookings", null),
      ]);
      setOverrides(ov);
      setExpenses(ex);
      setPacking(pk || DEFAULT_PACKING.flatMap(([cat, items], ci) => items.map((text, ii) => ({ id: ci * 100 + ii, cat, text, done: false }))));
      setBookings(bk || DEFAULT_BOOKINGS.map((b, i) => ({ id: i, ...b, done: false })));

      // Load outfits progressively
      try {
        const list = await window.storage.list("outfit:");
        const keys = list?.keys || [];
        const loadedOutfits = {};
        for (const k of keys) {
          try {
            const r = await window.storage.get(k);
            if (r) loadedOutfits[k.replace("outfit:", "")] = JSON.parse(r.value);
          } catch { /* skip */ }
        }
        setOutfits(loadedOutfits);
      } catch { /* no outfits yet */ }

      setLoaded(true);
    })();
  }, []);

  const daysToGo = Math.ceil((TRIP_START - new Date()) / 86400000);
  const countdownText =
    daysToGo > 0 ? `${daysToGo} days to go` :
    daysToGo > -24 ? `Day ${1 - daysToGo} of the trip` : "Trip complete ✈️";

  const TABS = [
    { id: "itinerary", label: "Trip", icon: "🗓️" },
    { id: "outfits", label: "Outfits", icon: "👕" },
    { id: "packing", label: "Pack", icon: "🧳" },
    { id: "budget", label: "Budget", icon: "💷" },
    { id: "bookings", label: "Book", icon: "🎫" },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F0" }}>
        <div className="text-center">
          <div className="text-3xl mb-2">🇬🇧</div>
          <div className="text-sm font-semibold" style={{ color: "#8A8F98" }}>Loading your trip…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3" style={{ backgroundColor: "#1D2433" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#C8102E" }}>UK · Aug 2026</div>
            <h1 className="text-white text-xl font-bold mt-0.5">London & the Loop</h1>
          </div>
          <div className="text-right">
            <div className="text-white text-sm font-bold" style={{ fontFamily: "ui-monospace, monospace" }}>{countdownText}</div>
            <div className="text-[11px]" style={{ color: "#8A8F98" }}>7 – 30 Aug · you two</div>
          </div>
        </div>
        {/* Route line */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {["london", "bath", "lakes", "edinburgh", "york", "london"].map((leg, i, arr) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: LEGS[leg].color, color: "#FFF" }}>
                {i === arr.length - 1 ? "London" : LEGS[leg].name}
              </span>
              {i < arr.length - 1 && <span className="text-[10px]" style={{ color: "#8A8F98" }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {tab === "itinerary" && (
          <ItineraryTab
            overrides={overrides}
            setOverrides={setOverrides}
            outfits={outfits}
            goToOutfit={(d) => { setOutfitDay(d); setTab("outfits"); }}
          />
        )}
        {tab === "outfits" && <OutfitsTab outfits={outfits} setOutfits={setOutfits} initialDay={outfitDay} />}
        {tab === "packing" && <PackingTab packing={packing} setPacking={setPacking} />}
        {tab === "budget" && <BudgetTab expenses={expenses} setExpenses={setExpenses} />}
        {tab === "bookings" && <BookingsTab bookings={bookings} setBookings={setBookings} />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t" style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DA", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex max-w-lg mx-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
              <span className="text-lg" style={{ filter: tab === t.id ? "none" : "grayscale(1) opacity(0.5)" }}>{t.icon}</span>
              <span className="text-[10px] font-bold" style={{ color: tab === t.id ? "#C8102E" : "#B8B5AD" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
