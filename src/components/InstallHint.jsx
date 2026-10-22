import { useEffect, useState } from "react";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import s from "./InstallHint.module.css";

// "Add to Home Screen" nudge. Only from the second visit: on the first one
// people are busy joining a trip and a banner just gets in the way. A visit
// is one browser session (reloads don't count). Never shown once installed,
// on desktop, or after it's been dismissed.

const VISITS_KEY = "roundtrip:visits";
const DISMISSED_KEY = "roundtrip:install-hint-dismissed";
const SESSION_FLAG = "roundtrip:visit-counted";

// Returns the visit count including this one. Storage can throw (private
// mode, blocked site data): then we simply never show the hint.
export function countVisit() {
  try {
    let n = Number(localStorage.getItem(VISITS_KEY)) || 0;
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      n += 1;
      localStorage.setItem(VISITS_KEY, String(n));
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
    return n;
  } catch {
    return 0;
  }
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

const platform = () => {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
};

const wasDismissed = () => {
  try { return !!localStorage.getItem(DISMISSED_KEY); } catch { return true; }
};

export default function InstallHint() {
  const [show, setShow] = useState(false);
  const [installEvent, setInstallEvent] = useState(null); // Android's deferred install prompt
  const os = typeof navigator !== "undefined" ? platform() : null;

  useEffect(() => {
    const visits = countVisit();
    if (!os || isStandalone() || wasDismissed() || visits < 2) return;
    // Let the app paint first so the hint doesn't fight the first screen.
    const t = setTimeout(() => setShow(true), 2500);
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [os]);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* private mode */ }
  };

  const install = async () => {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice.catch(() => ({}));
    setInstallEvent(null);
    if (outcome === "accepted") dismiss();
  };

  if (!show) return null;

  return (
    <div className={s.hint} role="dialog" aria-label="Add Roundtrip to your home screen">
      <span className={s.icon}><Icon name="share" size={18} /></span>
      <div className={s.text}>
        <p className={s.title}>Keep the trip one tap away</p>
        <p className={s.body}>
          {os === "ios"
            ? <>Tap <b>Share</b>, then <b>Add to Home Screen</b>. It works offline too.</>
            : installEvent
              ? "Add Roundtrip to your home screen. It works offline too."
              : <>Open the browser menu <b>⋮</b>, then <b>Add to Home screen</b>. It works offline too.</>}
        </p>
        {installEvent && <Button size="sm" onClick={install} className={s.install}>Add to home screen</Button>}
      </div>
      <button type="button" className={s.close} onClick={dismiss} aria-label="Dismiss">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
