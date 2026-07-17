import { useState } from "react";
import { isGuest, signOut } from "../lib/auth.js";
import { getProfile, saveProfile } from "../lib/profile.js";
import { COLORS } from "../lib/session.js";
import Avatar from "./Avatar.jsx";
import AccountSheet from "./AccountSheet.jsx";
import Sheet from "./ui/Sheet.jsx";
import Button from "./ui/Button.jsx";
import { Input } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import Segmented from "./ui/Segmented.jsx";
import { APP_NAME, getThemePref, setThemePref } from "../theme.js";
import pkg from "../../package.json";
import s from "./ProfileSheet.module.css";

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

  const doSignOut = async (requestClose) => {
    setBusy(true); setError("");
    try { await signOut(); onChanged?.(); requestClose(); }
    catch (e) { setError(e.message || "Couldn't sign out."); }
    setBusy(false);
  };

  const pickTheme = (id) => { setTheme(id); setThemePref(id); };

  return (
    <Sheet onClose={onClose} label="Your profile">
      {(requestClose) => (
        <>
          {/* Identity */}
          <div className={s.identity}>
            <Avatar name={name || profile.name} color={color} size="lg" />
            <div className={s.identityMain}>
              {!editing ? (
                <>
                  <div className={s.name}>{profile.name || "Traveller"}</div>
                  <div className={s.sub}>{guest ? "Guest — account not saved yet" : user?.email || "Signed in"}</div>
                </>
              ) : (
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveName()} />
              )}
            </div>
            {!editing && <Button size="sm" variant="tonal" onClick={() => setEditing(true)}>Edit</Button>}
          </div>
          {editing && (
            <div className={s.editBlock}>
              <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
              <div className={s.editActions}>
                <Button full onClick={saveName} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                {profile.name && (
                  <Button variant="ghost" onClick={() => { setEditing(false); setName(profile.name); setColor(profile.color || COLORS[0]); }}>Cancel</Button>
                )}
              </div>
            </div>
          )}

          {/* Travel stats */}
          {stats && (
            <>
              <div className={s.section}>Your travels</div>
              <div className={s.stats}>
                {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "days"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l]) => (
                  <div key={l} className={s.stat}>
                    <div className={s.statNum}>{n}</div>
                    <div className={s.statLabel}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Account */}
          <div className={s.section}>Account</div>
          {guest ? (
            <button onClick={() => setAccount(true)} className={s.guestCard}>
              <div className={s.guestTitle}>Save your account</div>
              <div className={s.guestBody}>Your trips live only in this browser. Link an email or Google to open them on any device.</div>
            </button>
          ) : (
            <div className={s.accountCard}>
              <div className={s.accountLine}>Signed in as <span className={s.accountEmail}>{user?.email}</span></div>
              <button onClick={() => doSignOut(requestClose)} disabled={busy} className={s.signOut}>Sign out</button>
            </div>
          )}

          {/* Appearance */}
          <div className={s.section}>Appearance</div>
          <Segmented value={theme} onChange={pickTheme} options={THEMES} className={s.themePicker} />

          <p className={s.hint}>Backups live inside each trip — open a trip and use “Backup data” in its header.</p>

          {error && <p className={s.error}>{error}</p>}

          <Button full variant="ghost" onClick={requestClose} className={s.close}>Close</Button>
          <p className={s.version}>
            {APP_NAME} v{pkg.version} · <a href="/privacy.html" target="_blank" rel="noreferrer" className={s.link}>Privacy</a>
          </p>

          {account && (
            <AccountSheet user={user} onClose={() => setAccount(false)} onChanged={() => { setAccount(false); onChanged?.(); }} />
          )}
        </>
      )}
    </Sheet>
  );
}
