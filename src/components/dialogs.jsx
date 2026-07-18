import { useEffect, useState } from "react";
import Icon from "./ui/icons.jsx";
import s from "./dialogs.module.css";

// App-themed replacements for window.alert / window.confirm, driven by an
// imperative module API so any code (components, libs, catch blocks) can call
// them without context plumbing. <DialogHost/> is mounted once in main.jsx.
//
//   toast("Couldn't delete the trip.", { kind: "error" })
//   if (await confirmDialog({ title: "Delete outfit?", danger: true })) ...
//   confirmDialog({ ..., typeToConfirm: code })  — the danger button stays
//   inert until the typed text matches (destructive gates like trip delete).

let notify = null; // set by DialogHost when mounted

export function toast(message, { kind = "info", duration = 3500 } = {}) {
  if (!notify) return; // host not mounted (tests) — drop silently
  notify({ type: "toast", toast: { id: crypto.randomUUID(), message, kind, duration } });
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, typeToConfirm = null } = {}) {
  if (!notify) return Promise.resolve(false);
  return new Promise((resolve) => {
    notify({ type: "confirm", confirm: { title, message, confirmLabel, cancelLabel, danger, typeToConfirm, resolve } });
  });
}

export default function DialogHost() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    notify = (evt) => {
      if (evt.type === "toast") {
        setToasts((t) => [...t, evt.toast]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== evt.toast.id)), evt.toast.duration);
      } else if (evt.type === "confirm") {
        setTyped("");
        setConfirm(evt.confirm);
      }
    };
    return () => { notify = null; };
  }, []);

  const settle = (ok) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };

  const gate = confirm?.typeToConfirm ? typed.trim().toUpperCase() !== String(confirm.typeToConfirm).toUpperCase() : false;

  return (
    <>
      {/* Toast stack — above the bottom tab bar, safe-area aware */}
      {toasts.length > 0 && (
        <div className={s.toasts}>
          {toasts.map((t) => (
            <div key={t.id} role="status" className={[s.toast, t.kind === "error" && s.toastError].filter(Boolean).join(" ")}>
              <span className={[s.toastDisc, t.kind === "error" ? s.toastDiscError : s.toastDiscOk].join(" ")}>
                <Icon name={t.kind === "error" ? "x" : "check"} size={9} strokeWidth={2.6} />
              </span>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Confirm sheet — same shell language as the app's other sheets */}
      {confirm && (
        <div className={s.backdrop} onClick={() => settle(false)}>
          <div role="dialog" aria-modal="true" className={s.shell} onClick={(e) => e.stopPropagation()}>
            <div className={s.grabber} aria-hidden="true" />
            <h2 className={s.title}>{confirm.title}</h2>
            {confirm.message && <p className={s.message}>{confirm.message}</p>}
            {confirm.typeToConfirm && (
              <>
                <div className={s.gateLabel}>Type the trip code to confirm</div>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={String(confirm.typeToConfirm)}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={s.gateInput}
                />
              </>
            )}
            <div className={s.actions}>
              <button onClick={() => settle(false)} className={s.cancel}>{confirm.cancelLabel}</button>
              <button onClick={() => settle(true)} disabled={gate} autoFocus={!confirm.typeToConfirm}
                className={[s.confirm, confirm.danger && s.danger].filter(Boolean).join(" ")}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
