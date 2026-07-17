import { useState, useEffect, useMemo } from "react";
import { TripConfigContext, CONFIG_KEY, dateRangeLabel, isDuringTrip, tripDayNumber, daysToGo, defaultDay } from "./lib/tripConfig.js";
import { loadKey, saveKey, loadPersonalAll, loadClosetsAll, subscribe, subscribeMembers, flushOutbox } from "./lib/storage.js";
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
import SyncChip from "./components/SyncChip.jsx";
import Spinner from "./components/Spinner.jsx";
import { toast } from "./components/dialogs.jsx";
import { setTabPopHandler } from "./lib/useBackClose.js";
import ItineraryTab from "./tabs/ItineraryTab.jsx";
import OutfitsTab from "./tabs/OutfitsTab.jsx";
import PackingTab from "./tabs/PackingTab.jsx";
import BudgetTab from "./tabs/BudgetTab.jsx";
import BookingsTab from "./tabs/BookingsTab.jsx";
import Icon from "./components/ui/icons.jsx";
import Sheet from "./components/ui/Sheet.jsx";
import Button from "./components/ui/Button.jsx";
import Field, { Input } from "./components/ui/Field.jsx";
import SwatchPicker from "./components/ui/SwatchPicker.jsx";
import RouteLine from "./components/ui/RouteLine.jsx";
import s from "./App.module.css";

const SHARED = "__shared__";
const seedPacking = (config) =>
  (config?.packingTemplate || []).flatMap(([cat, items], ci) => items.map((text, ii) => ({ id: ci * 100 + ii, cat, text, done: false })));

const TAB_STORE = "roundtrip:tab";
const TAB_IDS = ["itinerary", "outfits", "packing", "budget", "bookings"];
const storedTab = () => {
  try { const t = sessionStorage.getItem(TAB_STORE); return TAB_IDS.includes(t) ? t : "itinerary"; }
  catch { return "itinerary"; }
};

