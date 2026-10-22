import { useEffect, useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { loadSession, listMyTrips, enterTrip, joinTrip, COLORS } from "../lib/session.js";
import { currentUser } from "../lib/auth.js";
import { getProfile, getLocalProfile } from "../lib/profile.js";
import { ONBOARDED_KEY } from "./Onboarding.jsx";
import JoinCode from "./JoinCode.jsx";
import Spinner from "./Spinner.jsx";
import { APP_NAME } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, FormStack } from "./ui/Field.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import s from "./JoinLinkGate.module.css";

// Someone tapped app.roundtrip.one/j/CODE. Skip onboarding: if this device is
// already on the trip go straight in, otherwise ask only for a name and join.
// Either way the URL goes back to "/" so a reload or a home-screen launch
// opens the app normally, then onReady() hands over to App exactly like
// TripGate does. App opens on the itinerary, which shows today (or day 1).

const isNetworkError = (e) =>
  (typeof navigator !== "undefined" && navigator.onLine === false) ||
  /fetch|network|load failed|timed? ?out/i.test(String(e?.message || e));

const isBadCode = (e) => /no trip found/i.test(String(e?.message || ""));

const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export default function JoinLinkGate({ code, onReady }) {
  // checking | name | joining | bad | offline | error
  const [step, setStep] = useState(code?.length === 6 ? "checking" : "bad");
  const [name, setName] = useState("");
  const [color, setColor] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const finish = () => {
    // A link-joiner never saw the intro slides; don't show them later either.
    try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch { /* private mode */ }
    window.history.replaceState(window.history.state, "", "/");
    onReady();
  };

  useEffect(() => {
    if (step !== "checking" || !isConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        // This device already has this trip open: works offline too.
        const s = await loadSession();
        if (s?.code === code) { if (!cancelled) finish(); return; }
        if (typeof navigator !== "undefined" && navigator.onLine === false) { if (!cancelled) setStep("offline"); return; }

        // Already a member from an earlier visit (or another trip is open).
        const user = await currentUser().catch(() => null);
        if (user) {
          const trips = await listMyTrips();
          const mine = trips.find((t) => t.code === code);
          if (mine) { await enterTrip(mine); if (!cancelled) finish(); return; }
        }
        const profile = getProfile(user) || getLocalProfile();
        if (cancelled) return;
        setName(profile?.name || "");
        setColor(profile?.color || pickColor());
        setStep("name");
      } catch (e) {
        if (cancelled) return;
        setStep(isNetworkError(e) ? "offline" : "error");
        setError(e?.message || "");
      }
    })();
    return () => { cancelled = true; };
    // finish/onReady are stable for the life of the gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code, attempt]);

  // Come back by itself when the connection does.
  useEffect(() => {
    if (step !== "offline") return;
    const retry = () => { setStep("checking"); setAttempt((n) => n + 1); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [step]);

  const join = async (e) => {
    e?.preventDefault();
    if (!name.trim()) { setError("Enter your name first."); return; }
    setStep("joining"); setError("");
    try {
      await joinTrip(code, name.trim(), color || pickColor());
      finish();
    } catch (err) {
      if (isBadCode(err)) setStep("bad");
      else if (isNetworkError(err)) setStep("offline");
      else { setStep("name"); setError(err?.message || "Something went wrong. Try again."); }
    }
  };

  const retry = () => { setError(""); setStep("checking"); setAttempt((n) => n + 1); };

  if (!isConfigured) {
    return (
      <div className={s.centerPage}>
        <EmptyState icon="cloudoff" title={`${APP_NAME} can't connect right now`}
          body="Something's wrong on our side. Please try again a bit later." />
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.brand}>
          <Icon name="route" size={22} strokeWidth={1.6} />
          <span className={s.wordmark}>{APP_NAME}</span>
        </div>

        {step === "checking" && (
          <p className={s.checking}><Spinner size={14} /> Opening the trip…</p>
        )}

        {(step === "name" || step === "joining") && (
          <form onSubmit={join}>
            <h1 className={s.title}>You're invited</h1>
            <p className={s.tagline}>Add your name so the group knows who's who. No account needed.</p>
            <FormStack className={s.form}>
              <Field label="Your name on this trip">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya"
                  maxLength={24} autoFocus={!name} autoComplete="given-name" enterKeyHint="go" />
              </Field>
            </FormStack>
            <Button type="submit" full disabled={step === "joining"} className={s.joinBtn}>
              {step === "joining" ? <><Spinner size={14} on="accent" /> Joining…</> : <>Join the trip <Icon name="arrow" size={13} strokeWidth={2} /></>}
            </Button>
            {error && <p className={s.error}>{error}</p>}
          </form>
        )}

        {step === "bad" && (
          <>
            <h1 className={s.title}>That link didn't work</h1>
            <p className={s.tagline}>There's no trip with the code {code ? <b>{code}</b> : "in this link"}. Ask the organiser for the code and type it here.</p>
            <div className={s.fallback}>
              <JoinCode defaultProfile={getLocalProfile()} onJoined={finish} autoFocus />
            </div>
          </>
        )}

        {step === "offline" && (
          <>
            <h1 className={s.title}>You're offline</h1>
            <p className={s.tagline}>Joining needs a connection once. This page will carry on when you're back online.</p>
            <Button variant="tonal" onClick={retry} className={s.joinBtn}>Try again</Button>
          </>
        )}

        {step === "error" && (
          <>
            <h1 className={s.title}>Couldn't open the trip</h1>
            <p className={s.tagline}>{error || "Something went wrong."}</p>
            <Button variant="tonal" onClick={retry} className={s.joinBtn}>Try again</Button>
          </>
        )}

        <span className={s.spacer} />
        <button type="button" className={s.quiet} onClick={() => { window.history.replaceState(window.history.state, "", "/"); window.location.reload(); }}>
          Open {APP_NAME} without joining
        </button>
      </div>
    </div>
  );
}
