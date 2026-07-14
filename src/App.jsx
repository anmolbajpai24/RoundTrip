import { useState, useEffect, useMemo } from "react";
import { TripConfigContext, CONFIG_KEY, dateRangeLabel, isDuringTrip, tripDayNumber, daysToGo, defaultDay } from "./lib/tripConfig.js";
import { loadKey, saveKey, loadPersonalAll, loadClosetsAll, subscribe, subscribeMembers, flushOutbox } from "./lib/storage.js";
import { migrateMyLegacyOutfits } from "./lib/closet.js";
import { refreshWeather } from "./lib/weather.js";
import { loadSession, getSession, ensureAuth, loadMembers, setProfile, leaveToHome, deleteTrip, leaveTrip, COLORS } from "./lib/session.js";
import { currentUser } from "./lib/auth.js";
import BackupControls from "./components/BackupControls.jsx";
import TripGate from "./components/TripGate.jsx";
import Onboarding, { hasOnboarded } from "./components/Onboarding.jsx";
import TripsHome from "./components/TripsHome.jsx";
import TripWizard from "./components/TripWizard.jsx";
import TripSettings from "./components/TripSettings.jsx";
import LegacyUpgrade from "./components/LegacyUpgrade.jsx";
import PersonBadge from "./components/PersonBadge.jsx";
import ItineraryTab from "./tabs/ItineraryTab.jsx";
import OutfitsTab from "./tabs/OutfitsTab.jsx";
import PackingTab from "./tabs/PackingTab.jsx";
import BudgetTab from "./tabs/BudgetTab.jsx";
import BookingsTab from "./tabs/BookingsTab.jsx";
import { APP_NAME, ACCENT, INK, MUTED } from "./theme.js";

const SHARED = "__shared__";
const seedPacking = (config) =>
  (config?.packingTemplate || []).flatMap(([cat, items], ci) => items.map((text, ii) => ({ id: ci * 100 + ii, cat, text, done: false })));

