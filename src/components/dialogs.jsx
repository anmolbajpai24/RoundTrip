import { useEffect, useState } from "react";
import s from "./dialogs.module.css";

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
        <div className={s.toasts}>
          {toasts.map((t) => (
            <div key={t.id} role="status" className={[s.toast, t.kind === "error" && s.toastError].filter(Boolean).join(" ")}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Confirm sheet — same shell language as the app's other sheets */}
      {confirm && (
        <div className={s.backdrop} onClick={() => settle(false)}>
          <div role="dialog" aria-modal="true" className={s.shell} onClick={(e) => e.stopPropagation()}>
            <h2 className={s.title}>{confirm.title}</h2>
            {confirm.message && <p className={s.message}>{confirm.message}</p>}
            <div className={s.actions}>
              <button onClick={() => settle(false)} className={s.cancel}>{confirm.cancelLabel}</button>
              <button onClick={() => settle(true)} autoFocus className={[s.confirm, confirm.danger && s.danger].filter(Boolean).join(" ")}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
