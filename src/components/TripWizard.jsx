import { useState } from "react";
import { COLORS, createTrip } from "../lib/session.js";
import { saveKey } from "../lib/storage.js";
import { CONFIG_KEY, listDates, softOf, slugify, dateLabel, weekday, addDays, softBg, softBorder, todayISO } from "../lib/tripConfig.js";
import { searchPlaces } from "../lib/geocode.js";
import buildTripConfig from "../lib/buildTripConfig.js";
import usePlaceSearch from "../lib/usePlaceSearch.js";
import { generateItinerary, aiItineraryAvailable } from "../lib/itinerary.js";
import { getLocalProfile } from "../lib/profile.js";
import { searchCoverPhotos, trackDownload, asCover } from "../lib/unsplash.js";
import { CURRENCIES } from "../data/currencies.js";
import Spinner from "./Spinner.jsx";
import { APP_NAME, DEST_COLORS } from "../theme.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, TextArea, Select } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import Toggle from "./ui/Toggle.jsx";
import s from "./TripWizard.module.css";

const MAX_TRIP_DAYS = 60;

// New trips start with an empty packing list — the Pack tab shows suggested
// categories and a sample hint so travellers build their own list.
const GENERIC_PACKING = [];

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
    let cur = sorted[0] || { name: "", color: "var(--ink-faint)" };
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
            const legColor = DEST_COLORS[legOrder.length % DEST_COLORS.length];
            legs[key] = { name: city, color: legColor, soft: softOf(legColor), lat: geo?.lat ?? null, lon: geo?.lon ?? null, norm: null };
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

  // When an AI itinerary is accepted, its cities define the legs; otherwise
  // the typed destinations and their arrival dates do (see lib/buildTripConfig).
  const buildConfig = () =>
    buildTripConfig({
      title, startDate, endDate, currency,
      homeOn, homeCurrency, homeRate, budget,
      dests,
      ai: aiAccepted && aiDays && aiLegs ? { days: aiDays, legs: aiLegs } : null,
      packingTemplate: GENERIC_PACKING,
    });

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
      const sess = await createTrip(name.trim(), color);
      await saveKey(CONFIG_KEY, config);
      setCreated(sess.code);
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

  if (created) {
    return (
      <div className={s.centerPage}>
        <div className={s.createdWrap}>
          <div className={s.createdMark}><Icon name="check" size={24} strokeWidth={2} /></div>
          <h1 className={s.createdTitle}>Trip created</h1>
          <p className={s.createdBody}>
            Share this code so others can join. Everyone sees the whole trip, with each person's additions clearly labelled.
          </p>
          <div className={s.codeCard}>
            <div className={s.codeLabel}>Trip code</div>
            <div className={s.codeValue}>{created}</div>
          </div>
          <button onClick={share} className={s.shareBtn}><Icon name="share" size={14} /> Share / copy code</button>
          <Button full onClick={onDone}>Open the trip</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.topbar}>
          <button onClick={step === 1 ? onCancel : () => setStep(step - 1)} className={s.back}>
            <Icon name="back" size={14} strokeWidth={1.8} /> Back
          </button>
          <span className={s.stepLabel}>Step {step} of {totalSteps}</span>
        </div>

        {step === 1 && (
          <div>
            <h1 className={s.h1}>New trip</h1>
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Sam" />
            </Field>
            <Field label="Your colour">
              <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
            </Field>
            <Field label="Trip name">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="e.g. Japan in Spring" />
            </Field>
            <div className={s.dateRow}>
              <Field label="First day">
                <Input type="date" value={startDate} min={todayISO()} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Last day">
                <Input type="date" value={endDate} min={startDate || todayISO()} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            {tripLen > 0 && <p className={s.dayCount}>{tripLen} day{tripLen === 1 ? "" : "s"}</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className={s.h1}>Money</h1>
            <Field label="Trip currency">
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
            <div className={s.toggleRow}>
              <span className={s.toggleLabel}>Also show amounts in a second currency</span>
              <Toggle checked={homeOn} onChange={setHomeOn} />
            </div>
            {homeOn && (
              <>
                <Field label="Home currency">
                  <CurrencySelect value={homeCurrency} onChange={setHomeCurrency} exclude={currency} />
                </Field>
                <Field label={`1 ${currency} = ? ${homeCurrency}`}>
                  <Input value={homeRate} onChange={(e) => setHomeRate(e.target.value)} inputMode="decimal" placeholder="e.g. 127" />
                </Field>
              </>
            )}
            <Field label={`Total budget in ${currency} (optional)`}>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="Leave empty for no budget bar" />
            </Field>
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

        {error && <p className={s.error}>{error}</p>}

        <Button full onClick={step === reviewStep ? create : next} disabled={busy || aiBusy} className={s.continue}>
          {busy && <Spinner size={16} on="accent" />}
          {busy ? "Creating…" : step === reviewStep ? "Create trip" : aiOn && step === 4 && !aiAccepted ? "Skip for now" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function CurrencySelect({ value, onChange, exclude }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.filter((c) => c.code !== exclude).map((c) => (
        <option key={c.code} value={c.code}>{c.code} · {c.name} ({c.symbol})</option>
      ))}
    </Select>
  );
}

function DestinationsStep({ dests, setDests, startDate, endDate }) {
  const [query, setQuery] = useState("");
  const { results, searching } = usePlaceSearch(query);

  const addDest = (place) => {
    setDests((ds) => [...ds, {
      name: place.name,
      country: place.country,
      lat: place.lat,
      lon: place.lon,
      color: DEST_COLORS[ds.length % DEST_COLORS.length],
      arrival: ds.length === 0 ? startDate : "",
    }]);
    setQuery("");
  };

  return (
    <div>
      <h1 className={s.h1}>Destinations</h1>
      <p className={s.sub}>Add the places you'll stay, in order. Days are assigned by each place's arrival date.</p>

      {dests.map((d, i) => (
        <div key={i} className={s.destCard}>
          <div className={s.destHead}>
            <span className={s.destName}>
              <span className={s.destDot} style={{ backgroundColor: d.color }} />
              {d.name}{d.country ? `, ${d.country}` : ""}
            </span>
            <button onClick={() => setDests((ds) => ds.filter((_, j) => j !== i))} aria-label="Remove destination" className={s.destRemove}>
              <Icon name="x" size={14} strokeWidth={2} />
            </button>
          </div>
          <div className={s.destArrival}>
            <span className={s.arrivalLabel}>{i === 0 ? "From the start" : "Arriving on"}</span>
            {i > 0 && (
              <Input type="date" value={d.arrival} min={startDate ? addDays(startDate, 1) : undefined} max={endDate || undefined}
                onChange={(e) => setDests((ds) => ds.map((x, j) => (j === i ? { ...x, arrival: e.target.value } : x)))} className={s.arrivalInput} />
            )}
          </div>
        </div>
      ))}

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dests.length ? "Add another place…" : "Search a city, e.g. Kyoto"} />
      {searching && <p className={s.searching}><Spinner size={14} /> Searching…</p>}
      {results.map((r, i) => (
        <button key={i} onClick={() => addDest(r)} className={s.result}>
          <span className={s.resultName}>{r.name}</span>
          <span className={s.resultMeta}> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
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
      <h1 className={s.h1}>Plan it with AI</h1>
      <p className={s.sub}>
        Optional — describe the trip you want and get a suggested day-by-day plan. You can edit everything later from the itinerary.
      </p>
      <Field>
        <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} maxLength={2000}
          placeholder="e.g. First time here — love food markets, museums and quiet neighbourhoods. Relaxed pace, and we must catch a sunset by the river." />
      </Field>
      {!disabled && (
        <Button full variant="tonal" onClick={onGenerate} disabled={busy} className={s.aiGen}>
          {busy && <Spinner size={16} />}
          {busy ? "Asking the AI… (can take ~30s)" : days ? "Regenerate" : "Draft my itinerary"}
        </Button>
      )}
      {error && (
        <p className={s.error}>
          {disabled ? "AI suggestions aren't set up on this deployment — you can skip this step." : String(error.message || error)}
        </p>
      )}
      {days && (
        <div className={s.aiPreview}>
          <div className={s.planList}>
            {days.map((d) => {
              const leg = legs?.[slugify(d.city || "")] || {};
              const cityColor = leg.color || "var(--ink-faint)";
              return (
                <div key={d.date} className={s.planRow}>
                  <div className={s.planRowHead}>
                    <span className={s.planDate}>{weekday(d.date)} {dateLabel(d.date)}</span>
                    {d.city && <span className={s.destChip} style={{ "--c": cityColor, backgroundColor: softBg(cityColor), borderColor: softBorder(cityColor) }}>{d.city}</span>}
                  </div>
                  <p className={s.planText}>{d.plan || "—"}</p>
                </div>
              );
            })}
          </div>
          {accepted ? (
            <div className={s.aiAcceptedRow}>
              <span className={s.aiAccepted}><Icon name="check" size={13} strokeWidth={2} /> Added — you'll see it on the review step</span>
              <button onClick={onRemove} className={s.aiRemove}>Remove</button>
            </div>
          ) : (
            <Button full onClick={onAccept} className={s.aiUse}>Use this itinerary</Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({ config }) {
  return (
    <div>
      <h1 className={s.h1}>{config.title}</h1>
      <p className={s.sub}>
        {config.days.length} days · {config.legOrder.map((k) => config.legs[k].name).join(" → ")} · {config.currency}
        {config.homeCurrency ? ` (+${config.homeCurrency})` : ""}
        {config.days.some((d) => d.plan) ? " · AI itinerary added" : ""}
      </p>
      <div className={s.planList}>
        {config.days.map((d) => {
          const L = config.legs[d.leg];
          return (
            <div key={d.date} className={s.reviewRow}>
              <span className={s.planDate}>{weekday(d.date)} {dateLabel(d.date)}</span>
              <span className={s.destChip} style={{ "--c": L.color, backgroundColor: softBg(L.color), borderColor: softBorder(L.color) }}>{L.name}</span>
            </div>
          );
        })}
      </div>
      <p className={s.reviewHint}>You can rename days and edit plans any time from the itinerary.</p>
    </div>
  );
}
