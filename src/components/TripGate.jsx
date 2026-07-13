import { useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { COLORS, joinTrip } from "../lib/session.js";
import TripWizard from "./TripWizard.jsx";
import AccountSheet from "./AccountSheet.jsx";
import { APP_NAME, APP_TAGLINE, ACCENT, INK, MUTED } from "../theme.js";

// First-run onboarding: choose your name + colour, then start a trip (opens
// the wizard) or join one with a code. Returning users can sign in instead.
// On success it calls onReady().
export default function TripGate({ onReady }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wizard, setWizard] = useState(false);
  const [signin, setSignin] = useState(false);

  const wrap = { minHeight: "100vh", backgroundColor: "#F7F5F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

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

  const canSubmit = name.trim().length > 0;

  const doCreate = () => {
    if (!canSubmit) { setError("Enter your name first."); return; }
    setError("");
    setWizard(true);
  };

  const doJoin = async () => {
    if (!canSubmit) { setError("Enter your name first."); return; }
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
          <h1 className="text-2xl font-bold" style={{ color: INK }}>{APP_NAME}</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>{APP_TAGLINE}</p>
        </div>

        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={24}
          className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-3"
          style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: INK }}
        />

        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Your colour</div>
        <div className="flex gap-2 mb-6">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c, outline: color === c ? "3px solid #1D2433" : "none", outlineOffset: 2 }}
              aria-label={c}
            >
              {color === c && <span className="text-white text-sm font-bold">✓</span>}
            </button>
          ))}
        </div>

        <button onClick={doCreate} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full mb-4" style={{ backgroundColor: ACCENT }}>
          Plan a new trip
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "#E5E2DA" }} />
          <span className="text-[11px] font-semibold" style={{ color: "#B8B5AD" }}>or join with a code</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#E5E2DA" }} />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
            placeholder="Enter code"
            maxLength={6}
            className="flex-1 text-sm rounded-full border px-4 py-2.5 tracking-[0.2em]"
            style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: INK, fontFamily: "ui-monospace, monospace" }}
          />
          <button onClick={doJoin} disabled={busy} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: INK }}>
            Join
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
