import { useEffect, useRef } from "react";
import useBackClose from "../../lib/useBackClose.js";
import s from "./Sheet.module.css";

// The app's one bottom-sheet/modal shell (raised surface, hairline border,
// sheet radius, safe-area padding; centered card on ≥sm viewports).
//
// Owns the overlay's useBackClose registration — call sites must NOT call the
// hook themselves as well, or hardware Back needs two presses. Children may be
// a function to receive requestClose for their own Done/✕/backdrop handlers:
//   <Sheet onClose={close} label="Your account">
//     {(requestClose) => <>… <Button onClick={requestClose}>Done</Button></>}
//   </Sheet>
export default function Sheet({ onClose, label, children }) {
  const requestClose = useBackClose(onClose);
  const closeRef = useRef(requestClose);
  useEffect(() => { closeRef.current = requestClose; });

  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className={s.backdrop} onClick={() => closeRef.current()}>
      <div role="dialog" aria-modal="true" aria-label={label} className={s.shell} onClick={(e) => e.stopPropagation()}>
        {typeof children === "function" ? children(requestClose) : children}
      </div>
    </div>
  );
}
