import { useState, Fragment } from "react";
import { COLORS, createTrip } from "../lib/session.js";
import { saveKey } from "../lib/storage.js";
import { CONFIG_KEY, listDates, softOf, slugify, dateLabel, weekday, addDays, todayISO } from "../lib/tripConfig.js";
import { searchPlaces } from "../lib/geocode.js";
import buildTripConfig from "../lib/buildTripConfig.js";
import usePlaceSearch from "../lib/usePlaceSearch.js";
import { generateItinerary, importItinerary, aiItineraryAvailable, itineraryImportAvailable } from "../lib/itinerary.js";
import { getLocalProfile } from "../lib/profile.js";
import { searchCoverPhotos, trackDownload, asCover } from "../lib/unsplash.js";
import { CURRENCIES } from "../data/currencies.js";
import Spinner from "./Spinner.jsx";
import { DEST_COLORS, onColor } from "../theme.js";
import { shareInvite, copyInviteLink } from "./shareInvite.js";
import Icon from "./ui/icons.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, TextArea, Select, FormStack, FieldRow } from "./ui/Field.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import Toggle from "./ui/Toggle.jsx";
import RouteLine from "./ui/RouteLine.jsx";
import Segmented from "./ui/Segmented.jsx";
import s from "./TripWizard.module.css";

const MAX_TRIP_DAYS = 60;

// New trips start with an empty packing list — the Pack tab shows suggested
// categories and a sample hint so travellers build their own list.
const GENERIC_PACKING = [];

// The wizard's progress bar IS the route-line motif: solid behind, dashed
// ahead, the current stop slightly larger.
function Spine({ step, total, names }) {
  return (
    <>
      <div className={s.spine}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          return (
            <Fragment key={n}>
              {i > 0 && <span className={n <= step ? s.segDone : s.seg} />}
              <span className={n === step ? s.nodeActive : n < step ? s.nodeDone : s.node} />
            </Fragment>
          );
        })}
      </div>
      <div className={s.spineMeta}>
        <span className={s.spineName}>{names[step - 1]}</span>
        <span className={s.spineCount}>{step} of {total}</span>
      </div>
    </>
  );
}

