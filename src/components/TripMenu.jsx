import { useState } from "react";
import { duplicateTrip } from "../lib/session.js";
import { addDays, todayISO, weekday, dateLabel } from "../lib/tripConfig.js";
import Sheet from "./ui/Sheet.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input } from "./ui/Field.jsx";
import Spinner from "./Spinner.jsx";
import s from "./TripMenu.module.css";

// The first date after today on the same weekday the trip started on, so a
// Friday-night weekend trip is offered again for next Friday.
function nextSameWeekday(startISO) {
  const today = todayISO();
  let d = addDays(today, 1);
  if (!startISO) return d;
  const want = weekday(startISO);
  for (let i = 0; i < 7 && weekday(d) !== want; i++) d = addDays(d, 1);
  return d;
}

// The "…" menu on a trip in the trips list. Organisers can run a trip again
// with a new start date (a new trip and code, copied plan, nobody else on it);
// everyone can leave or delete it. onCreated() runs once duplicateTrip() has
// switched the session to the new trip, like finishing the wizard.
export default function TripMenu({ trip, onClose, onRemove, onCreated }) {
  const cfg = trip.config;
  const title = cfg?.title || `Trip ${trip.code}`;
  const canRunAgain = trip.role === "organiser" && !!cfg;
  const solo = (trip.members?.length || 1) <= 1;
  const [start, setStart] = useState(() => nextSameWeekday(cfg?.startDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runAgain = async () => {
    setError("");
    if (!start || start < todayISO()) { setError("Pick today or a later date."); return; }
    setBusy(true);
    try { await duplicateTrip(trip.id, start); onCreated(); }
    catch (e) { setError(e.message || "Couldn't copy the trip. Please try again."); setBusy(false); }
  };

  const days = cfg?.days?.length || 0;
  const end = start && days ? addDays(start, days - 1) : null;

  return (
    <Sheet onClose={onClose} label={title}>
      {(requestClose) => (
        <>
          <h2 className={s.title}>{title}</h2>

          {canRunAgain && (
            <div className={s.section}>
              <div className={s.label}>Run again</div>
              <Field label="New first day">
                <Input type="date" value={start} min={todayISO()} onChange={(e) => setStart(e.target.value)} />
              </Field>
              {end && (
                <p className={s.dates}>{weekday(start)} {dateLabel(start)} to {weekday(end)} {dateLabel(end)} · {days} {days === 1 ? "day" : "days"}</p>
              )}
              <p className={s.hint}>
                Copies the plan, shared day notes, packing list and bookings checklist to the new dates, with a new code.
                Members, expenses and documents stay with this trip.
              </p>
              {error && <p className={s.error}>{error}</p>}
              <Button full onClick={runAgain} disabled={busy}>
                {busy && <Spinner size={16} on="accent" />}
                {busy ? "Copying…" : "Create the new trip"}
              </Button>
            </div>
          )}

          <button
            onClick={() => { requestClose(); onRemove(trip); }}
            disabled={busy}
            className={s.danger}>
            {solo ? "Delete this trip" : "Leave this trip"}
          </button>
        </>
      )}
    </Sheet>
  );
}