export default function App() {
  const [tab, setTab] = useState("itinerary");
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState(null);

  const [members, setMembers] = useState([]);
  const [overrides, setOverrides] = useState({});      // shared per-day notes
  const [notesAll, setNotesAll] = useState({});        // { ownerId: { dateISO: {notes} } }
  const [closetsAll, setClosetsAll] = useState({});    // { ownerId: { items: {id: outfit}, days: {dateISO: id} } }
  const [packingAll, setPackingAll] = useState({});    // { ownerId: [items] }
  const [expenses, setExpenses] = useState([]);        // shared
  const [bookings, setBookings] = useState([]);        // shared
  const [documents, setDocuments] = useState([]);      // shared file metadata
  const [outfitDay, setOutfitDay] = useState(null);    // ISO date
  const [weather, setWeather] = useState(null);        // shared { v, fetchedAt, days }
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [wizardProfile, setWizardProfile] = useState(undefined); // undefined = closed
  const [onboarded, setOnboarded] = useState(true);

  const myId = session?.userId;
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);

  // 1. Boot: is this device set up? (authUser is refreshed explicitly on flow
  // completion, NOT via onAuthStateChange — a live subscription would re-route
  // away from the gate/wizard the instant createTrip signs in anonymously.)
  useEffect(() => {
    (async () => {
      const s = await loadSession();
      setSession(s);
      setAuthUser(await currentUser().catch(() => null));
      setOnboarded(hasOnboarded());
      setBooted(true);
    })();
  }, []);

  const refreshAuth = async () => setAuthUser(await currentUser().catch(() => null));

  // 2. With a session, load data + subscribe.
  useEffect(() => {
    if (!session) return;
    let unsub = () => {};
    let unsubMembers = () => {};
    (async () => {
      await ensureAuth().catch(() => {});
      flushOutbox();
      const [cfg, mem, ov, notes, packs, closets, ex, bk, docs, wx] = await Promise.all([
        loadKey(CONFIG_KEY, null),
        loadMembers(),
        loadKey("trip-itinerary", {}),
        loadPersonalAll("trip-itinerary-override"),
        loadPersonalAll("trip-packing"),
        loadClosetsAll(),
        loadKey("trip-expenses", []),
        loadKey("trip-bookings", null),
        loadKey("trip-documents", []),
        loadKey("trip-weather", null),
      ]);
      setConfig(cfg);
      setMembers(mem);
      setOverrides(ov || {});
      setNotesAll(notes || {});
      setClosetsAll(closets || {});
      setWeather(wx);
      // Upgrade my pre-closet outfit rows (outfit:<date>) into closet items once.
      migrateMyLegacyOutfits((closets || {})[session.userId])
        .then((mine) => { if (mine) setClosetsAll((c) => ({ ...c, [session.userId]: mine })); })
        .catch(() => {});
      // Seed my packing list with the trip's template if I don't have one yet.
      if (cfg && (!packs[session.userId] || packs[session.userId].length === 0)) {
        packs[session.userId] = seedPacking(cfg);
      }
      setPackingAll(packs);
      setExpenses(ex || []);
      setBookings(bk || []);
      setDocuments(docs || []);
      setLoaded(true);
      unsub = subscribe(onRemoteChange);
      unsubMembers = subscribeMembers(async () => setMembers(await loadMembers()));
      // Refresh the forecast in the background (fetches only if online & stale).
      if (cfg) refreshWeather(wx, cfg).then((next) => { if (next) setWeather(next); }).catch(() => {});
    })();
    return () => { unsub(); unsubMembers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onRemoteChange = (key, value, owner) => {
    if (owner === SHARED) {
      if (key === CONFIG_KEY) setConfig(value || null);
      else if (key === "trip-itinerary") setOverrides(value || {});
      else if (key === "trip-expenses") setExpenses(value || []);
      else if (key === "trip-bookings") setBookings(value || []);
      else if (key === "trip-documents") setDocuments(value || []);
      else if (key === "trip-weather") setWeather(value || null);
      return;
    }
    // personal slice belonging to some member
    if (key === "trip-packing") setPackingAll((p) => ({ ...p, [owner]: value || [] }));
    else if (key === "trip-itinerary-override") setNotesAll((n) => ({ ...n, [owner]: value || {} }));
    else if (key.startsWith("outfit-item:")) {
      const id = key.slice("outfit-item:".length);
      setClosetsAll((c) => {
        // A first new-model row replaces any closet synthesized from legacy rows.
        const closet = !c[owner] || c[owner].legacy ? { items: {}, days: {} } : c[owner];
        const items = { ...closet.items };
        if (value) items[id] = value; else delete items[id]; // null = deleted
        return { ...c, [owner]: { ...closet, items } };
      });
    } else if (key === "outfit-days") {
      setClosetsAll((c) => {
        const closet = !c[owner] || c[owner].legacy ? { items: {}, days: {} } : c[owner];
        return { ...c, [owner]: { ...closet, days: value || {} } };
      });
    }
    // `outfit:<date>` rows are pre-closet backups — ignored live.
  };

  const saveConfig = (next) => { setConfig(next); saveKey(CONFIG_KEY, next); };

  const resetToHome = () => {
    setSession(null);
    setLoaded(false);
    setConfig(null);
    setTab("itinerary");
    setOutfitDay(null);
  };

  const goHome = async () => {
    await leaveToHome();
    resetToHome();
  };

  const deleteActiveTrip = async () => {
    try { await deleteTrip(session.tripId); resetToHome(); }
    catch (e) { alert(e.message || "Couldn't delete the trip."); }
  };

  const leaveActiveTrip = async () => {
    try { await leaveTrip(session.tripId); resetToHome(); }
    catch (e) { alert(e.message || "Couldn't leave the trip."); }
  };

  // ---------- top-level routing ----------
  if (!booted) return <Splash text="Loading…" />;

  if (!session) {
    if (wizardProfile !== undefined) {
      return <TripWizard profile={wizardProfile} onDone={() => { setWizardProfile(undefined); setSession(getSession()); refreshAuth(); }} onCancel={() => setWizardProfile(undefined)} />;
    }
    if (authUser) {
      return (
        <TripsHome
          user={authUser}
          onOpen={() => setSession(getSession())}
          onNew={(profile) => setWizardProfile(profile)}
          onAuthChanged={refreshAuth}
        />
      );
    }
    if (!onboarded) {
      return <Onboarding onDone={() => setOnboarded(true)} />;
    }
    return <TripGate onReady={() => { setSession(getSession()); refreshAuth(); }} />;
  }

  if (!loaded) return <Splash text="Syncing your trip…" />;
  if (!config) return <LegacyUpgrade onDone={() => window.location.reload()} />;

  const me = membersById[myId] || { name: session.name, color: session.color };
  const dtg = daysToGo(config);
  const countdownText =
    dtg > 0 ? `${dtg} days to go` :
    isDuringTrip(config) ? `Day ${tripDayNumber(config)} of the trip` : "Trip complete ✈️";

  const TABS = [
    { id: "itinerary", label: "Trip", icon: "🗓️" },
    { id: "outfits", label: "Outfits", icon: "👕" },
    { id: "packing", label: "Pack", icon: "🧳" },
    { id: "budget", label: "Budget", icon: "💰" },
    { id: "bookings", label: "Book", icon: "🎫" },
  ];

  return (
    <TripConfigContext.Provider value={config}>
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3" style={{ backgroundColor: "var(--solid)" }}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <button onClick={goHome} className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: ACCENT }}>
              ‹ Trips <span style={{ color: MUTED }}>· {dateRangeLabel(config)}</span>
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-white text-xl font-bold truncate">{config.title}</h1>
              <button onClick={() => setEditingTrip(true)} title="Trip settings" className="text-sm" style={{ color: MUTED }}>⚙</button>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-white text-sm font-bold" style={{ fontFamily: "ui-monospace, monospace" }}>{countdownText}</div>
            <button onClick={() => setEditingProfile(true)} className="mt-1 inline-flex items-center gap-1.5">
              <PersonBadge member={me} />
              <span className="text-[11px]" style={{ color: MUTED }}>· {session.code} ✎</span>
            </button>
          </div>
        </div>
        {/* Who's on this trip */}
        {members.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: MUTED }}>On this trip:</span>
            {members.map((m) => <PersonBadge key={m.user_id} member={m} size="xs" />)}
          </div>
        )}
        {/* Route line */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {config.legOrder.map((leg, i, arr) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: config.legs[leg]?.color || "#555", color: "#FFF" }}>
                {config.legs[leg]?.name || leg}
              </span>
              {i < arr.length - 1 && <span className="text-[10px]" style={{ color: MUTED }}>→</span>}
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
      {editingTrip && (
        <TripSettings
          config={config}
          onSave={saveConfig}
          onClose={() => setEditingTrip(false)}
          memberCount={members.length}
          onDelete={deleteActiveTrip}
          onLeave={leaveActiveTrip}
        />
      )}

      {/* Content */}
      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {tab === "itinerary" && (
          <ItineraryTab
            overrides={overrides} setOverrides={setOverrides}
            notesAll={notesAll} setNotesAll={setNotesAll}
            closetsAll={closetsAll} membersById={membersById} members={members} myId={myId}
            weather={weather}
            saveConfig={saveConfig}
            packingItems={(packingAll[myId] || []).map((i) => i.text)}
            goToOutfit={(d) => { setOutfitDay(d); setTab("outfits"); }}
          />
        )}
        {tab === "outfits" && (
          <OutfitsTab
            closetsAll={closetsAll} setClosetsAll={setClosetsAll}
            membersById={membersById} members={members} myId={myId} initialDay={outfitDay || defaultDay(config)}
          />
        )}
        {tab === "packing" && (
          <PackingTab packingAll={packingAll} setPackingAll={setPackingAll} membersById={membersById} myId={myId} />
        )}
        {tab === "budget" && (
          <BudgetTab expenses={expenses} setExpenses={setExpenses} members={members} membersById={membersById} myId={myId} />
        )}
        {tab === "bookings" && (
          <BookingsTab bookings={bookings} setBookings={setBookings} documents={documents} setDocuments={setDocuments} membersById={membersById} myId={myId} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex max-w-lg mx-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-2.5 flex flex-col items-center gap-0.5">
              <span className="text-lg" style={{ filter: tab === t.id ? "none" : "grayscale(1) opacity(0.5)" }}>{t.icon}</span>
              <span className="text-[10px] font-bold" style={{ color: tab === t.id ? ACCENT : "var(--faint)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
    </TripConfigContext.Provider>
  );
}

function Splash({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
      <div className="text-center">
        <div className="text-3xl mb-2">✈️</div>
        <div className="text-sm font-semibold" style={{ color: MUTED }}>{text}</div>
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
      <div className="w-full max-w-sm m-4 rounded-2xl p-5" style={{ backgroundColor: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold mb-3" style={{ color: INK }}>Your profile</h2>
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
          className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: INK }} />
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Colour</div>
        <div className="flex gap-2 mb-5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c, outline: color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }}>
              {color === c && <span className="text-white text-sm font-bold">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: ACCENT }}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2.5 rounded-full" style={{ color: MUTED }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
