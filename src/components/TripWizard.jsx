import { useState, useEffect, useRef } from "react";
import { COLORS, createTrip } from "../lib/session.js";
import { saveKey } from "../lib/storage.js";
import { CONFIG_KEY, generateDays, listDates, softOf, slugify, dateLabel, weekday, addDays, softBg, todayISO } from "../lib/tripConfig.js";
import { searchPlaces } from "../lib/geocode.js";
import { generateItinerary, aiItineraryAvailable } from "../lib/itinerary.js";
import { getLocalProfile } from "../lib/profile.js";
import { searchCoverPhotos, trackDownload, asCover } from "../lib/unsplash.js";
import { CURRENCIES } from "../data/currencies.js";
import { APP_NAME, ACCENT, INK, MUTED } from "../theme.js";

const MAX_TRIP_DAYS = 60;

// New trips start with an empty packing list — the Pack tab shows suggested
// categories and a sample hint so travellers build their own list.
const GENERIC_PACKING = [];

const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--field)", color: INK };

// Multi-step create-trip flow. `profile` = { name, color } from the caller
// (TripGate inputs or an existing membership); shown editable on step 1.
export default function TripWizard({ profile, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — you + basics (prefilled from the global profile when the caller
  // didn't pass one, so returning users never retype their name)
  const [name, setName] = useState(profile?.name || getLocalProfile()?.name || "");
  const [color, setColor] = useState(profile?.color || getLocalProfile()?.color || COLORS[0]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Step 2 — money
  const [currency, setCurrency] = useState("USD");
  const [homeOn, setHomeOn] = useState(false);
  const [homeCurrency, setHomeCurrency] = useState("INR");
  const [homeRate, setHomeRate] = useState("");
  const [budget, setBudget] = useState("");

  // Step 3 — destinations [{ name, country, lat, lon, color, arrival }]
  const [dests, setDests] = useState([]);

  // Step 4 (optional, only when the AI planner is available) — AI itinerary
  const aiOn = aiItineraryAvailable;
  const totalSteps = aiOn ? 5 : 4;
  const reviewStep = totalSteps;
  const [aiDesc, setAiDesc] = useState("");
  const [aiDays, setAiDays] = useState(null); // preview: [{ date, city, plan }] | null
  const [aiLegs, setAiLegs] = useState(null); // { legs, legOrder, dateKey } from AI cities
  const [aiAccepted, setAiAccepted] = useState(false);
  const [aiKey, setAiKey] = useState(""); // inputs snapshot at generation time
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Final — created
  const [created, setCreated] = useState(null);

  const tripLen = startDate && endDate && endDate >= startDate ? listDates(startDate, endDate).length : 0;

  const validateBasics = () => {
    if (!name.trim()) return "Enter your name.";
    if (!title.trim()) return "Give the trip a name.";
    if (!startDate || !endDate) return "Pick the start and end dates.";
    if (startDate < todayISO()) return "The start date is in the past — pick today or a future date.";
    if (endDate < startDate) return "The end date is before the start date.";
    if (tripLen > MAX_TRIP_DAYS) return `That's ${tripLen} days — the limit is ${MAX_TRIP_DAYS}.`;
    return "";
  };

  // Snapshot of everything the AI suggestion was generated from — when it no
  // longer matches (dates or destinations edited), the preview is stale.
  const aiInputsKey = [startDate, endDate, ...dests.map((d) => `${d.name}@${d.arrival}`)].join("|");

  const next = () => {
    setError("");
    if (step === 1) {
      const e = validateBasics();
      if (e) { setError(e); return; }
      // keep destination arrivals inside the (possibly changed) date range
      setDests((ds) => ds.map((d, i) => ({ ...d, arrival: i === 0 ? startDate : d.arrival && d.arrival >= startDate && d.arrival <= endDate ? d.arrival : startDate })));
    }
    if (step === 2 && homeOn && !(parseFloat(homeRate) > 0)) { setError("Enter the conversion rate (1 trip unit = ? home units)."); return; }
    if (step === 3) {
      if (dests.length === 0) { setError("Add at least one destination."); return; }
      if (aiKey && aiKey !== aiInputsKey) { setAiDays(null); setAiLegs(null); setAiAccepted(false); setAiKey(""); setAiError(null); }
    }
    setStep(step + 1);
  };

  // Which destination covers a given date (same sorted-arrival rule as
  // buildConfig's legForDate, kept in sync so the AI payload can't diverge).
  const destForDate = (iso) => {
    const sorted = [...dests].sort((a, b) => (a.arrival < b.arrival ? -1 : 1));
    let cur = sorted[0] || { name: "", color: MUTED };
    for (const d of sorted) if (d.arrival <= iso) cur = d;
    return cur;
  };

  const aiGenerate = async () => {
    setAiBusy(true); setAiError(null);
    try {
      const days = await generateItinerary({
        title: title.trim(),
        startDate, endDate,
        description: aiDesc.trim(),
        days: listDates(startDate, endDate).map((date) => ({ date, legName: destForDate(date).name })),
      });
      // Turn the AI's per-day cities into legs (first-appearance order). Reuse a
      // typed destination's coords when the name matches, else geocode the city.
      const legs = {};
      const legOrder = [];
      const dateKey = {};
      let lastKey = null;
      for (const d of days) {
        const city = (d.city || "").trim();
        let key = lastKey;
        if (city) {
          key = slugify(city);
          if (!legs[key]) {
            const typed = dests.find((x) => x.name.toLowerCase() === city.toLowerCase());
            let geo = typed;
            if (!geo) { try { geo = (await searchPlaces(city))[0]; } catch { geo = null; } }
            const color = COLORS[legOrder.length % COLORS.length];
            legs[key] = { name: city, color, soft: softOf(color), lat: geo?.lat ?? null, lon: geo?.lon ?? null, norm: null };
            legOrder.push(key);
          }
        }
        dateKey[d.date] = key;
        lastKey = key;
      }
      // Any leading days the AI left city-less fall back to the first city.
      for (const dt of Object.keys(dateKey)) if (!dateKey[dt]) dateKey[dt] = legOrder[0];
      setAiDays(days); setAiLegs({ legs, legOrder, dateKey }); setAiAccepted(false); setAiKey(aiInputsKey);
    } catch (e) { setAiError(e); }
    setAiBusy(false);
  };

  const buildConfig = () => {
    // When an AI itinerary is accepted, its cities define the legs; otherwise
    // the typed destinations and their arrival dates do (unchanged behaviour).
    const useAi = aiAccepted && aiDays && aiLegs && aiLegs.legOrder.length > 0;
    let legs, legOrder, legForDate, planFor;
    if (useAi) {
      ({ legs, legOrder } = aiLegs);
      legForDate = (iso) => aiLegs.dateKey[iso] || legOrder[0];
      planFor = Object.fromEntries(aiDays.map((d) => [d.date, d.plan]));
    } else {
      legs = {};
      legOrder = [];
      const keyed = dests.map((d) => {
        let key = slugify(d.name);
        while (legs[key]) key += "2";
        legs[key] = { name: d.name, color: d.color, soft: softOf(d.color), lat: d.lat, lon: d.lon, norm: null };
        legOrder.push(key);
        return { ...d, key };
      });
      const sorted = [...keyed].sort((a, b) => (a.arrival < b.arrival ? -1 : 1));
      legForDate = (iso) => {
        let leg = sorted[0].key;
        for (const d of sorted) if (d.arrival <= iso) leg = d.key;
        return leg;
      };
      planFor = {};
    }
    return {
      v: 1,
      title: title.trim(),
      startDate, endDate,
      currency,
      homeCurrency: homeOn ? homeCurrency : null,
      homeRate: homeOn ? parseFloat(homeRate) : null,
      budget: parseFloat(budget) > 0 ? parseFloat(budget) : null,
      legs, legOrder,
      days: generateDays(startDate, endDate, legForDate).map((d, i) => {
        const legName = legs[d.leg]?.name || "";
        return { ...d, title: `Day ${i + 1} · ${legName}`, plan: planFor[d.date] || "" };
      }),
      packingTemplate: GENERIC_PACKING,
    };
  };

  const create = async () => {
    setBusy(true); setError("");
    try {
      const config = buildConfig();
      // Best-effort cover photo for the trip's first city — the AI plan's first
      // city when accepted, else the first typed destination. The gradient
      // fallback covers no-key/offline, so failures are silently ignored.
      try {
        const coverName = config.legs[config.legOrder[0]]?.name || dests[0].name;
        const photos = await searchCoverPhotos(`${coverName} travel`);
        if (photos[0]) { config.cover = asCover(photos[0]); trackDownload(photos[0]); }
      } catch { /* gradient fallback */ }
      const s = await createTrip(name.trim(), color);
      await saveKey(CONFIG_KEY, config);
      setCreated(s.code);
    } catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
  };

  const share = async () => {
    const text = `Join my trip "${title.trim()}" on ${APP_NAME} — code: ${created}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(created);
    } catch { /* cancelled */ }
  };

  const wrap = { minHeight: "100vh", backgroundColor: "var(--bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
  const label = (t) => <label className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{t}</label>;

  if (created) {
    return (
      <div className="flex items-center justify-center px-6" style={wrap}>
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-lg font-bold mb-1" style={{ color: INK }}>Trip created</h1>
          <p className="text-sm mb-5" style={{ color: MUTED }}>
            Share this code so others can join. Everyone sees the whole trip, with each person's additions clearly labelled.
          </p>
          <div className="rounded-2xl border px-6 py-5 mb-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: MUTED }}>Trip code</div>
            <div className="text-3xl font-bold tracking-[0.3em]" style={{ color: INK, fontFamily: "ui-monospace, monospace" }}>{created}</div>
          </div>
          <button onClick={share} className="text-sm font-semibold mb-5" style={{ color: ACCENT }}>Share / copy code</button>
          <button onClick={onDone} className="w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
            Open the trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-6 py-8" style={wrap}>
      <div className="max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <button onClick={step === 1 ? onCancel : () => setStep(step - 1)} className="text-sm font-semibold" style={{ color: MUTED }}>‹ Back</button>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Step {step} of {totalSteps}</span>
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold mb-4" style={{ color: INK }}>New trip</h1>
            {label("Your name")}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Sam"
              className="mt-1 mb-3 w-full text-sm rounded-xl border px-4 py-3" style={inputStyle} />
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Your colour</div>
            <div className="flex gap-2 mb-4">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: c, outline: color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }}>
                  {color === c && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
            {label("Trip name")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="e.g. Japan in Spring"
              className="mt-1 mb-3 w-full text-sm rounded-xl border px-4 py-3" style={inputStyle} />
            <div className="flex gap-2 mb-1">
              <div className="flex-1">
                {label("First day")}
                <input type="date" value={startDate} min={todayISO()} onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full text-sm rounded-xl border px-3 py-3" style={inputStyle} />
              </div>
              <div className="flex-1">
                {label("Last day")}
                <input type="date" value={endDate} min={startDate || todayISO()} onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full text-sm rounded-xl border px-3 py-3" style={inputStyle} />
              </div>
            </div>
            {tripLen > 0 && <p className="text-xs mb-2" style={{ color: MUTED }}>{tripLen} day{tripLen === 1 ? "" : "s"}</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold mb-4" style={{ color: INK }}>Money</h1>
            {label("Trip currency")}
            <CurrencySelect value={currency} onChange={setCurrency} />
            <div className="flex items-center justify-between mt-4 mb-2">
              <span className="text-sm font-semibold" style={{ color: INK }}>Also show amounts in a second currency</span>
              <button onClick={() => setHomeOn(!homeOn)} className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: homeOn ? "#2E7D4F" : "var(--chip)" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: homeOn ? 22 : 2 }} />
              </button>
            </div>
            {homeOn && (
              <div className="mb-3">
                {label("Home currency")}
                <CurrencySelect value={homeCurrency} onChange={setHomeCurrency} exclude={currency} />
                <div className="mt-2">
                  {label(`1 ${currency} = ? ${homeCurrency}`)}
                  <input value={homeRate} onChange={(e) => setHomeRate(e.target.value)} inputMode="decimal" placeholder="e.g. 127"
                    className="mt-1 w-full text-sm rounded-xl border px-4 py-3" style={inputStyle} />
                </div>
              </div>
            )}
            <div className="mt-3">
              {label(`Total budget in ${currency} (optional)`)}
              <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="Leave empty for no budget bar"
                className="mt-1 w-full text-sm rounded-xl border px-4 py-3" style={inputStyle} />
            </div>
          </div>
        )}

        {step === 3 && (
          <DestinationsStep dests={dests} setDests={setDests} startDate={startDate} endDate={endDate} />
        )}

        {aiOn && step === 4 && (
          <AiItineraryStep desc={aiDesc} setDesc={setAiDesc} days={aiDays} legs={aiLegs?.legs} busy={aiBusy} error={aiError}
            accepted={aiAccepted} onGenerate={aiGenerate} onAccept={() => setAiAccepted(true)}
            onRemove={() => setAiAccepted(false)} />
        )}

        {step === reviewStep && (
          <ReviewStep config={buildConfig()} />
        )}

        {error && <p className="text-xs mt-3" style={{ color: ACCENT }}>{error}</p>}

        <button onClick={step === reviewStep ? create : next} disabled={busy || aiBusy}
          className="mt-5 w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
          {busy ? "Creating…" : step === reviewStep ? "Create trip" : aiOn && step === 4 && !aiAccepted ? "Skip for now" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function CurrencySelect({ value, onChange, exclude }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full text-sm rounded-xl border px-3 py-3" style={inputStyle}>
      {CURRENCIES.filter((c) => c.code !== exclude).map((c) => (
        <option key={c.code} value={c.code}>{c.code} · {c.name} ({c.symbol})</option>
      ))}
    </select>
  );
}

function DestinationsStep({ dests, setDests, startDate, endDate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchPlaces(query)); } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query]);

  const addDest = (place) => {
    setDests((ds) => [...ds, {
      name: place.name,
      country: place.country,
      lat: place.lat,
      lon: place.lon,
      color: COLORS[ds.length % COLORS.length],
      arrival: ds.length === 0 ? startDate : "",
    }]);
    setQuery(""); setResults([]);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: INK }}>Destinations</h1>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Add the places you'll stay, in order. Days are assigned by each place's arrival date.</p>

      {dests.map((d, i) => (
        <div key={i} className="rounded-xl border p-3 mb-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold inline-flex items-center gap-2" style={{ color: INK }}>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}{d.country ? `, ${d.country}` : ""}
            </span>
            <button onClick={() => setDests((ds) => ds.filter((_, j) => j !== i))} className="text-xs" style={{ color: "var(--faint)" }}>✕</button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{i === 0 ? "From the start" : "Arriving on"}</span>
            {i > 0 && (
              <input type="date" value={d.arrival} min={startDate ? addDays(startDate, 1) : undefined} max={endDate || undefined}
                onChange={(e) => setDests((ds) => ds.map((x, j) => (j === i ? { ...x, arrival: e.target.value } : x)))}
                className="text-xs rounded-lg border px-2 py-1.5" style={inputStyle} />
            )}
          </div>
        </div>
      ))}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dests.length ? "Add another place…" : "Search a city, e.g. Kyoto"}
        className="w-full text-sm rounded-xl border px-4 py-3" style={inputStyle} />
      {searching && <p className="text-xs mt-2" style={{ color: MUTED }}>Searching…</p>}
      {results.map((r, i) => (
        <button key={i} onClick={() => addDest(r)} className="w-full text-left rounded-xl border px-3 py-2.5 mt-1.5 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: INK }}>
          <span className="font-semibold">{r.name}</span>
          <span style={{ color: MUTED }}> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
        </button>
      ))}
    </div>
  );
}

// Optional AI planning step. Everything is previewed before it touches the
// config: plans only make it into buildConfig() once the user accepts.
function AiItineraryStep({ desc, setDesc, days, legs, busy, error, accepted, onGenerate, onAccept, onRemove }) {
  const disabled = error?.code === "disabled";
  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: INK }}>Plan it with AI</h1>
      <p className="text-xs mb-4" style={{ color: MUTED }}>
        Optional — describe the trip you want and get a suggested day-by-day plan. You can edit everything later from the itinerary.
      </p>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} maxLength={2000}
        placeholder="e.g. First time here — love food markets, museums and quiet neighbourhoods. Relaxed pace, and we must catch a sunset by the river."
        className="mb-3 w-full text-sm rounded-xl border px-4 py-3 resize-none" style={inputStyle} />
      {!disabled && (
        <button onClick={onGenerate} disabled={busy}
          className="w-full text-sm font-bold py-3 rounded-full border"
          style={{ color: ACCENT, borderColor: ACCENT, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Asking the AI…" : days ? "Regenerate" : "Draft my itinerary"}
        </button>
      )}
      {error && (
        <p className="text-xs mt-2" style={{ color: ACCENT }}>
          {disabled ? "AI suggestions aren't set up on this deployment — you can skip this step." : String(error.message || error)}
        </p>
      )}
      {days && (
        <div className="mt-4">
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", maxHeight: 320, overflowY: "auto" }}>
            {days.map((d, i) => {
              const leg = legs?.[slugify(d.city || "")] || {};
              const cityColor = leg.color || MUTED;
              return (
                <div key={d.date} className="px-3 py-2" style={{ borderBottom: i < days.length - 1 ? "1px solid var(--divider)" : "none" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] w-16 flex-shrink-0" style={{ color: MUTED, fontFamily: "ui-monospace, monospace" }}>{weekday(d.date)} {dateLabel(d.date)}</span>
                    {d.city && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cityColor, backgroundColor: softBg(cityColor) }}>{d.city}</span>}
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: INK, whiteSpace: "pre-wrap" }}>{d.plan || "—"}</p>
                </div>
              );
            })}
          </div>
          {accepted ? (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-semibold" style={{ color: "#2E7D4F" }}>✓ Added — you'll see it on the review step</span>
              <button onClick={onRemove} className="text-xs font-semibold" style={{ color: MUTED }}>Remove</button>
            </div>
          ) : (
            <button onClick={onAccept} className="mt-2 w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: "#2E7D4F" }}>
              Use this itinerary
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({ config }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: INK }}>{config.title}</h1>
      <p className="text-xs mb-4" style={{ color: MUTED }}>
        {config.days.length} days · {config.legOrder.map((k) => config.legs[k].name).join(" → ")} · {config.currency}
        {config.homeCurrency ? ` (+${config.homeCurrency})` : ""}
        {config.days.some((d) => d.plan) ? " · AI itinerary added" : ""}
      </p>
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", maxHeight: 320, overflowY: "auto" }}>
        {config.days.map((d, i) => {
          const L = config.legs[d.leg];
          return (
            <div key={d.date} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: i < config.days.length - 1 ? "1px solid var(--divider)" : "none" }}>
              <span className="text-[11px] w-16 flex-shrink-0" style={{ color: MUTED, fontFamily: "ui-monospace, monospace" }}>{weekday(d.date)} {dateLabel(d.date)}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: L.color, backgroundColor: softBg(L.color) }}>{L.name}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-2" style={{ color: MUTED }}>You can rename days and edit plans any time from the itinerary.</p>
    </div>
  );
}
