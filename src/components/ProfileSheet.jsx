import { useState } from "react";
import { isGuest, signOut } from "../lib/auth.js";
import { getProfile, saveProfile } from "../lib/profile.js";
import { COLORS } from "../lib/session.js";
import Avatar from "./Avatar.jsx";
import AccountSheet from "./AccountSheet.jsx";
import { APP_NAME, ACCENT, INK, MUTED, getThemePref, setThemePref } from "../theme.js";
import pkg from "../../package.json";

const THEMES = [
  { id: "system", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// Full profile bottom-sheet: identity, account, travel stats, appearance.
// `stats` = { trips, days, places } derived by the caller from listMyTrips().
export default function ProfileSheet({ user, stats, onClose, onChanged }) {
  const profile = getProfile(user) || {};
  const guest = isGuest(user);
  const [name, setName] = useState(profile.name || "");
  const [color, setColor] = useState(profile.color || COLORS[0]);
  const [editing, setEditing] = useState(!profile.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState(false);
  const [theme, setTheme] = useState(getThemePref());

  const saveName = async () => {
    if (!name.trim()) { setError("Enter a name."); return; }
    setBusy(true); setError("");
    try {
      await saveProfile({ name: name.trim(), color });
      setEditing(false);
      onChanged?.();
    } catch (e) { setError(e.message || "Couldn't save."); }
    setBusy(false);
  };

  const doSignOut = async () => {
    setBusy(true); setError("");
    try { await signOut(); onChanged?.(); onClose(); }
    catch (e) { setError(e.message || "Couldn't sign out."); }
    setBusy(false);
  };

  const pickTheme = (id) => { setTheme(id); setThemePref(id); };

  const sectionTitle = (t) => (
    <div className="text-[11px] font-bold uppercase tracking-widest mt-5 mb-2" style={{ color: MUTED }}>{t}</div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm m-4 rounded-2xl p-5 overflow-y-auto" style={{ backgroundColor: "var(--card)", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>

        {/* Identity */}
        <div className="flex items-center gap-3">
          <Avatar name={name || profile.name} color={color} size="lg" />
          <div className="min-w-0 flex-1">
            {!editing ? (
              <>
                <div className="text-lg font-bold truncate" style={{ color: INK }}>{profile.name || "Traveller"}</div>
                <div className="text-xs truncate" style={{ color: MUTED }}>
                  {guest ? "Guest — account not saved yet" : user?.email || "Signed in"}
                </div>
              </>
            ) : (
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="w-full text-sm font-semibold rounded-xl border px-3 py-2.5"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: INK }} />
            )}
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border flex-shrink-0" style={{ borderColor: "var(--border)", color: MUTED }}>
              Edit
            </button>
          )}
        </div>
        {editing && (
          <div className="mt-3">
            <div className="flex gap-2 mb-3">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: c, outline: color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }} aria-label={c}>
                  {color === c && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveName} disabled={busy} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: ACCENT }}>
                {busy ? "Saving…" : "Save"}
              </button>
              {profile.name && (
                <button onClick={() => { setEditing(false); setName(profile.name); setColor(profile.color || COLORS[0]); }} className="text-sm font-semibold px-4 rounded-full" style={{ color: MUTED }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Travel stats */}
        {stats && (
          <>
            {sectionTitle("Your travels")}
            <div className="grid grid-cols-3 gap-2">
              {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "days"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l]) => (
                <div key={l} className="rounded-xl border py-3 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--field)" }}>
                  <div className="text-xl font-bold" style={{ color: INK }}>{n}</div>
                  <div className="text-[11px] font-semibold" style={{ color: MUTED }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Account */}
        {sectionTitle("Account")}
        {guest ? (
          <button onClick={() => setAccount(true)} className="w-full text-left rounded-2xl border p-3" style={{ borderColor: "var(--warn-border)", backgroundColor: "var(--warn-bg)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "var(--warn-ink)" }}>Save your account</div>
            <div className="text-[11px] leading-relaxed" style={{ color: "var(--warn-ink)" }}>
              Your trips live only in this browser. Link an email or Google to open them on any device.
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: INK }}>
              Signed in as <span className="font-bold">{user?.email}</span>
            </div>
            <button onClick={doSignOut} disabled={busy} className="text-xs font-bold" style={{ color: ACCENT }}>Sign out</button>
          </div>
        )}

        {/* Appearance */}
        {sectionTitle("Appearance")}
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => pickTheme(t.id)} className="flex-1 text-xs font-bold py-2 rounded-full border"
              style={theme === t.id
                ? { backgroundColor: "var(--solid)", borderColor: "var(--solid)", color: "#FFF" }
                : { borderColor: "var(--border)", color: MUTED }}>
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] mt-4" style={{ color: "var(--faint)" }}>
          Backups live inside each trip — open a trip and use ↓ Backup data in its header.
        </p>

        {error && <p className="text-xs mt-2 text-center" style={{ color: ACCENT }}>{error}</p>}

        <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 mt-3 rounded-full" style={{ color: MUTED }}>Close</button>
        <p className="text-center text-[10px] mt-1" style={{ color: "var(--faint)" }}>
          {APP_NAME} v{pkg.version} · <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color: "var(--faint)", textDecoration: "underline" }}>Privacy</a>
        </p>

        {account && (
          <AccountSheet user={user} onClose={() => setAccount(false)} onChanged={() => { setAccount(false); onChanged?.(); }} />
        )}
      </div>
    </div>
  );
}
