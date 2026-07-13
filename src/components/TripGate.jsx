import { useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { COLORS, joinTrip } from "../lib/session.js";
import { getLocalProfile } from "../lib/profile.js";
import TripWizard from "./TripWizard.jsx";
import AccountSheet from "./AccountSheet.jsx";
import { APP_NAME, APP_TAGLINE, ACCENT, INK, MUTED } from "../theme.js";

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

  const wrap = { minHeight: "100vh", backgroundColor: "var(--bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center px-6" style={wrap}>
        <div className="max-w-sm text-center">
          <div className="text-4xl mb-3">🔌</div>
          <h1 className="text-lg font-bold mb-2" style={{ color: INK }}>Almost there</h1>
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            Cross-device sync needs a free Supabase project. Follow the steps in{" "}
            <span className="font-semibold" style={{ color: INK }}>supabase/SETUP.md</span>{" "}
            and add your keys to <span className="font-semibold" style={{ color: INK }}>.env.local</span>, then reload.
          </p>
        </div>
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
    <div className="flex items-center justify-center px-6 py-10" style={wrap}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">✈️</div>
          <h1 className="text-2xl font-bold" style={{ color: INK }}>
            {profile?.name ? `Hi ${profile.name} 👋` : APP_NAME}
          </h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>
            {profile?.name ? "Where to next?" : APP_TAGLINE}
          </p>
        </div>

        {askName && (
          <>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={24}
              className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: INK }}
            />
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Your colour</div>
            <div className="flex gap-2 mb-6">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: c, outline: color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }}
                  aria-label={c}
                >
                  {color === c && <span className="text-white text-sm font-bold">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={() => { setError(""); setWizard(true); }} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full mb-4" style={{ backgroundColor: ACCENT }}>
          Plan a new trip
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--faint)" }}>or join with a code</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
            placeholder="Enter code"
            maxLength={6}
            className="flex-1 text-sm rounded-full border px-4 py-2.5 tracking-[0.2em]"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: INK, fontFamily: "ui-monospace, monospace" }}
          />
          <button onClick={doJoin} disabled={busy} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "var(--solid)" }}>
            {busy ? "…" : "Join"}
          </button>
        </div>

        <button onClick={() => setSignin(true)} className="w-full text-xs font-semibold mt-6" style={{ color: MUTED }}>
          Used {APP_NAME} before? <span style={{ color: ACCENT }}>Sign in</span>
        </button>

        {error && <p className="text-xs mt-3 text-center" style={{ color: ACCENT }}>{error}</p>}

        {signin && (
          <AccountSheet
            user={null}
            mode="signin"
            onClose={() => setSignin(false)}
            onChanged={onReady}
          />
        )}
      </div>
    </div>
  );
}
