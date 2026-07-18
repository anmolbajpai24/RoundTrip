import { useState, useEffect } from "react";
import { listMyTrips, enterTrip, deleteTrip, leaveTrip } from "../lib/session.js";
import { isGuest } from "../lib/auth.js";
import { getProfile, greeting } from "../lib/profile.js";
import { dateRangeLabel, todayISO, daysToGo, tripDayNumber, legGradient } from "../lib/tripConfig.js";
import Avatar from "./Avatar.jsx";
import ProfileSheet from "./ProfileSheet.jsx";
import JoinCode from "./JoinCode.jsx";
import { confirmDialog } from "./dialogs.jsx";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import RouteLine from "./ui/RouteLine.jsx";
import Skeleton from "./ui/Skeleton.jsx";
import Sheet from "./ui/Sheet.jsx";
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

  // The hero countdown: a big serif numeral + an italic serif label.
  const heroCountdown = (cfg) => {
    if (!cfg) return { n: null, label: "needs setup" };
    const dtg = daysToGo(cfg);
    if (dtg > 1) return { n: dtg, label: "days to go" };
    if (dtg === 1) return { n: 1, label: "day to go" };
    return { n: tripDayNumber(cfg), label: `of ${cfg.days.length} days` };
  };

  const routeStops = (cfg) => (cfg ? cfg.legOrder.map((k) => ({ name: cfg.legs[k]?.name || k, color: cfg.legs[k]?.color })) : []);
  const coverArt = (cfg) => cfg?.cover?.url
    ? { backgroundImage: `url("${cfg.cover.url}")` }
    : { background: legGradient(cfg) };

  const cd = hero ? heroCountdown(hero.config) : null;

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        {/* Greeting header */}
        <div className={s.greeting}>
          <div className={s.greetingMain}>
            <h1 className={s.hello}>
              {profile?.name ? `${greeting()}, ${profile.name.split(" ")[0]}` : greeting()}
            </h1>
          </div>
          <Avatar name={profile?.name} color={profile?.color} size="sm" title="Profile" onClick={() => setProfileOpen(true)} />
        </div>

        {isGuest(user) && (trips?.length || 0) > 0 && (
          <button onClick={() => setProfileOpen(true)} className={s.guestWarn}>
            <span className={s.guestIcon}><Icon name="cloudoff" size={17} /></span>
            <span className={s.guestBody}>
              <span className={s.guestTitle}>Your trips live only on this phone</span>
              <span className={s.guestSub}>Save an account to keep them safe.</span>
            </span>
            <span className={s.guestArrow}><Icon name="arrow" size={13} strokeWidth={2} /></span>
          </button>
        )}

        {/* Loading skeletons — mirror the loaded layout so nothing jumps */}
        {trips === null && (
          <div className={s.skeletons}>
            <Skeleton height={146} />
            <div className={s.skelPanel}>
              <div className={s.skelRow}><Skeleton height={12} width="55%" /></div>
              <div className={s.skelRow}><Skeleton height={30} width="70%" /></div>
              <div className={s.skelRow}><Skeleton height={48} width={112} /><Skeleton height={26} width={90} round /></div>
            </div>
            <div className={s.skelRow}><Skeleton height={22} width={60} /><Skeleton height={22} width={90} /><Skeleton height={22} width={70} /></div>
            <div className={s.skelRow}><Skeleton height={76} /></div>
            <div className={s.skelRow}><Skeleton height={44} /></div>
            <div className={s.skelActions}><Skeleton height={46} /><Skeleton height={46} /></div>
          </div>
        )}

        {/* Zero trips — the welcome moment */}
        {trips !== null && sorted.length === 0 && (
          <div className={s.welcome}>
            <div className={s.welcomeRoute}>
              <span className={s.welcomeDot} />
              <span className={s.welcomeSeg} />
              <span className={s.welcomeDot} />
              <span className={s.welcomeSeg} />
              <span className={s.welcomeDot} />
            </div>
            <h2 className={s.welcomeTitle}>Where to first?</h2>
            <p className={s.welcomeBody}>
              Plan the days, split the budget, pack together — everything about the trip in one place, shared with everyone on it.
            </p>
            <Button icon="plus" onClick={() => onNew(lastProfile)} className={s.welcomeNew}>New trip</Button>
            <div className={s.welcomeRule} />
            <div className={s.section}>Join with a code</div>
            <JoinCode defaultProfile={lastProfile} onJoined={onOpen} />
          </div>
        )}

        {/* Hero: the trip that matters right now */}
        {hero && (
          <div role="button" tabIndex={0} onClick={() => open(hero)} onKeyDown={keyOpen(hero, open)} className={s.hero}>
            <div className={s.heroCover} style={coverArt(hero.config)}>
              {hero.config?.cover?.author && (
                <span className={s.heroCredit}>Photo: {hero.config.cover.author} / Unsplash</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); remove(hero); }} title="Leave or delete trip" aria-label="Leave or delete trip" className={s.heroMenu}>
                <Icon name="dots" size={14} />
              </button>
            </div>
            <div className={s.heroPanel}>
              {hero.config && <RouteLine stops={routeStops(hero.config)} labels />}
              <div className={s.heroTitle}>{hero.config?.title || `Trip ${hero.code}`}</div>
              <div className={s.heroMeta}>
                {hero.config ? `${dateRangeLabel(hero.config)} · ${hero.config.days.length} days` : `Tap to set up · code ${hero.code}`}
              </div>
              <div className={s.heroRule} />
              <div className={s.heroFoot}>
                <span className={s.heroCount}>
                  {cd.n != null && <span className={s.heroNum}>{cd.n}</span>}
                  <span className={s.heroCountLabel}>{cd.label}</span>
                </span>
                {hero.members.length > 0 && (
                  <span className={s.heroAvatars}>
                    {hero.members.map((m) => (
                      <span key={m.user_id} className={s.stackAv}>
                        <Avatar name={m.name} color={m.color} size="xs" />
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Travel stats — inline, baseline-aligned */}
        {stats && (
          <div className={s.stats}>
            {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "days travelled"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l], i) => (
              <span key={l} className={s.stat}>
                {i > 0 && <span className={s.statRule} />}
                <span className={s.statNum}>{n}</span>
                <span className={s.statLabel}>{l}</span>
              </span>
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <div className={s.section}>Also planned</div>
            {upcoming.map((t) => (
              <div key={t.id} role="button" tabIndex={0} onClick={() => open(t)} onKeyDown={keyOpen(t, open)} className={s.card}>
                <span className={s.cardThumb} style={coverArt(t.config)} />
                <span className={s.cardMain}>
                  <span className={s.cardTitle}>{t.config?.title || `Trip ${t.code}`}</span>
                  <span className={s.cardMeta}>
                    {t.config ? dateRangeLabel(t.config) : "Needs setup"}{t.members.length > 1 ? ` · ${t.members.length} members` : ""}
                  </span>
                </span>
                <button onClick={(e) => { e.stopPropagation(); remove(t); }} title="Leave or delete trip" aria-label="Leave or delete trip" className={s.cardMenu}>
                  <Icon name="dots" size={16} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            <div className={s.section}>Past trips</div>
            {past.map((t) => (
              <div key={t.id} role="button" tabIndex={0} onClick={() => open(t)} onKeyDown={keyOpen(t, open)} className={s.pastRow}>
                <span className={s.pastTitle}>{t.config?.title || `Trip ${t.code}`}</span>
                <span className={s.pastSpacer} />
                <span className={s.pastMeta}>{t.config ? dateRangeLabel(t.config) : t.code}</span>
                <span className={s.pastArrow}><Icon name="arrow" size={13} strokeWidth={2} /></span>
              </div>
            ))}
          </>
        )}

        {error && <p className={s.error}>{error}</p>}

        {trips !== null && sorted.length > 0 && (
          <div className={s.actions}>
            <Button variant="ghost" icon="ticket" onClick={() => setJoining(true)}>Join with a code</Button>
            <Button icon="plus" onClick={() => onNew(lastProfile)}>New trip</Button>
          </div>
        )}

        {joining && (
          <Sheet onClose={() => setJoining(false)} label="Join with a code">
            <h2 className={s.joinTitle}>Join with a code</h2>
            <JoinCode defaultProfile={lastProfile} onJoined={onOpen} autoFocus />
          </Sheet>
        )}

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

// Open the trip on Enter/Space for the div-based (non-button) card shells.
const keyOpen = (t, onOpen) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t); }
};
