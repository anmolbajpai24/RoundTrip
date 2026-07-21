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

// Full profile bottom-sheet: identity (saves as you go), account, travel
// stats, appearance. `stats` = { trips, days, places } from listMyTrips().
export default function ProfileSheet({ user, stats, onClose, onChanged }) {
  const profile = getProfile(user) || {};
  const guest = isGuest(user);
  const [name, setName] = useState(profile.name || "");
  const [color, setColor] = useState(profile.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState(false);
  const [theme, setTheme] = useState(getThemePref());

  // Identity saves as you go: name on blur, colour on pick.
  const persist = async (nextName, nextColor) => {
    if (!nextName.trim()) return;
    setBusy(true); setError("");
    try { await saveProfile({ name: nextName.trim(), color: nextColor }); onChanged?.(); }
    catch (e) { setError(e.message || "Couldn't save."); }
    setBusy(false);
  };
  const pickColor = (c) => { setColor(c); persist(name, c); };

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
          <div className={s.head}>
            <h2 className={s.headTitle}>Your profile</h2>
            <span className={s.headCaption}>Trip-mates see this</span>
          </div>

          {/* Identity — always editable, saves as you go */}
          <div className={s.identity}>
            <Avatar name={name || profile.name} color={color} size="lg" />
            <div className={s.identityMain}>
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => persist(name, color)}
                maxLength={24} placeholder="Your name" aria-label="Your name" />
            </div>
          </div>
          <div className={s.swatches}>
            <SwatchPicker colors={COLORS} value={color} onChange={pickColor} disabled={busy} />
          </div>

          {/* Travel stats */}
          {stats && (
            <div className={s.stats}>
              {[[stats.trips, stats.trips === 1 ? "trip" : "trips"], [stats.days, "days"], [stats.places, stats.places === 1 ? "place" : "places"]].map(([n, l], i) => (
                <span key={l} className={s.stat}>
                  {i > 0 && <span className={s.statRule} />}
                  <span className={s.statNum}>{n}</span>
                  <span className={s.statLabel}>{l}</span>
                </span>
              ))}
            </div>
          )}

          {/* Account */}
          <div className={s.section}>Account</div>
          {guest ? (
            <>
              <p className={s.guestBody}>You're a guest. Your trips live only in this browser.</p>
              <Button full onClick={() => setAccount(true)} className={s.guestCta}>Save your account</Button>
              <p className={s.subCopy}>Free — keeps your trips if you lose this phone.</p>
            </>
          ) : (
            <>
              <div className={s.accountRow}>
                <span className={s.accountEmail}>{user?.email}</span>
                <button onClick={() => doSignOut(requestClose)} disabled={busy} className={s.signOut}>Sign out</button>
              </div>
              <p className={s.subCopy}>Synced — your trips are safe on any phone.</p>
            </>
          )}

          {/* Appearance */}
          <div className={s.section}>Appearance</div>
          <Segmented value={theme} onChange={pickTheme} options={THEMES} className={s.themePicker} />

          {error && <p className={s.error}>{error}</p>}

          <div className={s.footer}>
            <span className={s.version}>{APP_NAME} v{pkg.version}</span>
            <span className={s.links}>
              <a href="https://roundtrip.one/privacy" target="_blank" rel="noreferrer" className={s.link}>Privacy</a>
              <a href="https://roundtrip.one/terms" target="_blank" rel="noreferrer" className={s.link}>Terms</a>
              <a href="mailto:support@roundtrip.one" className={s.link}>Support</a>
            </span>
          </div>

          {account && (
            <AccountSheet user={user} onClose={() => setAccount(false)} onChanged={() => { setAccount(false); onChanged?.(); }} />
          )}
        </>
      )}
    </Sheet>
  );
}