export default function App() {
  // Survives refresh via sessionStorage; hardware Back walks visited tabs
  // (and closes overlays first) via the useBackClose history stack.
  const [tab, setTabState] = useState(storedTab);
  const setTab = (next, { push = true } = {}) => {
    setTabState(next);
    try { sessionStorage.setItem(TAB_STORE, next); } catch { /* private mode */ }
    if (push && next !== tab) window.history.pushState({ tab: next }, "");
  };
  useEffect(() => {
    window.history.replaceState({ tab: storedTab() }, "");
    setTabPopHandler((t) => {
      setTabState(t);
      try { sessionStorage.setItem(TAB_STORE, t); } catch { /* private mode */ }
    });
    return () => setTabPopHandler(null);
  }, []);
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
  }, [session]);

  const saveConfig = (next) => { setConfig(next); saveKey(CONFIG_KEY, next); };

  const resetToHome = () => {
    setSession(null);
    setLoaded(false);
    setConfig(null);
    setTab("itinerary", { push: false });
    setOutfitDay(null);
  };

  const goHome = async () => {
    await leaveToHome();
    resetToHome();
  };

  const deleteActiveTrip = async () => {
    try { await deleteTrip(session.tripId); resetToHome(); }
    catch (e) { toast(e.message || "Couldn't delete the trip.", { kind: "error" }); }
  };

  const leaveActiveTrip = async () => {
    try { await leaveTrip(session.tripId); resetToHome(); }
    catch (e) { toast(e.message || "Couldn't leave the trip.", { kind: "error" }); }
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
  if (!config) return <TripSetupPending onDone={() => window.location.reload()} />;

  const me = membersById[myId] || { name: session.name, color: session.color };
  const dtg = daysToGo(config);
  const countdownText =
    dtg > 0 ? `${dtg} days to go` :
    isDuringTrip(config) ? `Day ${tripDayNumber(config)} of the trip` : "Trip complete";

  const TABS = [
    { id: "itinerary", label: "Trip", icon: "route" },
    { id: "outfits", label: "Outfits", icon: "hanger" },
    { id: "packing", label: "Pack", icon: "case" },
    { id: "budget", label: "Budget", icon: "wallet" },
    { id: "bookings", label: "Book", icon: "ticket" },
  ];
  const routeStops = config.legOrder.map((leg) => ({ name: config.legs[leg]?.name || leg, color: config.legs[leg]?.color }));

  return (
    <TripConfigContext.Provider value={config}>
    <div className={s.app}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headTop}>
          <div style={{ minWidth: 0 }}>
            <button onClick={goHome} className={s.backLink}>
              <Icon name="back" size={12} strokeWidth={1.8} /> Trips <span className={s.backDate}>· {dateRangeLabel(config)}</span>
            </button>
            <div className={s.titleRow}>
              <h1 className={s.title}>{config.title}</h1>
              <button onClick={() => setEditingTrip(true)} title="Trip settings" aria-label="Trip settings" className={s.iconBtn}>
                <Icon name="gear" size={18} />
              </button>
            </div>
          </div>
          <div className={s.headRight}>
            <div className={s.countdown}>{countdownText}</div>
            <button onClick={() => setEditingProfile(true)} aria-label="Edit profile" className={s.profileBtn}>
              <PersonBadge member={me} />
              <span className={s.code}>· {session.code} <Icon name="pencil" size={11} /></span>
            </button>
          </div>
        </div>
        <SyncChip />
        {/* Who's on this trip */}
        {members.length > 1 && (
          <div className={s.members}>
            <span className={s.membersLabel}>On this trip</span>
            {members.map((m) => <PersonBadge key={m.user_id} member={m} size="xs" />)}
          </div>
        )}
        {/* Route line — the motif */}
        <div className={s.routeWrap}>
          <RouteLine stops={routeStops} />
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
      <div className={s.content}>
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
      <nav className={s.nav}>
        <div className={s.navInner}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={[s.navItem, tab === t.id && s.navActive].filter(Boolean).join(" ")}>
              <Icon name={t.icon} size={21} strokeWidth={tab === t.id ? 1.7 : 1.6} />
              <span className={s.navLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
    </TripConfigContext.Provider>
  );
}

function Splash({ text }) {
  return (
    <div className={s.splash}>
      <div className={s.splashInner}>
        <Icon name="route" size={34} strokeWidth={1.6} className={s.splashMark} />
        <div className={s.splashText}>
          <Spinner size={14} /> {text}
        </div>
      </div>
    </div>
  );
}

// Session exists but the trip has no `trip-config` row yet. For a freshly
// joined trip that just means the creator's setup hasn't synced — the live
// subscription delivers the config row and this screen dismisses itself.
// Only the original pre-wizard trip actually needs the legacy upgrade, so
// that path hides behind an explicit link instead of being the default.
function TripSetupPending({ onDone }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  if (showUpgrade) return <LegacyUpgrade onDone={onDone} />;
  return (
    <div className={s.pending}>
      <div className={s.pendingCard}>
        <div className={s.pendingMark}><Icon name="reload" size={22} /></div>
        <h1 className={s.pendingTitle}>Setting up this trip…</h1>
        <p className={s.pendingBody}>
          The trip's setup hasn't reached this device yet. It finishes on its
          own once the trip creator completes their setup — hang tight, or reload.
        </p>
        <Button full onClick={() => window.location.reload()}>Reload</Button>
        <button onClick={() => setShowUpgrade(true)} className={s.pendingLegacy}>
          Is this a trip from before in-app setup existed? Upgrade it
        </button>
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
    <Sheet onClose={onClose} label="Your profile">
      {(requestClose) => (
        <>
          <h2 className={s.sheetTitle}>Your profile</h2>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          </Field>
          <Field label="Colour">
            <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
          </Field>
          <div className={s.sheetActions}>
            <Button full onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
