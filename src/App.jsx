import { useState, useEffect, useMemo } from "react";
import { LEGS, DEFAULT_PACKING, DEFAULT_BOOKINGS, TRIP_START } from "./data/trip.js";
import { loadKey, loadPersonalAll, loadOutfitsAll, subscribe, subscribeMembers, flushOutbox } from "./lib/storage.js";
import { refreshWeather } from "./lib/weather.js";
import { loadSession, getSession, ensureAuth, loadMembers, setProfile, COLORS } from "./lib/session.js";
import BackupControls from "./components/BackupControls.jsx";
import TripGate from "./components/TripGate.jsx";
import PersonBadge from "./components/PersonBadge.jsx";
import ItineraryTab from "./tabs/ItineraryTab.jsx";
import OutfitsTab from "./tabs/OutfitsTab.jsx";
import PackingTab from "./tabs/PackingTab.jsx";
import BudgetTab from "./tabs/BudgetTab.jsx";
import BookingsTab from "./tabs/BookingsTab.jsx";

const SHARED = "__shared__";
const seedPacking = () =>
  DEFAULT_PACKING.flatMap(([cat, items], ci) => items.map((text, ii) => ({ id: ci * 100 + ii, cat, text, done: false })));
const seedBookings = () => DEFAULT_BOOKINGS.map((b, i) => ({ id: i, ...b, done: false }));

