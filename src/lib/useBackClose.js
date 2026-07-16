import { useEffect, useRef } from "react";

// Hardware/browser Back support for the app's state-driven overlays.
//
// Each open sheet/modal registers itself here and pushes one history entry;
// pressing Back (or swiping back on iOS) closes the topmost overlay instead
// of exiting the PWA. Below the overlays, history entries carry { tab } so
// Back walks through visited tabs before finally leaving the app.
//
// Overlays that close without Back (a Done button, a save flow, a parent
// unmounting them) leave their history entry behind; the entry is marked
// stale and the next Back consumes it silently. That's a deliberate tradeoff
// — one occasionally "empty" Back press — to avoid fragile history.go()
// bookkeeping on unmount.

const stack = []; // open overlays, bottom → top; entries: { onClose, stale }

let onTabPop = null;
// App registers how to restore a tab when Back pops to a { tab } entry.
export function setTabPopHandler(fn) { onTabPop = fn; }

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    const top = stack.pop();
    if (top) {
      if (!top.stale) top.onClose?.();
      return;
    }
    if (e.state?.tab && onTabPop) onTabPop(e.state.tab);
  });
}

// useBackClose(onClose) → requestClose()
// Call requestClose from ✕ / backdrop / Done handlers so the overlay's
// history entry is consumed and Back stays in sync.
export default function useBackClose(onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const entryRef = useRef(null);

  useEffect(() => {
    const entry = { onClose: () => closeRef.current?.(), stale: false };
    entryRef.current = entry;
    stack.push(entry);
    window.history.pushState({ layer: true }, "");
    return () => {
      if (stack.includes(entry)) entry.stale = true;
    };
  }, []);

  return () => {
    const entry = entryRef.current;
    if (entry && stack.includes(entry) && !entry.stale) window.history.back();
    else closeRef.current?.();
  };
}
