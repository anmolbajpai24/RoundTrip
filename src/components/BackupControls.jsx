import { useRef, useState } from "react";
import { exportAll, importAll } from "../lib/storage.js";
import { APP_SLUG } from "../theme.js";
import Icon from "./ui/icons.jsx";
import s from "./BackupControls.module.css";

// Trip data syncs across devices via Supabase; this is an extra manual safety
// net — download the current trip's data as JSON, or restore it from a file.
export default function BackupControls() {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("");

  const doExport = async () => {
    const backup = await exportAll();
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${APP_SLUG}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      await importAll(backup);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setStatus("Import failed — not a valid backup file");
      setTimeout(() => setStatus(""), 4000);
    }
    e.target.value = "";
  };

  return (
    <div>
      <div className={s.card}>
        <button onClick={doExport} className={s.rowBtn}>
          <Icon name="export" size={13} strokeWidth={1.7} /> Export trip backup
        </button>
        <button onClick={() => fileRef.current?.click()} className={s.rowBtn}>
          <Icon name="restore" size={13} strokeWidth={1.7} /> Restore from backup
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className={s.hiddenFile} onChange={doImport} />
      {status && <span className={s.status}>{status}</span>}
    </div>
  );
}
