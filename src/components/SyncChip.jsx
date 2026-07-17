import { useEffect, useState } from "react";
import { subscribeSyncStatus, flushOutbox } from "../lib/storage.js";
import Icon from "./ui/icons.jsx";
import s from "./SyncChip.module.css";

// Small header chip showing offline-outbox state: hidden when everything is
// synced, "n to sync" while writes are queued, and a tap-to-retry error state
// when a flush failed. Tapping always kicks a flush.
export default function SyncChip() {
  const [status, setStatus] = useState({ pending: 0, error: null });
  useEffect(() => subscribeSyncStatus(setStatus), []);

  if (!status.error && status.pending === 0) return null;
  const failed = !!status.error;
  return (
    <div className={s.wrap}>
      <button
        onClick={() => flushOutbox()}
        title={failed ? `${status.error} — tap to retry` : "Changes saved on this phone, waiting for a connection"}
        className={[s.chip, failed ? s.failed : s.pending].filter(Boolean).join(" ")}
      >
        <Icon name={failed ? "cloudoff" : "reload"} size={12} strokeWidth={1.8} />
        {failed ? "Sync issue — tap to retry" : `${status.pending} to sync`}
      </button>
    </div>
  );
}
