import { useState } from "react";
import { COLORS } from "../lib/session.js";
import { saveProfile } from "../lib/profile.js";
import { APP_NAME, ACCENT, INK, MUTED } from "../theme.js";

export const ONBOARDED_KEY = "roundtrip:onboarded";
export const hasOnboarded = () => {
  try { return !!localStorage.getItem(ONBOARDED_KEY); } catch { return true; }
};

const SLIDES = [
  { icon: "🗺️", title: "Plan trips together", text: "Build the itinerary with your travel crew — everyone's ideas, live on every phone, each clearly labelled." },
  { icon: "🧳", title: "Everything in one place", text: "Days, budget, packing, outfits, bookings and documents. No more scattered notes and screenshots." },
  { icon: "✈️", title: "Works anywhere", text: "Offline-ready and shareable with a 6-letter code. Start planning in seconds — no sign-up required." },
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

  return (
    <div className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: "var(--bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="flex items-center justify-between max-w-sm w-full mx-auto">
        <span className="text-sm font-bold" style={{ color: INK }}>✈️ {APP_NAME}</span>
        {!nameStep && (
          <button onClick={() => setStep(SLIDES.length)} className="text-xs font-semibold" style={{ color: MUTED }}>Skip</button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          {!nameStep ? (
            <>
              <div className="text-6xl mb-5">{SLIDES[step].icon}</div>
              <h1 className="text-2xl font-bold mb-3" style={{ color: INK }}>{SLIDES[step].title}</h1>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{SLIDES[step].text}</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">👋</div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: INK }}>What should we call you?</h1>
              <p className="text-sm mb-6" style={{ color: MUTED }}>Your name and colour label everything you add, on every trip.</p>
              <input
                value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name"
                autoFocus onKeyDown={(e) => e.key === "Enter" && name.trim() && finish(true)}
                className="w-full text-center text-base font-semibold rounded-xl border px-4 py-3 mb-4"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: INK }}
              />
              <div className="flex gap-2 justify-center mb-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: c, outline: color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }} aria-label={c}>
                    {color === c && <span className="text-white text-sm font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-sm w-full mx-auto">
        <div className="flex gap-1.5 justify-center mb-5">
          {[...SLIDES, {}].map((_, i) => (
            <span key={i} className="rounded-full transition-all" style={{ width: i === step ? 20 : 6, height: 6, backgroundColor: i === step ? ACCENT : "var(--chip)" }} />
          ))}
        </div>
        {!nameStep ? (
          <button onClick={() => setStep(step + 1)} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
            {step === SLIDES.length - 1 ? "Get started" : "Next"}
          </button>
        ) : (
          <>
            <button onClick={() => finish(true)} disabled={busy || !name.trim()} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT, opacity: name.trim() ? 1 : 0.5 }}>
              {busy ? "…" : "Let's go"}
            </button>
            <button onClick={() => finish(false)} disabled={busy} className="w-full text-xs font-semibold py-2.5 mt-1" style={{ color: MUTED }}>
              I'll do this later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
