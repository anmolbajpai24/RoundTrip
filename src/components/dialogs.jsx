import { useEffect, useState } from "react";

// App-themed replacements for window.alert / window.confirm, driven by an
// imperative module API so any code (components, libs, catch blocks) can call
// them without context plumbing. <DialogHost/> is mounted once in main.jsx.
//
//   toast("Couldn't delete the trip.", { kind: "error" })
//   if (await confirmDialog({ title: "Delete outfit?", danger: true })) ...

let notify = null; // set by DialogHost when mounted

export function toast(message, { kind = "info", duration = 3500 } = {}) {
  if (!notify) return; // host not mounted (tests) — drop silently
  notify({ type: "toast", toast: { id: crypto.randomUUID(), message, kind, duration } });
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false } = {}) {
  if (!notify) return Promise.resolve(false);
  return new Promise((resolve) => {
    notify({ type: "confirm", confirm: { title, message, confirmLabel, cancelLabel, danger, resolve } });
  });
}

export default function DialogHost() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    notify = (evt) => {
      if (evt.type === "toast") {
        setToasts((t) => [...t, evt.toast]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== evt.toast.id)), evt.toast.duration);
      } else if (evt.type === "confirm") {
        setConfirm(evt.confirm);
      }
    };
    return () => { notify = null; };
  }, []);

  const settle = (ok) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };

  return (
    <>
      {/* Toast stack — above the bottom tab bar, safe-area aware */}
      {toasts.length > 0 && (
        <div className="fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
          style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}>
          {toasts.map((t) => (
            <div key={t.id} role="status" className="max-w-sm w-fit text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg border"
              style={{
                backgroundColor: "var(--card)", borderColor: "var(--border)",
                color: t.kind === "error" ? "#E4707E" : "var(--ink)",
              }}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Confirm sheet — same backdrop/card pattern as the app's other sheets */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => settle(false)}>
          <div className="w-full max-w-sm m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>{confirm.title}</h2>
            {confirm.message && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>{confirm.message}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => settle(false)} className="flex-1 text-sm font-semibold py-3 rounded-full border"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {confirm.cancelLabel}
              </button>
              <button onClick={() => settle(true)} autoFocus className="flex-1 text-sm font-bold py-3 rounded-full text-white"
                style={{ backgroundColor: confirm.danger ? "#C0392B" : "var(--solid)" }}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
