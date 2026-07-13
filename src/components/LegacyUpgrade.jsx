import { useState } from "react";
import { migrateLegacyTrip } from "../lib/legacyMigration.js";
import BackupControls from "./BackupControls.jsx";
import { ACCENT, INK, MUTED } from "../theme.js";

// Shown when a session exists but the trip has no `trip-config` row yet.
// For the original pre-wizard trip that means "upgrade me"; for a freshly
// joined trip it can also mean the creator's config hasn't synced yet, so a
// plain retry is offered alongside the explicit upgrade.
export default function LegacyUpgrade({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upgrade = async () => {
    setBusy(true); setError("");
    try {
      await migrateLegacyTrip();
      onDone();
    } catch (e) {
      setError(e.message || "Upgrade failed — check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#F7F5F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-sm w-full">
        <div className="text-4xl mb-3 text-center">🧭</div>
        <h1 className="text-lg font-bold mb-2 text-center" style={{ color: INK }}>This trip needs a one-time upgrade</h1>
        <p className="text-sm leading-relaxed mb-4 text-center" style={{ color: MUTED }}>
          This trip was created before in-app trip setup existed (the original
          <span className="font-semibold" style={{ color: INK }}> London &amp; the Loop</span> itinerary).
          Upgrading moves it to the new format. <span className="font-semibold" style={{ color: INK }}>Nothing will be deleted</span> —
          all notes, outfit photos, packing, expenses and bookings stay exactly as they are.
        </p>
        <button onClick={upgrade} disabled={busy} className="w-full text-sm font-bold text-white py-3 rounded-full mb-3" style={{ backgroundColor: ACCENT }}>
          {busy ? "Upgrading…" : "Upgrade this trip"}
        </button>
        <button onClick={() => window.location.reload()} className="w-full text-sm font-semibold py-2.5 rounded-full mb-4" style={{ color: MUTED }}>
          Just joined this trip? Reload to wait for setup to sync
        </button>
        {error && <p className="text-xs mb-3 text-center" style={{ color: ACCENT }}>{error}</p>}
        <div className="rounded-2xl border p-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>Want a safety net first? Download a backup:</p>
          <BackupControls />
        </div>
      </div>
    </div>
  );
}
