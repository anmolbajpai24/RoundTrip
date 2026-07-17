import { useState } from "react";
import { COLORS } from "../lib/session.js";
import { saveProfile } from "../lib/profile.js";
import { APP_NAME } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import s from "./Onboarding.module.css";

export const ONBOARDED_KEY = "roundtrip:onboarded";
export const hasOnboarded = () => {
  try { return !!localStorage.getItem(ONBOARDED_KEY); } catch { return true; }
};

const SLIDES = [
  { icon: "route", title: "Plan trips together", accent: "together", text: "Build the itinerary with your travel crew — everyone's ideas, live on every phone, each clearly labelled." },
  { icon: "case", title: "Everything in one place", accent: "one place", text: "Days, budget, packing, outfits, bookings and documents. No more scattered notes and screenshots." },
  { icon: "arrow", title: "Works anywhere", accent: "anywhere", text: "Offline-ready and shareable with a 6-letter code. Start planning in seconds — no sign-up required." },
];

// First-run welcome: three value slides, then capture a display name + colour.
// Skippable; the wizard/join forms still ask for a name if it was skipped.
export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const nameStep = step === SLIDES.length;

  const finish = async (withProfile) => {
    setBusy(true);
    try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch { /* private mode */ }
    if (withProfile && name.trim()) {
      await saveProfile({ name: name.trim(), color }).catch(() => {});
    }
    onDone();
  };

  const slide = SLIDES[step];

  return (
    <div className={s.page}>
      <div className={s.top}>
        <span className={s.brand}>{APP_NAME}</span>
        {!nameStep && <button onClick={() => setStep(SLIDES.length)} className={s.skip}>Skip</button>}
      </div>

      <div className={s.center}>
        <div className={s.panel}>
          {!nameStep ? (
            <>
              <div className={s.mark}><Icon name={slide.icon} size={26} strokeWidth={1.6} /></div>
              <h1 className={s.title}>{slide.title}</h1>
              <p className={s.text}>{slide.text}</p>
            </>
          ) : (
            <>
              <h1 className={s.title}>What should we <em className={s.em}>call you?</em></h1>
              <p className={s.text}>Your name and colour label everything you add, on every trip.</p>
              <div className={s.nameForm}>
                <Field>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" autoFocus
                    onKeyDown={(e) => e.key === "Enter" && name.trim() && finish(true)} style={{ textAlign: "center" }} />
                </Field>
                <div className={s.swatches}>
                  <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={s.foot}>
        <div className={s.dots}>
          {[...SLIDES, {}].map((_, i) => (
            <span key={i} className={[s.dot, i === step && s.dotActive].filter(Boolean).join(" ")} />
          ))}
        </div>
        {!nameStep ? (
          <Button full onClick={() => setStep(step + 1)}>{step === SLIDES.length - 1 ? "Get started" : "Next"}</Button>
        ) : (
          <>
            <Button full onClick={() => finish(true)} disabled={busy || !name.trim()}>{busy ? "…" : "Let's go"}</Button>
            <Button full variant="ghost" onClick={() => finish(false)} disabled={busy} className={s.later}>I'll do this later</Button>
          </>
        )}
      </div>
    </div>
  );
}
