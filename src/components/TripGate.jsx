import { useState } from "react";
import { isConfigured } from "../lib/supabase.js";
import { COLORS, createTrip, joinTrip } from "../lib/session.js";
import { hasLegacyData, migrateLegacyData } from "../lib/storage.js";

// One-time onboarding: choose your name + colour, then create a trip (get a
// code to share) or join with a code. On success it calls onReady().
export default function TripGate({ onReady }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const [migrated, setMigrated] = useState(false);

  const wrap = { minHeight: "100vh", backgroundColor: "#F7F5F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center px-6" style={wrap}>
        <div className="max-w-sm text-center">
          <div className="text-4xl mb-3">🔌</div>
          <h1 className="text-lg font-bold mb-2" style={{ color: "#1D2433" }}>Almost there</h1>
          <p className="text-sm leading-relaxed" style={{ color: "#8A8F98" }}>
            Cross-device sync needs a free Supabase project. Follow the steps in{" "}
            <span className="font-semibold" style={{ color: "#1D2433" }}>supabase/SETUP.md</span>{" "}
            and add your keys to <span className="font-semibold" style={{ color: "#1D2433" }}>.env.local</span>, then reload.
          </p>
        </div>
      </div>
    );
  }

  const canSubmit = name.trim().length > 0;

  const doCreate = async () => {
    if (!canSubmit) { setError("Enter your name first."); return; }
    setBusy(true); setError("");
    try {
      const s = await createTrip(name.trim(), color);
      setCreated(s.code);
      setLegacy(await hasLegacyData());
    } catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
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

  const doMigrate = async () => {
    setBusy(true);
    try { await migrateLegacyData(); setMigrated(true); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const share = async () => {
    const text = `Join our UK trip on London & the Loop — code: ${created}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(created);
    } catch { /* cancelled */ }
  };

  // --- Trip created: show the code to share ---
  if (created) {
    return (
      <div className="flex items-center justify-center px-6" style={wrap}>
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-lg font-bold mb-1" style={{ color: "#1D2433" }}>Trip created</h1>
          <p className="text-sm mb-5" style={{ color: "#8A8F98" }}>
            Share this code so others can join. Everyone sees the whole trip, with each person's additions clearly labelled.
          </p>
          <div className="rounded-2xl border px-6 py-5 mb-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8A8F98" }}>Trip code</div>
            <div className="text-3xl font-bold tracking-[0.3em]" style={{ color: "#1D2433", fontFamily: "ui-monospace, monospace" }}>{created}</div>
          </div>
          <button onClick={share} className="text-sm font-semibold mb-5" style={{ color: "#C8102E" }}>Share / copy code</button>

          {legacy && !migrated && (
            <div className="rounded-2xl border p-4 mb-4 text-left" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#1D2433" }}>Bring your existing data?</div>
              <p className="text-xs mb-3" style={{ color: "#8A8F98" }}>
                This device has notes, packing and expenses from before sync. Import them into this trip.
              </p>
              <button onClick={doMigrate} disabled={busy} className="w-full text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: "#1D2433" }}>
                {busy ? "Importing…" : "Import my existing data"}
              </button>
            </div>
          )}
          {migrated && <p className="text-xs mb-4" style={{ color: "#2E7D4F" }}>✓ Existing data imported</p>}

          <button onClick={onReady} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: "#C8102E" }}>
            Open the app
          </button>
          {error && <p className="text-xs mt-3" style={{ color: "#C8102E" }}>{error}</p>}
        </div>
      </div>
    );
  }

  // --- Choose profile + create/join ---
  return (
    <div className="flex items-center justify-center px-6 py-10" style={wrap}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#C8102E" }}>UK · Aug 2026</div>
          <h1 className="text-2xl font-bold mt-1" style={{ color: "#1D2433" }}>London &amp; the Loop</h1>
          <p className="text-sm mt-2" style={{ color: "#8A8F98" }}>Set up your profile so everyone stays in sync.</p>
        </div>

        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Anmol"
          maxLength={24}
          className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-3"
          style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: "#1D2433" }}
        />

        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#8A8F98" }}>Your colour</div>
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

        <button onClick={doCreate} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full mb-4" style={{ backgroundColor: "#C8102E" }}>
          {busy ? "Working…" : "Start a new trip"}
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
            style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF", color: "#1D2433", fontFamily: "ui-monospace, monospace" }}
          />
          <button onClick={doJoin} disabled={busy} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "#1D2433" }}>
            Join
          </button>
        </div>

        {error && <p className="text-xs mt-3 text-center" style={{ color: "#C8102E" }}>{error}</p>}
      </div>
    </div>
  );
}