// Multi-step create-trip flow. `profile` = { name, color } from the caller
// (TripGate inputs or an existing membership); the identity block only shows
// when neither the caller nor the local profile knows who this is yet.
export default function TripWizard({ profile, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — you + basics (prefilled from the global profile when the caller
  // didn't pass one, so returning users never retype their name)
  const [name, setName] = useState(profile?.name || getLocalProfile()?.name || "");
  const [color, setColor] = useState(profile?.color || getLocalProfile()?.color || COLORS[0]);
  const [askIdentity] = useState(() => !(profile?.name || getLocalProfile()?.name));
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
  // The days step offers an AI draft from a brief and/or importing an
  // itinerary the organiser already has (pasted text). Writing the days by
  // hand is "Skip for now".
  const aiOn = aiItineraryAvailable || itineraryImportAvailable;
  const daysModes = [
    aiItineraryAvailable && { id: "draft", label: "Draft with AI" },
    itineraryImportAvailable && { id: "paste", label: "Paste yours" },
  ].filter(Boolean);
  const [daysMode, setDaysMode] = useState(daysModes[0]?.id || "draft");
  const [pasteText, setPasteText] = useState("");
  const totalSteps = aiOn ? 5 : 4;
  const reviewStep = totalSteps;
  const stepNames = aiOn
    ? ["Basics", "Money", "Cities", "Days · optional", "Review"]
    : ["Basics", "Money", "Cities", "Review"];
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

  // Shared by the AI draft and the pasted import, which both return
  // [{ date, city, plan }]: run the call, turn the cities into legs, preview.
  const runDays = async (fetchDays) => {
    setAiBusy(true); setAiError(null);
    try {
      const days = await fetchDays();
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

  const aiGenerate = () => runDays(() => generateItinerary({
    title: title.trim(),
    startDate, endDate,
    description: aiDesc.trim(),
    days: listDates(startDate, endDate).map((date) => ({ date, legName: destForDate(date).name })),
  }));

  const aiImport = () => {
    if (!pasteText.trim()) { setAiError(Object.assign(new Error("empty"), { code: "empty" })); return; }
    runDays(() => importItinerary({ text: pasteText, startDate, endDate }));
  };

  const aiDiscard = () => { setAiDays(null); setAiLegs(null); setAiAccepted(false); setAiKey(""); setAiError(null); };

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

  const copyLink = () => copyInviteLink(created);
  const share = () => shareInvite(title, created);

  if (created) {
    const cfg = buildConfig();
    const firstCity = cfg.legs[cfg.legOrder[0]]?.name;
    return (
      <div className={s.page}>
        <div className={s.wrap}>
          {/* the celebration is the motif: the route in destination colours,
              trailing dashed into days not yet lived */}
          <div className={s.createdRoute}>
            {cfg.legOrder.slice(0, 3).map((k, i) => (
              <Fragment key={k}>
                {i > 0 && <span className={s.createdSeg} />}
                <span className={s.createdDot} style={{ "--c": cfg.legs[k].color }} />
              </Fragment>
            ))}
            <span className={s.createdTail} />
          </div>
          <h1 className={s.createdTitle}>{title.trim()} is ready.</h1>
          {firstCity && <p className={s.createdVoice}>See you in {firstCity}.</p>}
          <div className={s.codeCard}>
            <div className={s.codeLabel}>Invite code</div>
            <div className={s.codeValue}>{created}</div>
            <p className={s.codeHint}>Share the link and people join in seconds — no app store, no sign-up. The code works too.</p>
            <div className={s.codeActions}>
              <button onClick={copyLink} className={s.codeBtn}><Icon name="copy" size={13} strokeWidth={1.7} /> Copy link</button>
              <button onClick={share} className={s.codeBtn}><Icon name="share" size={13} strokeWidth={1.7} /> Share</button>
            </div>
          </div>
          <p className={s.createdBody}>
            Everyone you share it with sees the whole trip — itinerary, budget and packing, each person's additions clearly labelled.
          </p>
          <div className={s.footer}>
            <div className={s.footerRow}>
              <Button onClick={onDone}>Open the trip <Icon name="arrow" size={13} strokeWidth={2} /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const footer = () => {
    if (step === reviewStep) {
      return (
        <Button onClick={create} disabled={busy}>
          {busy && <Spinner size={16} on="accent" />}
          {busy ? "Creating…" : `Create ${title.trim() || "the trip"}`}
        </Button>
      );
    }
    if (aiOn && step === 4) {
      if (aiDays && !aiAccepted) {
        return (
          <>
            <Button variant="ghost" onClick={aiDiscard} className={s.footerSecondary}>Discard</Button>
            <Button onClick={() => setAiAccepted(true)}>Use this draft</Button>
          </>
        );
      }
      return (
        <Button onClick={next} disabled={aiBusy}>
          {aiAccepted ? <>Continue to review <Icon name="arrow" size={13} strokeWidth={2} /></> : "Skip for now"}
        </Button>
      );
    }
    const label = step === 1 ? "Continue to money" : step === 2 ? "Continue to cities" : aiOn ? "Continue to days" : "Continue to review";
    return (
      <>
        {step === 2 && budget === "" && !homeOn && (
          <Button variant="ghost" onClick={next} className={s.footerSecondary}>Skip</Button>
        )}
        <Button onClick={next}>{label} <Icon name="arrow" size={13} strokeWidth={2} /></Button>
      </>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.topbar}>
          <button onClick={step === 1 ? onCancel : () => setStep(step - 1)} aria-label="Back" className={s.back}>
            <Icon name="back" size={18} strokeWidth={1.8} />
          </button>
          <span className={s.wordmark}>New trip</span>
          <button onClick={onCancel} className={s.cancel}>Cancel</button>
        </div>

        {step === 1 && (
          <div>
            <h1 className={s.h1}>The basics</h1>
            <Spine step={step} total={totalSteps} names={stepNames} />
            <div className={s.stepBody}>
              <FormStack>
                {askIdentity && (
                  <div>
                    <div className={s.sectionLabel}>You on this trip</div>
                    <div className={s.idRow}>
                      <span className={s.idAvatar} style={{ "--c": color, "--on": onColor(color) }} aria-hidden="true">
                        {(name.trim()[0] || "?").toUpperCase()}
                      </span>
                      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" />
                    </div>
                    <div className={s.idSwatches}>
                      <SwatchPicker colors={COLORS} value={color} onChange={setColor} />
                    </div>
                  </div>
                )}
                <Field label="Trip name">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="e.g. Japan in Spring" />
                </Field>
                <div>
                  <FieldRow>
                    <Field label="Starts">
                      <Input type="date" value={startDate} min={todayISO()} onChange={(e) => setStartDate(e.target.value)} />
                    </Field>
                    <Field label="Ends">
                      <Input type="date" value={endDate} min={startDate || todayISO()} onChange={(e) => setEndDate(e.target.value)} />
                    </Field>
                  </FieldRow>
                  {tripLen > 0 && (
                    <p className={s.dayCount}>
                      <span className={s.dayCountNum}>{tripLen}</span>
                      <span className={s.dayCountText}>day{tripLen === 1 ? "" : "s"}.</span>
                    </p>
                  )}
                </div>
              </FormStack>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className={s.h1}>Money</h1>
            <Spine step={step} total={totalSteps} names={stepNames} />
            <div className={s.stepBody}>
              <FormStack>
                <Field label="Trip currency" hint="Every expense on the trip is logged in this.">
                  <CurrencySelect value={currency} onChange={setCurrency} />
                </Field>
                <div className={s.toggleRow}>
                  <span className={s.toggleText}>
                    <span className={s.toggleLabel}>Show totals in my currency too</span>
                    <span className={s.toggleSub}>Alongside {currency}, everywhere money shows.</span>
                  </span>
                  <Toggle checked={homeOn} onChange={setHomeOn} />
                </div>
                {homeOn && (
                  <div>
                    <FieldRow>
                      <Field label="My currency">
                        <CurrencySelect value={homeCurrency} onChange={setHomeCurrency} exclude={currency} />
                      </Field>
                      <div className={s.rateCol}>
                        <Field label={`1 ${currency} equals`}>
                          <Input value={homeRate} onChange={(e) => setHomeRate(e.target.value)} inputMode="decimal" placeholder="e.g. 127" />
                        </Field>
                      </div>
                    </FieldRow>
                  </div>
                )}
                <Field label={`Budget · optional`}
                  hint={homeOn && parseFloat(homeRate) > 0 && parseFloat(budget) > 0
                    ? `≈ ${homeCurrency} ${Math.round(parseFloat(budget) * parseFloat(homeRate)).toLocaleString()} · the Budget tab tracks spending against this.`
                    : "The Budget tab tracks spending against this."}>
                  <Input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder={`In ${currency} — empty for no budget bar`} />
                </Field>
              </FormStack>
            </div>
          </div>
        )}

        {step === 3 && (
          <DestinationsStep dests={dests} setDests={setDests} startDate={startDate} endDate={endDate}
            spine={<Spine step={step} total={totalSteps} names={stepNames} />} />
        )}

        {aiOn && step === 4 && (
          <AiItineraryStep desc={aiDesc} setDesc={setAiDesc} days={aiDays} legs={aiLegs?.legs} busy={aiBusy} error={aiError}
            accepted={aiAccepted} tripLen={tripLen} onGenerate={aiGenerate} onRemove={() => setAiAccepted(false)}
            modes={daysModes} mode={daysMode} setMode={(m) => { setDaysMode(m); setAiError(null); }}
            pasteText={pasteText} setPasteText={setPasteText} onImport={aiImport}
            spine={<Spine step={step} total={totalSteps} names={stepNames} />} />
        )}

        {step === reviewStep && (
          <ReviewStep config={buildConfig()} homeOn={homeOn} homeCurrency={homeCurrency}
            onEdit={(n) => { setError(""); setStep(n); }} daysStep={aiOn ? 4 : 3}
            spine={<Spine step={step} total={totalSteps} names={stepNames} />} />
        )}

        {error && <p className={s.error}>{error}</p>}

        <div className={s.footer}>
          <div className={s.footerRow}>{footer()}</div>
        </div>
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

function DestinationsStep({ dests, setDests, startDate, endDate, spine }) {
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
      <h1 className={s.h1}>Cities</h1>
      {spine}
      <div className={s.stepBody}>
        {dests.length > 0 && (
          <div className={s.destList}>
            {dests.map((d, i) => (
              <div key={i} className={s.destCard}>
                <span className={s.destGrip}><Icon name="grip" size={14} /></span>
                <span className={s.destDot} style={{ "--c": d.color }} />
                <span className={s.destName}>{d.name}</span>
                {d.country && <span className={s.destCountry}>{d.country}</span>}
                <span className={s.destSpacer} />
                {i === 0 ? (
                  <span className={s.arrivalStatic}>from the start</span>
                ) : (
                  <Input type="date" value={d.arrival} min={startDate ? addDays(startDate, 1) : undefined} max={endDate || undefined}
                    aria-label={`${d.name} arrival date`}
                    onChange={(e) => setDests((ds) => ds.map((x, j) => (j === i ? { ...x, arrival: e.target.value } : x)))} className={s.arrivalChip} />
                )}
                <button onClick={() => setDests((ds) => ds.filter((_, j) => j !== i))} aria-label={`Remove ${d.name}`} className={s.destRemove}>
                  <Icon name="x" size={13} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className={s.searchBox}>
          <span className={s.searchIcon}><Icon name="search" size={15} strokeWidth={1.8} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={s.searchInput}
            placeholder={dests.length ? "Add another city…" : "Search a city, e.g. Kyoto"} />
        </label>
        {searching && <p className={s.searching}><Spinner size={14} /> Searching…</p>}
        {!searching && results.length > 0 && (
          <div className={s.results}>
            {results.map((r, i) => (
              <button key={i} onClick={() => addDest(r)} className={s.result}>
                <span className={s.resultName}>{r.name}</span>
                <span className={s.resultMeta}>{[r.admin1, r.country].filter(Boolean).join(", ")}</span>
              </button>
            ))}
          </div>
        )}

        {/* the trip's identity taking shape — route assembles as cities are added */}
        {dests.length > 0 && (
          <div className={s.routePreview}>
            <RouteLine stops={dests.map((d) => ({ name: d.name, color: d.color }))} labels />
          </div>
        )}
      </div>
    </div>
  );
}

// Optional AI planning step. Everything is previewed before it touches the
// config: plans only make it into buildConfig() once the user accepts (the
// Discard / Use this draft decision lives in the wizard footer).
// Short, plain messages for importItinerary()/generateItinerary() error codes.
const PASTE_LIMIT = 6000;
function daysErrorText(error, mode) {
  switch (error?.code) {
    case "empty": return ["Paste your itinerary first", "Copy it from your website, PDF or WhatsApp and paste it in the box."];
    case "disabled": return ["AI isn't set up here", "Skip this step and write the days yourself."];
    case "quota": return ["Today's AI limit is used up", "Try again tomorrow, or skip this step and write the days yourself."];
    case "unauthorized": return ["Couldn't check who you are", "Reload the page and try again."];
    case "bad-input": return mode === "paste"
      ? ["Couldn't find the days in that", "Paste an itinerary that lists each day, then try again."]
      : ["Couldn't use that brief", "Shorten or reword it, then try again."];
    case "busy": return ["The AI is busy right now", "Nothing you've set is lost. Try again in a minute."];
    default: return ["Couldn't reach the AI", "Nothing you've set is lost. Try again in a few minutes, or write the days yourself."];
  }
}

function AiItineraryStep({ desc, setDesc, days, legs, busy, error, accepted, tripLen, onGenerate, onRemove, modes, mode, setMode, pasteText, setPasteText, onImport, spine }) {
  const disabled = error?.code === "disabled";
  const pasting = mode === "paste";
  const [errTitle, errBody] = error ? daysErrorText(error, mode) : [];
  return (
    <div>
      <h1 className={s.h1}>
        {days ? <>A first draft<span className={s.h1Voice}>nothing is final</span></> : "Want a head start on the days?"}
      </h1>
      {spine}
      <div className={s.stepBody}>
        {!days && !busy && modes.length > 1 && (
          <div className={s.modeRow}>
            <Segmented value={mode} onChange={setMode} options={modes} />
          </div>
        )}
        {!days && !pasting && (
          <Field label="Your brief">
            <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={2000}
              placeholder="e.g. Slow mornings, big food energy, one museum max." />
          </Field>
        )}
        {!days && pasting && (
          <Field label="Your itinerary" hint={
            <span className={pasteText.length > PASTE_LIMIT ? s.pasteOver : undefined}>
              {pasteText.length.toLocaleString()} / {PASTE_LIMIT.toLocaleString()} characters. Anything past {PASTE_LIMIT.toLocaleString()} is cut off.
            </span>
          }>
            <TextArea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8}
              placeholder={"Paste it from your website, PDF or WhatsApp.\ne.g. Day 1: Pickup from Delhi at 9 pm, overnight Volvo…"} />
          </Field>
        )}
        {!disabled && !busy && !days && (
          <Button full variant="tonal" onClick={pasting ? onImport : onGenerate} className={s.aiGen}>
            {pasting ? "Read my itinerary" : "Draft my days"}
          </Button>
        )}
        {busy && (
          <div className={s.aiWait}>
            <div className={s.aiWaitHead}>
              <span className={s.aiWaitTitle}>{pasting ? "Reading your itinerary…" : `Drafting your ${tripLen || ""} days…`}</span>
              <span className={s.aiWaitEta}>~30s</span>
            </div>
            <div className={s.aiWaitRule} />
            <p className={s.aiWaitLine}><Spinner size={13} /> {pasting ? "Matching it to your dates" : "Reading your route and your brief"}</p>
          </div>
        )}
        {error && (
          <div className={s.aiErrorCard}>
            <p className={s.aiErrorTitle}>{errTitle}</p>
            <p className={s.aiErrorBody}>{errBody}</p>
          </div>
        )}
        {days && (
          <>
            <div className={s.planList}>
              {days.map((d) => {
                const leg = legs?.[slugify(d.city || "")] || {};
                const cityColor = leg.color || "var(--ink-faint)";
                return (
                  <div key={d.date} className={s.planRow}>
                    <span className={s.planDate}>{weekday(d.date)} {dateLabel(d.date)}</span>
                    <span className={s.planText}>{d.plan || "—"}</span>
                    {d.city && (
                      <span className={s.cityTag} style={{ "--c": cityColor }}>
                        <span className={s.cityDot} />
                        <span className={s.cityName}>{d.city}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {pasting
              ? <p className={s.aiCaption}>Read from your itinerary. Check the days, then edit anything in the trip.</p>
              : desc.trim() && <p className={s.aiCaption}>Drafted around your brief.</p>}
            {accepted && (
              <div className={s.aiAcceptedRow}>
                <span className={s.aiAccepted}><Icon name="check" size={13} strokeWidth={2} /> Added — you'll see it on the review step</span>
                <button onClick={onRemove} className={s.aiRemove}>Remove</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ config, homeOn, homeCurrency, onEdit, daysStep, spine }) {
  const dates = `${weekday(config.startDate)} ${dateLabel(config.startDate)} – ${weekday(config.endDate)} ${dateLabel(config.endDate)} · ${config.days.length} days`;
  const money = `${config.currency}${config.budget ? ` · budget ${config.budget.toLocaleString()}` : ""}${homeOn ? ` · ${homeCurrency} shown too` : ""}`;
  const nDays = config.days.length;
  const daysWord = nDays <= 12
    ? ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][nDays]
    : String(nDays);

  return (
    <div>
      <h1 className={s.h1}>Ready to make it real?</h1>
      {spine}
      <div className={s.stepBody}>
        <div className={s.summaryCard}>
          <div className={s.summaryRow}>
            <span className={s.summaryKey}>Trip</span>
            <span className={s.summaryVal}>{config.title}</span>
            <button onClick={() => onEdit(1)} className={s.editLink}>Edit</button>
          </div>
          <div className={s.summaryRow}>
            <span className={s.summaryKey}>Dates</span>
            <span className={s.summaryVal}>{dates}</span>
            <button onClick={() => onEdit(1)} className={s.editLink}>Edit</button>
          </div>
          <div className={s.summaryRow}>
            <span className={s.summaryKey}>Money</span>
            <span className={s.summaryVal}>{money}</span>
            <button onClick={() => onEdit(2)} className={s.editLink}>Edit</button>
          </div>
          <div className={s.summaryRow}>
            <span className={s.summaryKey}>Cities</span>
            <span className={s.summaryCities}>
              {config.legOrder.map((k) => (
                <Fragment key={k}>
                  <span className={s.summaryDot} style={{ "--c": config.legs[k].color }} />
                  <span className={s.summaryCity}>{config.legs[k].name}</span>
                </Fragment>
              ))}
            </span>
            <button onClick={() => onEdit(3)} className={s.editLink}>Edit</button>
          </div>
        </div>

        <div className={s.daysHead}>
          <span className={s.sectionLabel}>The {daysWord} days</span>
          <button onClick={() => onEdit(daysStep)} className={s.editLink}>Edit days</button>
        </div>
        <div className={[s.planList, s.daysList].join(" ")}>
          {config.days.map((d) => {
            const L = config.legs[d.leg];
            return (
              <div key={d.date} className={s.reviewRow}>
                <span className={s.reviewDate}>{weekday(d.date)} {dateLabel(d.date)}</span>
                <span className={s.reviewText}>{d.title || d.plan || "—"}</span>
                <span className={s.reviewDot} style={{ "--c": L.color }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
