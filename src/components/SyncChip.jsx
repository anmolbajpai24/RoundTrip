import { useEffect, useState } from "react";
import { subscribeSyncStatus, flushOutbox } from "../lib/storage.js";
import s from "./SyncChip.module.css";

// Header sync state: a 6px status dot + tracked-caps label, always visible in
// a trip — SYNCED (green, quiet), N PENDING (amber, queued writes), OFFLINE /
// retry (failed flush). Tapping always kicks a flush.
export default function SyncChip() {
  const [status, setStatus] = useState({ pending: 0, error: null });
  useEffect(() => subscribeSyncStatus(setStatus), []);

  const failed = !!status.error;
  const pending = status.pending > 0;
  const label = failed ? "Retry sync" : pending ? `${status.pending} pending` : "Synced";
  const tone = failed ? s.failed : pending ? s.pending : s.synced;

  return (
    <button
      onClick={() => flushOutbox()}
      title={failed ? `${status.error} — tap to retry`
        : pending ? "Changes saved on this phone, waiting for a connection"
        : "Everything is synced"}
      className={[s.chip, tone].join(" ")}
    >
      <span className={s.dot} />
      {label}
    </button>
  );
}
