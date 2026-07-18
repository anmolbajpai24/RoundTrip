import { useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { COLORS } from "../lib/session.js";
import { getLocalProfile } from "../lib/profile.js";
import TripWizard from "./TripWizard.jsx";
import AccountSheet from "./AccountSheet.jsx";
import JoinCode from "./JoinCode.jsx";
import { APP_NAME } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import s from "./TripGate.module.css";

// Landing for a device with no trips yet: three entries at three weights —
// primary button (plan), serif code cells (join), quiet sign-in line.
// On success it calls onReady().
export default function TripGate({ onReady }) {
  const profile = getLocalProfile();
  const [wizard, setWizard] = useState(false);
  const [signin, setSignin] = useState(false);

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
    // The wizard collects name/colour itself when the profile is still empty.
    return <TripWizard profile={profile?.name ? { name: profile.name, color: profile.color || COLORS[0] } : null}
      onDone={onReady} onCancel={() => setWizard(false)} />;
  }

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.brand}>
          <Icon name="route" size={22} strokeWidth={1.6} />
          <span className={s.wordmark}>{APP_NAME}</span>
        </div>

        <h1 className={s.title}>Where to next?</h1>
        <p className={s.tagline}>Start a trip from scratch, or join one a friend has already started.</p>

        <Button full onClick={() => setWizard(true)} className={s.plan}>
          Plan a new trip <Icon name="arrow" size={13} strokeWidth={2} />
        </Button>

        <div className={s.rule} />
        <div className={s.joinLabel}>Join with a code</div>
        <JoinCode defaultProfile={profile} onJoined={onReady} />

        <span className={s.spacer} />

        <button onClick={() => setSignin(true)} className={s.signin}>
          Already have an account? <span className={s.signinLink}>Sign in</span>
        </button>

        {signin && (
          <AccountSheet user={null} mode="signin" onClose={() => setSignin(false)} onChanged={onReady} />
        )}
      </div>
    </div>
  );
}
