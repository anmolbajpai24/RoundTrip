import { useState, useEffect } from "react";
import { listMyTrips, enterTrip, joinTrip, COLORS } from "../lib/session.js";
import { isGuest } from "../lib/auth.js";
import { getProfile, greeting } from "../lib/profile.js";
import { dateRangeLabel, todayISO, daysToGo, tripDayNumber, legGradient } from "../lib/tripConfig.js";
import PersonBadge from "./PersonBadge.jsx";
import Avatar from "./Avatar.jsx";
import ProfileSheet from "./ProfileSheet.jsx";
import { APP_NAME, ACCENT, INK, MUTED } from "../theme.js";

const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--card)", color: INK };

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

  const countdown = (cfg) => {
    if (!cfg) return "Needs setup";
    const dtg = daysToGo(cfg);
    if (dtg > 1) return `In ${dtg} days`;
    if (dtg === 1) return "Starts tomorrow";
    if (dtg === 0) return "Starts today 🎉";
    return `Day ${tripDayNumber(cfg)} of ${cfg.days.length}`;
  };

  const sectionTitle = (t) => (
    <div className="text-[11px] font-bold uppercase tracking-widest mt-5 mb-2" style={{ color: MUTED }}>{t}</div>
  );

  return (
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: "var(--bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-lg mx-auto">
        {/* Greeting header */}
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>✈️ {APP_NAME}</div>
            <h1 className="text-xl font-bold truncate" style={{ color: INK }}>
              {profile?.name ? `${greeting()}, ${profile.name.split(" ")[0]}` : greeting()}
            </h1>
          </div>
          <Avatar name={profile?.name} color={profile?.color} size="md" title="Profile" onClick={() => setProfileOpen(true)} />
        </div>

        {isGuest(user) && (trips?.length || 0) > 0 && (
          <button onClick={() => setProfileOpen(true)} className="w-full text-left rounded-2xl border p-3 mb-4" style={{ borderColor: "var(--warn-border)", backgroundColor: "var(--warn-bg)" }}>
            <span className="text-xs" style={{ color: "var(--warn-ink)" }}>
              ⚠️ Your trips live only in this browser. <span className="font-bold">Save your account</span> to open them anywhere.
            </span>
          </button>
        )}

        {/* Loading skeletons */}
        {trips === null && (
          <div className="animate-pulse">
            <div className="rounded-3xl mb-3" style={{ height: 176, backgroundColor: "var(--chip)" }} />
            <div className="rounded-2xl mb-3" style={{ height: 64, backgroundColor: "var(--chip)" }} />
            <div className="rounded-2xl" style={{ height: 64, backgroundColor: "var(--chip)" }} />
          </div>
        )}

        {trips !== null && sorted.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">🧳</div>
            <p className="text-sm mb-1 font-semibold" style={{ color: INK }}>No trips yet</p>
            <p className="text-xs" style={{ color: MUTED }}>Start one below, or join a friend's trip with their code.</p>
          </div>
        )}

        {/* Hero: the trip that matters right now */}
        {hero && (
          <button onClick={() => open(hero)} className="w-full text-left rounded-3xl overflow-hidden relative" style={{ minHeight: 176 }}>
            <div
              className="absolute inset-0"
              style={hero.config?.cover?.url
                ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.6)), url("${hero.config.cover.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.35)), ${legGradient(hero.config)}` }}
            />
            <div className="relative p-4 flex flex-col justify-between" style={{ minHeight: 176 }}>
              <div className="flex justify-end">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "#1D2433" }}>
                  {countdown(hero.config)}
                </span>
              </div>
              <div>
                <div className="text-white text-2xl font-bold drop-shadow-sm">{hero.config?.title || `Trip ${hero.code}`}</div>
                <div className="text-[12px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "ui-monospace, monospace" }}>
                  {hero.config ? dateRangeLabel(hero.config) : "Tap to set up"} · code {hero.code}
                </div>
                {hero.members.length > 0 && (
                  <div className="flex items-center mt-2">
                    {hero.members.map((m, i) => (
                      <span key={m.user_id} style={{ marginLeft: i ? -6 : 0 }}>
                        <Avatar name={m.name} color={m.color} size="xs" />
                      </span>
                    ))}
                    <span className="text-[11px] font-semibold ml-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {hero.members.map((m) => m.name).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {hero.config?.cover?.author && (
              <span className="absolute bottom-1.5 right-3 text-[9px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                Photo: {hero.config.cover.author} / Unsplash
              </span>
            )}
          </button>
        )}

        {/* Travel stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "travel days"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l]) => (
              <div key={l} className="rounded-xl border py-2.5 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                <div className="text-lg font-bold" style={{ color: INK }}>{n}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            {sectionTitle("Also planned")}
            {upcoming.map((t) => <TripCard key={t.id} trip={t} onOpen={open} countdown={countdown} />)}
          </>
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            {sectionTitle("Past trips")}
            {past.map((t) => <PastRow key={t.id} trip={t} onOpen={open} />)}
          </>
        )}

        {error && <p className="text-xs my-2 text-center" style={{ color: ACCENT }}>{error}</p>}

        <button onClick={() => onNew(lastProfile)} className="w-full text-sm font-bold text-white py-3 rounded-full mt-5 mb-3" style={{ backgroundColor: ACCENT }}>
          + New trip
        </button>
        {!joining ? (
          <button onClick={() => setJoining(true)} className="w-full text-sm font-semibold py-2 rounded-full" style={{ color: MUTED }}>
            Join a trip with a code
          </button>
        ) : (
          <JoinForm defaultProfile={lastProfile} onJoined={onOpen} onCancel={() => setJoining(false)} />
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

function TripCard({ trip: t, onOpen, countdown }) {
  const cfg = t.config;
  return (
    <button onClick={() => onOpen(t)} className="w-full text-left rounded-2xl border mb-3 overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      {cfg && (
        <div className="flex h-1.5">
          {cfg.legOrder.map((k, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: cfg.legs[k]?.color || "var(--border)" }} />
          ))}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold" style={{ color: INK }}>{cfg?.title || `Trip ${t.code}`}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--chip)", color: MUTED }}>{countdown(cfg)}</span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: "ui-monospace, monospace" }}>
          {cfg ? dateRangeLabel(cfg) : "Needs setup"} · code {t.code}
        </div>
        {t.members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: MUTED }}>With:</span>
            {t.members.map((m) => <PersonBadge key={m.user_id} member={m} size="xs" />)}
          </div>
        )}
      </div>
    </button>
  );
}

function PastRow({ trip: t, onOpen }) {
  const cfg = t.config;
  return (
    <button onClick={() => onOpen(t)} className="w-full text-left rounded-xl border mb-2 px-3 py-2.5 flex items-center gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", opacity: 0.7 }}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: legGradient(cfg) }} />
      <span className="text-sm font-semibold truncate flex-1" style={{ color: INK }}>{cfg?.title || `Trip ${t.code}`}</span>
      <span className="text-[11px] flex-shrink-0" style={{ color: MUTED, fontFamily: "ui-monospace, monospace" }}>{cfg ? dateRangeLabel(cfg) : t.code}</span>
    </button>
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
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex gap-2 mb-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Trip code" maxLength={6}
          className="flex-1 text-sm rounded-full border px-4 py-2.5 tracking-[0.2em]" style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name on this trip" maxLength={24}
        className="w-full text-sm rounded-full border px-4 py-2.5 mb-2" style={inputStyle} />
      <div className="flex gap-2 mb-3">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: c, outline: color === c ? "2px solid var(--ink)" : "none", outlineOffset: 2 }}>
            {color === c && <span className="text-white text-[10px] font-bold">✓</span>}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={join} disabled={busy} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: "var(--solid)" }}>
          {busy ? "Joining…" : "Join"}
        </button>
        <button onClick={onCancel} className="text-sm font-semibold px-4 rounded-full" style={{ color: MUTED }}>Cancel</button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: ACCENT }}>{error}</p>}
    </div>
  );
}