export default function App() {
  const [tab, setTab] = useState("itinerary");
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [members, setMembers] = useState([]);
  const [overrides, setOverrides] = useState({});      // shared per-day notes
  const [notesAll, setNotesAll] = useState({});        // { ownerId: { dayKey: {notes} } }
  const [outfitsAll, setOutfitsAll] = useState({});    // { ownerId: { day: {photo,desc} } }
  const [packingAll, setPackingAll] = useState({});    // { ownerId: [items] }
  const [expenses, setExpenses] = useState([]);        // shared
  const [bookings, setBookings] = useState([]);        // shared
  const [outfitDay, setOutfitDay] = useState(7);
  const [weather, setWeather] = useState(null);        // shared { fetchedAt, days }
  const [editingProfile, setEditingProfile] = useState(false);

  const myId = session?.userId;
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);

  // 1. Boot: is this device set up?
  useEffect(() => {
    (async () => {
      const s = await loadSession();
      setSession(s);
      setBooted(true);
    })();
  }, []);

  // 2. With a session, load data + subscribe.
  useEffect(() => {
    if (!session) return;
    let unsub = () => {};
    let unsubMembers = () => {};
    (async () => {
      await ensureAuth().catch(() => {});
      flushOutbox();
      const [mem, ov, notes, packs, outs, ex, bk, wx] = await Promise.all([
        loadMembers(),
        loadKey("trip-itinerary", {}),
        loadPersonalAll("trip-itinerary-override"),
        loadPersonalAll("trip-packing"),
        loadOutfitsAll(),
        loadKey("trip-expenses", []),
        loadKey("trip-bookings", null),
        loadKey("trip-weather", null),
      ]);
      setMembers(mem);
      setOverrides(ov || {});
      setNotesAll(notes || {});
      setOutfitsAll(outs || {});
      setWeather(wx);
      // Seed my packing list with the default checklist if I don't have one yet.
      if (!packs[session.userId] || packs[session.userId].length === 0) {
        packs[session.userId] = seedPacking();
      }
      setPackingAll(packs);
      setExpenses(ex || []);
      setBookings(bk || seedBookings());
      setLoaded(true);
      unsub = subscribe(onRemoteChange);
      unsubMembers = subscribeMembers(async () => setMembers(await loadMembers()));
      // Refresh the forecast in the background (fetches only if online & stale).
      refreshWeather(wx).then((next) => { if (next) setWeather(next); }).catch(() => {});
    })();
    return () => { unsub(); unsubMembers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onRemoteChange = (key, value, owner) => {
    if (owner === SHARED) {
      if (key === "trip-itinerary") setOverrides(value || {});
      else if (key === "trip-expenses") setExpenses(value || []);
      else if (key === "trip-bookings") setBookings(value || seedBookings());
      else if (key === "trip-weather") setWeather(value || null);
      return;
    }
    // personal slice belonging to some member
    if (key === "trip-packing") setPackingAll((p) => ({ ...p, [owner]: value || [] }));
    else if (key === "trip-itinerary-override") setNotesAll((n) => ({ ...n, [owner]: value || {} }));
    else if (key.startsWith("outfit:")) {
      const day = key.slice("outfit:".length);
      setOutfitsAll((o) => ({ ...o, [owner]: { ...(o[owner] || {}), [day]: value } }));
    }
  };

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

  if (!booted) return <Splash text="Loading your trip…" />;
  if (!session) return <TripGate onReady={() => setSession(getSession())} />;
  if (!loaded) return <Splash text="Syncing your trip…" />;

  const me = membersById[myId] || { name: session.name, color: session.color };

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
            <button onClick={() => setEditingProfile(true)} className="mt-1 inline-flex items-center gap-1.5">
              <PersonBadge member={me} />
              <span className="text-[11px]" style={{ color: "#8A8F98" }}>· {session.code} ✎</span>
            </button>
          </div>
        </div>
        {/* Who's on this trip */}
        {members.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#8A8F98" }}>On this trip:</span>
            {members.map((m) => <PersonBadge key={m.user_id} member={m} size="xs" />)}
          </div>
        )}
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
        <BackupControls />
      </div>

      {editingProfile && (
        <ProfileEditor
          session={session}
          onClose={() => setEditingProfile(false)}
          onSaved={async (next) => {
            setSession(next);
            setMembers(await loadMembers());
            setEditingProfile(false);
          }}
        />
      )}

      {/* Content */}
      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {tab === "itinerary" && (
          <ItineraryTab
            overrides={overrides} setOverrides={setOverrides}
            notesAll={notesAll} setNotesAll={setNotesAll}
            outfitsAll={outfitsAll} membersById={membersById} members={members} myId={myId}
            weather={weather}
            goToOutfit={(d) => { setOutfitDay(d); setTab("outfits"); }}
          />
        )}
        {tab === "outfits" && (
          <OutfitsTab
            outfitsAll={outfitsAll} setOutfitsAll={setOutfitsAll}
            membersById={membersById} members={members} myId={myId} initialDay={outfitDay}
          />
        )}
        {tab === "packing" && (
          <PackingTab packingAll={packingAll} setPackingAll={setPackingAll} membersById={membersById} myId={myId} />
        )}
        {tab === "budget" && (
          <BudgetTab expenses={expenses} setExpenses={setExpenses} members={members} membersById={membersById} myId={myId} />
        )}
        {tab === "bookings" && (
          <BookingsTab bookings={bookings} setBookings={setBookings} membersById={membersById} myId={myId} />
        )}
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

function Splash({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="text-center">
        <div className="text-3xl mb-2">🇬🇧</div>
        <div className="text-sm font-semibold" style={{ color: "#8A8F98" }}>{text}</div>
      </div>
    </div>
  );
}

function ProfileEditor({ session, onClose, onSaved }) {
  const [name, setName] = useState(session.name || "");
  const [color, setColor] = useState(session.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const next = await setProfile(name.trim(), color);
    onSaved(next);
  };
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm m-4 rounded-2xl p-5" style={{ backgroundColor: "#FFF" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold mb-3" style={{ color: "#1D2433" }}>Your profile</h2>
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
          className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#8A8F98" }}>Colour</div>
        <div className="flex gap-2 mb-5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c, outline: color === c ? "3px solid #1D2433" : "none", outlineOffset: 2 }}>
              {color === c && <span className="text-white text-sm font-bold">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: "#C8102E" }}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2.5 rounded-full" style={{ color: "#8A8F98" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
