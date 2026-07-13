import { useState, useEffect } from "react";
import { listMyTrips, enterTrip, joinTrip, COLORS } from "../lib/session.js";
import { isGuest } from "../lib/auth.js";
import { dateRangeLabel, todayISO } from "../lib/tripConfig.js";
import PersonBadge from "./PersonBadge.jsx";
import { APP_NAME, ACCENT, INK, MUTED } from "../theme.js";

const inputStyle = { borderColor: "#E5E2DA", backgroundColor: "#FFF", color: INK };

// "Your trips" landing screen: every trip this account belongs to, with who's
// on it. Opens a trip (→ onOpen), starts the wizard (→ onNew) or joins by code.
export default function TripsHome({ user, onOpen, onNew, onAccount }) {
  const [trips, setTrips] = useState(null); // null = loading
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try { setTrips(await listMyTrips()); }
    catch (e) { setTrips([]); setError(e.message || "Couldn't load your trips."); }
  };
  useEffect(() => { load(); }, []);

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

  const lastProfile = trips?.[0] ? { name: trips[0].myName, color: trips[0].myColor } : null;

  const open = async (t) => {
    setError("");
    try { await enterTrip(t); onOpen(); }
    catch (e) { setError(e.message || "Couldn't open the trip."); }
  };

  return (
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: "#F7F5F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold" style={{ color: INK }}>Your trips</h1>
          <button onClick={onAccount} className="text-xs font-semibold px-3 py-1.5 rounded-full border" style={{ borderColor: "#E5E2DA", color: MUTED, backgroundColor: "#FFF" }}>
            {isGuest(user) ? "Guest · save account" : user?.email || "Account"}
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: MUTED }}>{APP_NAME}</p>

        {isGuest(user) && (trips?.length || 0) > 0 && (
          <button onClick={onAccount} className="w-full text-left rounded-2xl border p-3 mb-4" style={{ borderColor: "#F0D9A8", backgroundColor: "#FDF6E3" }}>
            <span className="text-xs" style={{ color: "#8A6D1A" }}>
              ⚠️ Your trips live only in this browser. <span className="font-bold">Save your account</span> to open them anywhere.
            </span>
          </button>
        )}

        {trips === null && <p className="text-sm py-8 text-center" style={{ color: MUTED }}>Loading your trips…</p>}

        {trips !== null && sorted.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">🧳</div>
            <p className="text-sm mb-1 font-semibold" style={{ color: INK }}>No trips yet</p>
            <p className="text-xs" style={{ color: MUTED }}>Start one below, or join a friend's trip with their code.</p>
          </div>
        )}

        {sorted.map((t) => {
          const cfg = t.config;
          const past = phase(t) === 2;
          const active = phase(t) === 0;
          return (
            <button key={t.id} onClick={() => open(t)} className="w-full text-left rounded-2xl border mb-3 overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", opacity: past ? 0.6 : 1 }}>
              {cfg && (
                <div className="flex h-1.5">
                  {cfg.legOrder.map((k, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: cfg.legs[k]?.color || "#E5E2DA" }} />
                  ))}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold" style={{ color: INK }}>{cfg?.title || `Trip ${t.code}`}</span>
                  {active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#2E7D4F" }}>NOW</span>}
                  {past && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDEAE2", color: MUTED }}>PAST</span>}
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
        })}

        {error && <p className="text-xs my-2 text-center" style={{ color: ACCENT }}>{error}</p>}

        <button onClick={() => onNew(lastProfile)} className="w-full text-sm font-bold text-white py-3 rounded-full mt-2 mb-3" style={{ backgroundColor: ACCENT }}>
          + New trip
        </button>
        {!joining ? (
          <button onClick={() => setJoining(true)} className="w-full text-sm font-semibold py-2 rounded-full" style={{ color: MUTED }}>
            Join a trip with a code
          </button>
        ) : (
          <JoinForm defaultProfile={lastProfile} onJoined={onOpen} onCancel={() => setJoining(false)} />
        )}
      </div>
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
    <div className="rounded-2xl border p-4" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
      <div className="flex gap-2 mb-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Trip code" maxLength={6}
          className="flex-1 text-sm rounded-full border px-4 py-2.5 tracking-[0.2em]" style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name on this trip" maxLength={24}
        className="w-full text-sm rounded-full border px-4 py-2.5 mb-2" style={inputStyle} />
      <div className="flex gap-2 mb-3">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: c, outline: color === c ? "2px solid #1D2433" : "none", outlineOffset: 2 }}>
            {color === c && <span className="text-white text-[10px] font-bold">✓</span>}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={join} disabled={busy} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: INK }}>
          {busy ? "Joining…" : "Join"}
        </button>
        <button onClick={onCancel} className="text-sm font-semibold px-4 rounded-full" style={{ color: MUTED }}>Cancel</button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: ACCENT }}>{error}</p>}
    </div>
  );
}
