import { useState } from "react";
import { isGuest, linkEmailStart, linkEmailVerify, linkGoogle, signInEmailStart, signInEmailVerify, signInGoogle, signOut } from "../lib/auth.js";
import Sheet from "./ui/Sheet.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input } from "./ui/Field.jsx";
import Icon, { GoogleMark } from "./ui/icons.jsx";
import { APP_NAME } from "../theme.js";
import s from "./AccountSheet.module.css";

// Bottom-sheet for account state. Two modes:
//  - mode="link"   (default): guest saves their account / linked user manages it
//  - mode="signin": returning user signs in on a new device
export default function AccountSheet({ user, mode = "link", onClose, onChanged }) {
  const guest = isGuest(user);
  const signin = mode === "signin";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("start"); // start | code | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn, nextStage) => {
    setBusy(true); setError("");
    try { await fn(); if (nextStage) setStage(nextStage); }
    catch (e) {
      let msg = e.message || "Something went wrong.";
      if (/manual linking/i.test(msg)) {
        // Deploy misconfiguration — tell the maintainer in the console, the user in plain words.
        console.warn('Roundtrip setup: enable "Allow manual linking" in Supabase → Authentication → Settings so guests can link Google/email to their existing anonymous user.');
        msg = "Sign-in isn't available right now — you can keep using the app as a guest.";
      }
      setError(msg);
    }
    setBusy(false);
  };

  const sendCode = () => {
    if (!email.trim().includes("@")) { setError("Enter a valid email."); return; }
    run(() => (signin ? signInEmailStart(email) : linkEmailStart(email)), "code");
  };
  const verifyCode = () => {
    if (code.trim().length < 6) { setError("Enter the 6-digit code from the email."); return; }
    run(async () => {
      if (signin) await signInEmailVerify(email, code);
      else await linkEmailVerify(email, code);
      setStage("done");
      onChanged?.();
    });
  };
  const google = () => run(() => (signin ? signInGoogle() : linkGoogle()));

  return (
    <Sheet onClose={onClose} label="Account">
      {(requestClose) => {
        const doSignOut = () => run(async () => { await signOut(); onChanged?.(); requestClose(); });
        return (
          <>
            {signin ? (
              <>
                <h2 className={s.title}>Sign in</h2>
                <p className={s.body}>Used {APP_NAME} before? Sign in to see all your trips on this device.</p>
              </>
            ) : guest ? (
              <>
                <h2 className={s.title}>Save your account</h2>
                <p className={s.body}>Right now your trips live only in this browser. Link an email or Google account to open them on any device — nothing else changes.</p>
              </>
            ) : (
              <>
                <h2 className={s.title}>Your account</h2>
                <p className={s.body}>Signed in as <span className={s.strong}>{user?.email}</span>. Your trips follow this account onto any device.</p>
                <Button full variant="ghost" onClick={doSignOut} disabled={busy} className={s.signOut}>{busy ? "…" : "Sign out"}</Button>
                <Button full variant="ghost" onClick={requestClose}>Close</Button>
                {error && <p className={s.error}>{error}</p>}
              </>
            )}

            {(signin || guest) && stage === "start" && (
              <>
                <Button full variant="tonal" onClick={google} disabled={busy} className={s.google}>
                  <GoogleMark size={16} /> Continue with Google
                </Button>
                <div className={s.divider}>
                  <span className={s.rule} />
                  <span className={s.or}>or with email</span>
                  <span className={s.rule} />
                </div>
                <Field>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" inputMode="email"
                    onKeyDown={(e) => e.key === "Enter" && sendCode()} />
                </Field>
                <Button full onClick={sendCode} disabled={busy} className={s.act}>{busy ? "Sending…" : "Email me a code"}</Button>
              </>
            )}

            {(signin || guest) && stage === "code" && (
              <>
                <p className={s.body}>We sent a 6-digit code to <span className={s.strong}>{email}</span>.</p>
                <Field>
                  <Input code value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" placeholder="123456"
                    onKeyDown={(e) => e.key === "Enter" && verifyCode()} />
                </Field>
                <Button full onClick={verifyCode} disabled={busy} className={s.act}>{busy ? "Checking…" : "Verify"}</Button>
                <button onClick={() => { setStage("start"); setCode(""); }} className={s.textBtn}>Use a different email</button>
              </>
            )}

            {(signin || guest) && stage === "done" && (
              <>
                <p className={s.done}><Icon name="check" size={15} strokeWidth={2} /> {signin ? "Signed in" : "Account saved"}</p>
                <Button full onClick={requestClose}>Done</Button>
              </>
            )}

            {(signin || guest) && stage !== "done" && (
              <>
                {error && <p className={s.error}>{error}</p>}
                <Button full variant="ghost" onClick={requestClose}>Not now</Button>
              </>
            )}
          </>
        );
      }}
    </Sheet>
  );
}
