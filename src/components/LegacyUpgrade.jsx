import { useState } from "react";
import { migrateLegacyTrip } from "../lib/legacyMigration.js";
import BackupControls from "./BackupControls.jsx";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import s from "./LegacyUpgrade.module.css";

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
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.mark}><Icon name="route" size={24} /></div>
        <h1 className={s.title}>This trip needs a one-time upgrade</h1>
        <p className={s.body}>
          This trip was created before in-app trip setup existed (the original
          <span className={s.strong}> London &amp; the Loop</span> itinerary).
          Upgrading moves it to the new format. <span className={s.strong}>Nothing will be deleted</span> —
          all notes, outfit photos, packing, expenses and bookings stay exactly as they are.
        </p>
        <Button full onClick={upgrade} disabled={busy} className={s.upgrade}>
          {busy ? "Upgrading…" : "Upgrade this trip"}
        </Button>
        <Button full variant="ghost" onClick={() => window.location.reload()} className={s.reload}>
          Just joined this trip? Reload to wait for setup to sync
        </Button>
        {error && <p className={s.error}>{error}</p>}
        <div className={s.backup}>
          <p className={s.backupHint}>Want a safety net first? Download a backup:</p>
          <BackupControls />
        </div>
      </div>
    </div>
  );
}
