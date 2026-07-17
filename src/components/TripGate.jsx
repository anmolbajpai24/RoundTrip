import { useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { COLORS, joinTrip } from "../lib/session.js";
import { getLocalProfile } from "../lib/profile.js";
import TripWizard from "./TripWizard.jsx";
import AccountSheet from "./AccountSheet.jsx";
import { APP_NAME, APP_TAGLINE } from "../theme.js";
import Button from "./ui/Button.jsx";
import Field, { Input } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import s from "./TripGate.module.css";

// Landing for a device with no trips yet. The display name/colour were
// captured during onboarding (editable in the wizard/join); this screen only
// offers the three ways in: plan, join with a code, or sign in.
// On success it calls onReady().
export default function TripGate({ onReady }) {
  const profile = getLocalProfile();
  const [name, setName] = useState(profile?.name || "");
  const [color, setColor] = useState(profile?.color || COLORS[0]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wizard, setWizard] = useState(false);
  const [signin, setSignin] = useState(false);
  const askName = !profile?.name; // onboarding skipped → capture here instead

  if (!isConfigured) {
    // Real users should never see setup internals — those go to the console
    // (and the full walkthrough is shown in dev builds only).
    console.error(`${APP_NAME} setup: Supabase isn't configured. Follow supabase/SETUP.md and add the keys to .env.local, then reload.`);
    return (
      <div className={s.centerPage}>
        <EmptyState
          icon="cloudoff"
          title={`${APP_NAME} can't connect right now`}
          body={import.meta.env.DEV
            ? "Cross-device sync needs a free Supabase project. Follow supabase/SETUP.md and add your keys to .env.local, then reload."
            : "Something's wrong on our side — please try again a bit later."}
        />
      </div>
    );
  }

  if (wizard) {
    return <TripWizard profile={{ name: name.trim(), color }} onDone={onReady} onCancel={() => setWizard(false)} />;
  }

  const doJoin = async () => {
    if (!name.trim()) { setError("Enter your name first."); return; }
    if (!code.trim()) { setError("Enter the trip code."); return; }
    setBusy(true); setError("");
    try {
      await joinTrip(code, name.trim(), color);
      onReady();
    } catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
  };

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.hero}>
          <div className={s.kicker}>{APP_NAME}</div>
          <h1 className={s.title}>
            {profile?.name ? <>Hi <em className={s.em}>{profile.name}</em></> : APP_NAME}
          </h1>
          <p className={s.tagline}>{profile?.name ? "Where to next?" : APP_TAGLINE}</p>
        </div>

        {askName && (
          <div className={s.nameBlock}>
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" maxLength={24} />
            </Field>
            <Field label="Your colour">
              <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
            </Field>
          </div>
        )}

        <Button full onClick={() => { setError(""); setWizard(true); }} disabled={busy} className={s.plan}>
          Plan a new trip
        </Button>

        <div className={s.divider}>
          <span className={s.rule} />
          <span className={s.or}>or join with a code</span>
          <span className={s.rule} />
        </div>

        <div className={s.joinRow}>
          <Input code value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && doJoin()} placeholder="ABC123" maxLength={6} className={s.joinInput} />
          <Button onClick={doJoin} disabled={busy}>{busy ? "…" : "Join"}</Button>
        </div>

        <button onClick={() => setSignin(true)} className={s.signin}>
          Used {APP_NAME} before? <span className={s.signinLink}>Sign in</span>
        </button>

        {error && <p className={s.error}>{error}</p>}

        {signin && (
          <AccountSheet user={null} mode="signin" onClose={() => setSignin(false)} onChanged={onReady} />
        )}
      </div>
    </div>
  );
}
