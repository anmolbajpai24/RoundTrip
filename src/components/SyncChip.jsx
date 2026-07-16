import { useEffect, useState } from "react";
import { subscribeSyncStatus, flushOutbox } from "../lib/storage.js";

// Small header chip showing offline-outbox state: hidden when everything is
// synced, "n to sync" while writes are queued, and a tap-to-retry error state
// when a flush failed. Tapping always kicks a flush.
export default function SyncChip() {
  const [status, setStatus] = useState({ pending: 0, error: null });
  useEffect(() => subscribeSyncStatus(setStatus), []);

  if (!status.error && status.pending === 0) return null;
  const failed = !!status.error;
  return (
    <div className="mt-1.5 flex justify-end">
      <button
        onClick={() => flushOutbox()}
        title={failed ? `${status.error} — tap to retry` : "Changes saved on this phone, waiting for a connection"}
        className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
        style={failed
          ? { borderColor: "var(--danger-soft)", backgroundColor: "var(--danger-soft)", color: "#E4707E" }
          : { borderColor: "var(--warn-border)", backgroundColor: "var(--warn-bg)", color: "var(--warn-ink)" }}
      >
        {failed ? "⚠ Sync issue — tap to retry" : `↺ ${status.pending} to sync`}
      </button>
    </div>
  );
}
