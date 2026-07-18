import { useState, Fragment } from "react";
import { COLORS } from "../lib/session.js";
import { saveProfile } from "../lib/profile.js";
import { onColor, DEST_COLORS } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import { Input } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import s from "./Onboarding.module.css";

export const ONBOARDED_KEY = "roundtrip:onboarded";
export const hasOnboarded = () => {
  try { return !!localStorage.getItem(ONBOARDED_KEY); } catch { return true; }
};

const SLIDES = [
  { title: "Plan trips together", text: "Ideas land on everyone's phone as they're typed — labelled with who said what." },
  { title: "Everything in one place", text: "Days, budget, packing, outfits, bookings, documents. One trip, one home — nothing lives in a group-chat scrollback." },
  { title: "Works anywhere", text: "Offline on the metro, instant on wifi. Share with a 6-letter code — no app store, no sign-up." },
];

// Slide 1: member note-cards, each labelled with who said what.
function ArtNotes() {
  const notes = [
    { who: "Priya", color: COLORS[1], text: "Flamenco on the Friday?", style: { left: 6, top: 24, transform: "rotate(-3deg)" } },
    { who: "Dev", color: COLORS[2], text: "Train, not flight.", style: { right: 2, top: 96, width: 172, transform: "rotate(2deg)" } },
    { who: "Sara", color: COLORS[3], text: "The riad with the pool.", style: { left: 30, top: 186, width: 206, transform: "rotate(-1deg)" } },
  ];
  return (
    <div className={s.art}>
      {notes.map((n) => (
        <div key={n.who} className={s.noteCard} style={{ ...n.style, "--c": n.color }}>
          <span className={s.noteWho}><span className={s.noteDot} />{n.who}</span>
          <span className={s.noteText}>{n.text}</span>
        </div>
      ))}
      <svg viewBox="0 0 342 300" className={s.artSvg} aria-hidden="true">
        <path className={s.conn} d="M196 52 Q250 70 252 100" />
        <path className={s.conn} d="M170 148 Q120 168 118 190" />
      </svg>
    </div>
  );
}

// Slide 2: the route spine threading the app's six features.
function ArtSpine() {
  const rows = [
    ["Days", "colour-coded by city"],
    ["Budget", "split fairly, any currency"],
    ["Packing", "per person, checked off"],
    ["Outfits", "photographed, day by day"],
    ["Bookings", "chased until they're done"],
    ["Documents", "confirmations, one wallet"],
  ];
  return (
    <div className={[s.art, s.spineArt].join(" ")}>
      <div className={s.spineLine} />
      <div className={s.featureList}>
        {rows.map(([k, v]) => (
          <div key={k} className={s.featureRow}>
            <span className={s.featureDot} />
            <span className={s.featureKey}>{k}</span>
            <span className={s.featureVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Slide 3: the route carrying on through a no-signal zone, plus the code.
function ArtOffline() {
  return (
    <div className={s.art}>
      <div className={s.offlineBlock} />
      <span className={s.noSignal}><Icon name="offline" size={12} strokeWidth={1.8} /> No signal</span>
      <svg viewBox="0 0 342 300" className={s.artSvg} aria-hidden="true">
        <circle cx="30" cy="112" r="7" fill={DEST_COLORS[0]} />
        <path className={s.routeSolid} d="M37 112 H 130" />
        <path className={s.routeDashed} d="M130 112 H 240" />
        <path className={s.routeSolid} d="M240 112 H 305" />
        <circle cx="312" cy="112" r="7" fill={DEST_COLORS[2]} />
      </svg>
      <div className={s.codeChip}>
        <span className={s.codeChipCode}>MOSAIC</span>
        <span className={s.codeChipText}>the whole trip, in six letters</span>
      </div>
    </div>
  );
}

// First-run welcome: three value slides, then capture a display name + colour.
// Skippable; the wizard/join forms still ask for a name if it was skipped.
export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const total = SLIDES.length + 1; // the name step is the 4th stop
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
        {nameStep ? (
          <button onClick={() => setStep(step - 1)} aria-label="Back" className={s.back}>
            <Icon name="back" size={18} strokeWidth={1.8} />
          </button>
        ) : (
          <span className={s.brandIcon}><Icon name="route" size={20} strokeWidth={1.6} /></span>
        )}
        <span className={s.topSpacer} />
        {!nameStep && <button onClick={() => setStep(SLIDES.length)} className={s.skip}>Skip</button>}
      </div>

      {!nameStep ? (
        <>
          {step === 0 ? <ArtNotes /> : step === 1 ? <ArtSpine /> : <ArtOffline />}
          <h1 className={s.title}>{slide.title}</h1>
          <p className={s.text}>{slide.text}</p>
        </>
      ) : (
        <>
          <h1 className={s.titleName}>What should we call you?</h1>
          <p className={s.text}>Your name and colour mark your notes, packing rows and expenses on every trip.</p>
          <div className={s.nameLabelRow}>
            <span className={s.label}>Your name</span>
            <span className={s.counter}>{name.length} / 24</span>
          </div>
          <div className={s.nameRow}>
            <span className={s.nameAvatar} style={{ "--c": color, "--on": onColor(color) }} aria-hidden="true">
              {(name.trim()[0] || "?").toUpperCase()}
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" autoFocus
              onKeyDown={(e) => e.key === "Enter" && name.trim() && finish(true)} />
          </div>
          <span className={s.colourLabel}>Your colour</span>
          <div className={s.swatches}>
            <SwatchPicker size="lg" colors={COLORS} value={color} onChange={setColor} />
          </div>
        </>
      )}

      <span className={s.spacer} />

      {/* progress = a 4-stop route spine; the name step is the 4th */}
      <div className={s.progress} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={i <= step ? s.pSegDone : s.pSeg} />}
            <span className={i === step ? s.pNodeActive : i < step ? s.pNodeDone : s.pNode} />
          </Fragment>
        ))}
      </div>

      <div className={s.foot}>
        {!nameStep ? (
          <Button full onClick={() => setStep(step + 1)}>Continue <Icon name="arrow" size={13} strokeWidth={2} /></Button>
        ) : (
          <>
            <Button full onClick={() => finish(true)} disabled={busy || !name.trim()}>{busy ? "…" : "Let's go"}</Button>
            <button onClick={() => finish(false)} disabled={busy} className={s.later}>I'll do this later</button>
          </>
        )}
      </div>
    </div>
  );
}
