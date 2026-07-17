import { useState, useEffect } from "react";
import { listMyTrips, enterTrip, joinTrip, deleteTrip, leaveTrip, COLORS } from "../lib/session.js";
import { isGuest } from "../lib/auth.js";
import { getProfile, greeting } from "../lib/profile.js";
import { dateRangeLabel, todayISO, daysToGo, tripDayNumber, legGradient } from "../lib/tripConfig.js";
import PersonBadge from "./PersonBadge.jsx";
import Avatar from "./Avatar.jsx";
import ProfileSheet from "./ProfileSheet.jsx";
import { confirmDialog } from "./dialogs.jsx";
import { APP_NAME } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, FormStack } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import RouteLine from "./ui/RouteLine.jsx";
import Skeleton from "./ui/Skeleton.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import s from "./TripsHome.module.css";

// Home dashboard: greeting + avatar, a hero card for the active/next trip,
// upcoming & past sections, travel stats, and the ways into a new trip.
export default function TripsHome({ user, onOpen, onNew, onAuthChanged }) {
  const [trips, setTrips] = useState(null); // null = loading
  const [joining, setJoining] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [, setBump] = useState(0); // re-render after profile edits
  const [error, setError] = useState("");

  const load = async () => {
    try { setTrips(await listMyTrips()); }
    catch (e) { setTrips([]); setError(e.message || "Couldn't load your trips."); }
  };
  useEffect(() => { load(); }, []);

  const profile = getProfile(user);
  const today = todayISO();
  const phase = (t) => {
    if (!t.config) return 1; // upcoming-ish: needs setup
    if (today > t.config.endDate) return 2;   // past
    return t.config.startDate <= today ? 0 : 1; // active : upcoming
  };
  const sorted = [...(trips || [])].sort((a, b) => {
    const pa = phase(a), pb = phase(b);
    if (pa !== pb) return pa - pb;
    const da = a.config?.startDate || "9999", db = b.config?.startDate || "9999";
    return pa === 2 ? (da < db ? 1 : -1) : (da < db ? -1 : 1);
  });

  const hero = sorted[0] && phase(sorted[0]) !== 2 ? sorted[0] : null;
  const upcoming = sorted.filter((t) => t !== hero && phase(t) !== 2);
  const past = sorted.filter((t) => phase(t) === 2);

  const stats = trips?.length
    ? {
        trips: trips.length,
        days: trips.reduce((n, t) => n + (t.config?.days?.length || 0), 0),
        places: new Set(trips.flatMap((t) => (t.config ? t.config.legOrder.map((k) => t.config.legs[k]?.name).filter(Boolean) : []))).size,
      }
    : null;

  const lastProfile = profile || (trips?.[0] ? { name: trips[0].myName, color: trips[0].myColor } : null);

  const open = async (t) => {
    setError("");
    try { await enterTrip(t); onOpen(); }
    catch (e) { setError(e.message || "Couldn't open the trip."); }
  };

  // Remove a trip from the list: delete outright if you're its only member,
  // otherwise leave it (it stays for the others). Refreshes the list after.
  const remove = async (t) => {
    setError("");
    const solo = (t.members?.length || 1) <= 1;
    const title = t.config?.title || `Trip ${t.code}`;
    const ok = await confirmDialog(solo
      ? { title: `Delete "${title}"?`, message: "This permanently removes its itinerary, outfits, packing, budget, bookings and documents. This can't be undone.", confirmLabel: "Delete forever", danger: true }
      : { title: `Leave "${title}"?`, message: "You'll lose access to it, but it stays for everyone else on it.", confirmLabel: "Leave trip", danger: true });
    if (!ok) return;
    try {
      await (solo ? deleteTrip(t.id) : leaveTrip(t.id));
      await load();
    } catch (e) { setError(e.message || "Couldn't remove the trip."); }
  };

  const countdown = (cfg) => {
    if (!cfg) return "Needs setup";
    const dtg = daysToGo(cfg);
    if (dtg > 1) return `In ${dtg} days`;
    if (dtg === 1) return "Starts tomorrow";
    if (dtg === 0) return "Starts today";
    return `Day ${tripDayNumber(cfg)} of ${cfg.days.length}`;
  };

  const routeStops = (cfg) => (cfg ? cfg.legOrder.map((k) => ({ name: cfg.legs[k]?.name || k, color: cfg.legs[k]?.color })) : []);

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        {/* Greeting header */}
        <div className={s.greeting}>
          <div className={s.greetingMain}>
            <div className={s.kicker}>{APP_NAME}</div>
            <h1 className={s.hello}>
              {profile?.name ? `${greeting()}, ${profile.name.split(" ")[0]}` : greeting()}
            </h1>
          </div>
          <Avatar name={profile?.name} color={profile?.color} size="md" title="Profile" onClick={() => setProfileOpen(true)} />
        </div>

        {isGuest(user) && (trips?.length || 0) > 0 && (
          <button onClick={() => setProfileOpen(true)} className={s.guestWarn}>
            Your trips live only in this browser. <span className={s.guestWarnStrong}>Save your account</span> to open them anywhere.
          </button>
        )}

        {/* Loading skeletons */}
        {trips === null && (
          <div className={s.skeletons}>
            <Skeleton height={176} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </div>
        )}

        {trips !== null && sorted.length === 0 && (
          <EmptyState icon="case" title="No trips yet" body="Start one below, or join a friend's trip with their code." />
        )}

        {/* Hero: the trip that matters right now */}
        {hero && (
          <div role="button" tabIndex={0} onClick={() => open(hero)} onKeyDown={keyOpen(hero, open)} className={s.hero}>
            <div
              className={s.heroArt}
              style={hero.config?.cover?.url
                ? { backgroundImage: `linear-gradient(180deg, rgba(20,12,7,0) 44%, rgba(20,12,7,0.62)), url("${hero.config.cover.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundImage: `linear-gradient(180deg, rgba(20,12,7,0) 40%, rgba(20,12,7,0.4)), ${legGradient(hero.config)}` }}
            />
            <div className={s.heroBody}>
              <div className={s.heroTop}>
                <RemoveBtn dark onRemove={() => remove(hero)} />
                <span className={s.heroCountdown}>{countdown(hero.config)}</span>
              </div>
              <div>
                <div className={s.heroTitle}>{hero.config?.title || `Trip ${hero.code}`}</div>
                <div className={s.heroMeta}>
                  {hero.config ? dateRangeLabel(hero.config) : "Tap to set up"} · code {hero.code}
                </div>
                {hero.members.length > 0 && (
                  <div className={s.heroMembers}>
                    {hero.members.map((m) => (
                      <span key={m.user_id} className={s.stackAv}>
                        <Avatar name={m.name} color={m.color} size="xs" />
                      </span>
                    ))}
                    <span className={s.heroNames}>{hero.members.map((m) => m.name).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
            {hero.config?.cover?.author && (
              <span className={s.heroCredit}>Photo: {hero.config.cover.author} / Unsplash</span>
            )}
          </div>
        )}

        {/* Travel stats */}
        {stats && (
          <div className={s.stats}>
            {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "travel days"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l]) => (
              <div key={l} className={s.stat}>
                <div className={s.statNum}>{n}</div>
                <div className={s.statLabel}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <div className={s.section}>Also planned</div>
            {upcoming.map((t) => <TripCard key={t.id} trip={t} onOpen={open} onRemove={() => remove(t)} countdown={countdown} routeStops={routeStops} />)}
          </>
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            <div className={s.section}>Past trips</div>
            {past.map((t) => <PastRow key={t.id} trip={t} onOpen={open} onRemove={() => remove(t)} />)}
          </>
        )}

        {error && <p className={s.error}>{error}</p>}

        <div className={s.actions}>
          <Button full icon="plus" onClick={() => onNew(lastProfile)}>New trip</Button>
          {!joining ? (
            <Button full variant="ghost" onClick={() => setJoining(true)}>Join a trip with a code</Button>
          ) : (
            <JoinForm defaultProfile={lastProfile} onJoined={onOpen} onCancel={() => setJoining(false)} />
          )}
        </div>

        {profileOpen && (
          <ProfileSheet
            user={user}
            stats={stats}
            onClose={() => setProfileOpen(false)}
            onChanged={() => { setBump((b) => b + 1); onAuthChanged?.(); }}
          />
        )}
      </div>
    </div>
  );
}

// The "remove trip" affordance overlaid on a trip card. A real button of its
// own, and it stops propagation so tapping it never opens the trip.
function RemoveBtn({ onRemove, dark }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      title="Delete trip"
      aria-label="Delete trip"
      className={[s.removeBtn, dark && s.removeBtnDark].filter(Boolean).join(" ")}>
      <Icon name="trash" size={14} strokeWidth={1.8} />
    </button>
  );
}

// Open the trip on Enter/Space for the div-based (non-button) card shells.
const keyOpen = (t, onOpen) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t); }
};

function TripCard({ trip: t, onOpen, onRemove, countdown, routeStops }) {
  const cfg = t.config;
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(t)} onKeyDown={keyOpen(t, onOpen)} className={s.card}>
      <div className={s.cardBody}>
        {cfg && <RouteLine stops={routeStops(cfg)} className={s.cardRoute} />}
        <div className={s.cardHead}>
          <span className={s.cardTitle}>{cfg?.title || `Trip ${t.code}`}</span>
          <div className={s.cardHeadRight}>
            <span className={s.chip}>{countdown(cfg)}</span>
            <RemoveBtn onRemove={onRemove} />
          </div>
        </div>
        <div className={s.cardMeta}>
          {cfg ? dateRangeLabel(cfg) : "Needs setup"} · code {t.code}
        </div>
        {t.members.length > 0 && (
          <div className={s.cardMembers}>
            <span className={s.withLabel}>With</span>
            {t.members.map((m) => <PersonBadge key={m.user_id} member={m} size="xs" />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PastRow({ trip: t, onOpen, onRemove }) {
  const cfg = t.config;
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(t)} onKeyDown={keyOpen(t, onOpen)} className={s.pastRow}>
      <span className={s.pastDot} style={{ background: legGradient(cfg) }} />
      <span className={s.pastTitle}>{cfg?.title || `Trip ${t.code}`}</span>
      <span className={s.pastMeta}>{cfg ? dateRangeLabel(cfg) : t.code}</span>
      <RemoveBtn onRemove={onRemove} />
    </div>
  );
}

function JoinForm({ defaultProfile, onJoined, onCancel }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultProfile?.name || "");
  const [color, setColor] = useState(defaultProfile?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    if (!name.trim()) { setError("Enter your name."); return; }
    if (!code.trim()) { setError("Enter the trip code."); return; }
    setBusy(true); setError("");
    try { await joinTrip(code, name.trim(), color); onJoined(); }
    catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
  };

  return (
    <div className={s.joinForm}>
      <FormStack>
        <Field label="Trip code">
          <Input code value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
        </Field>
        <Field label="Your name on this trip">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" maxLength={24} />
        </Field>
        <Field label="Colour">
          <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
        </Field>
      </FormStack>
      <div className={s.joinActions}>
        <Button full onClick={join} disabled={busy}>{busy ? "Joining…" : "Join"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}
