import { useState } from "react";
import { isGuest, linkEmailStart, linkEmailVerify, linkGoogle, signInEmailStart, signInEmailVerify, signInGoogle, signOut } from "../lib/auth.js";
import { APP_NAME, ACCENT, INK, MUTED } from "../theme.js";

const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--field)", color: INK };

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
      const msg = e.message || "Something went wrong.";
      if (/manual linking/i.test(msg)) {
        console.warn('Roundtrip setup: enable "Allow manual linking" in Supabase → Authentication → Settings so guests can link Google/email to their existing anonymous user.');
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
  const doSignOut = () => run(async () => { await signOut(); onChanged?.(); onClose(); });

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm m-4 rounded-2xl p-5" style={{ backgroundColor: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        {signin ? (
          <>
            <h2 className="text-base font-bold mb-1" style={{ color: INK }}>Sign in</h2>
            <p className="text-xs mb-4" style={{ color: MUTED }}>Used {APP_NAME} before? Sign in to see all your trips on this device.</p>
          </>
        ) : guest ? (
          <>
            <h2 className="text-base font-bold mb-1" style={{ color: INK }}>Save your account</h2>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              Right now your trips live only in this browser. Link an email or Google account to open them on any device — nothing else changes.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold mb-1" style={{ color: INK }}>Your account</h2>
            <p className="text-xs mb-4" style={{ color: MUTED }}>
              Signed in as <span className="font-semibold" style={{ color: INK }}>{user?.email}</span>. Your trips follow this account onto any device.
            </p>
            <button onClick={doSignOut} disabled={busy} className="w-full text-sm font-bold py-2.5 rounded-full border mb-2" style={{ borderColor: "var(--border)", color: ACCENT }}>
              {busy ? "…" : "Sign out"}
            </button>
            <button onClick={onClose} className="w-full text-sm font-semibold py-2 rounded-full" style={{ color: MUTED }}>Close</button>
            {error && <p className="text-xs mt-2 text-center" style={{ color: ACCENT }}>{error}</p>}
          </>
        )}

        {(signin || guest) && stage === "start" && (
          <>
            <button onClick={google} disabled={busy} className="w-full text-sm font-bold py-3 rounded-full border mb-3 flex items-center justify-center gap-2" style={{ borderColor: "var(--border)", color: INK }}>
              <GoogleG /> Continue with Google
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--faint)" }}>or with email</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" inputMode="email"
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              className="w-full text-sm rounded-xl border px-4 py-3 mb-2" style={inputStyle} />
            <button onClick={sendCode} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </>
        )}

        {(signin || guest) && stage === "code" && (
          <>
            <p className="text-xs mb-2" style={{ color: MUTED }}>We sent a 6-digit code to <span className="font-semibold" style={{ color: INK }}>{email}</span>.</p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" placeholder="123456"
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              className="w-full text-sm rounded-xl border px-4 py-3 mb-2 tracking-[0.4em] text-center" style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
            <button onClick={verifyCode} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
              {busy ? "Checking…" : "Verify"}
            </button>
            <button onClick={() => { setStage("start"); setCode(""); }} className="w-full text-xs font-semibold py-2 mt-1" style={{ color: MUTED }}>Use a different email</button>
          </>
        )}

        {(signin || guest) && stage === "done" && (
          <>
            <p className="text-sm font-semibold mb-3 text-center" style={{ color: "#2E7D4F" }}>✓ {signin ? "Signed in" : "Account saved"}</p>
            <button onClick={onClose} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>Done</button>
          </>
        )}

        {(signin || guest) && stage !== "done" && (
          <>
            {error && <p className="text-xs mt-2 text-center" style={{ color: ACCENT }}>{error}</p>}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2 mt-2 rounded-full" style={{ color: MUTED }}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
