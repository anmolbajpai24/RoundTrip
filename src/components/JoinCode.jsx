import { useState } from "react";
import { joinTrip, COLORS } from "../lib/session.js";
import Spinner from "./Spinner.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, FormStack } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import CodeInput from "./ui/CodeInput.jsx";
import s from "./JoinCode.module.css";

// Join-with-a-code: six serif cells + (only when we don't know who you are
// yet) name & colour. Joins as soon as the sixth character lands and the
// identity is known.
export default function JoinCode({ defaultProfile, onJoined, autoFocus = false }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultProfile?.name || "");
  const [color, setColor] = useState(defaultProfile?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const askIdentity = !defaultProfile?.name;

  const join = async (c = code) => {
    if (busy) return;
    if (!name.trim()) { setError("Enter your name first."); return; }
    if (c.length < 6) { setError("Enter the six-character code."); return; }
    setBusy(true); setError("");
    try { await joinTrip(c, name.trim(), color); onJoined(); }
    catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
  };

  return (
    <div>
      <CodeInput value={code} onChange={setCode} onComplete={(c) => { if (!askIdentity) join(c); }} autoFocus={autoFocus} />
      {busy ? (
        <p className={s.checking}><Spinner size={13} /> Checking the code…</p>
      ) : (
        <p className={s.hint}>Codes are 6 letters — ask anyone already on the trip.</p>
      )}
      {askIdentity && (
        <div className={s.identity}>
          <FormStack>
            <Field label="Your name on this trip">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" maxLength={24} />
            </Field>
            <Field label="Colour">
              <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
            </Field>
          </FormStack>
          <Button full onClick={() => join()} disabled={busy} className={s.joinBtn}>{busy ? "Joining…" : "Join"}</Button>
        </div>
      )}
      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}
