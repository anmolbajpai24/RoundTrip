import { useRef, useState } from "react";
import { exportAll, importAll } from "../lib/storage.js";
import { APP_SLUG } from "../theme.js";

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
    <div className="flex items-center gap-3 mt-2">
      <button onClick={doExport} className="text-[11px] font-semibold" style={{ color: "#8A8F98" }}>
        ↓ Backup data
      </button>
      <button onClick={() => fileRef.current?.click()} className="text-[11px] font-semibold" style={{ color: "#8A8F98" }}>
        ↑ Restore
      </button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} />
      {status && <span className="text-[11px]" style={{ color: "#C8102E" }}>{status}</span>}
    </div>
  );
}
