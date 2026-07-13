import { useState, useEffect, useRef } from "react";
import { COLORS, createTrip } from "../lib/session.js";
import { saveKey } from "../lib/storage.js";
import { CONFIG_KEY, generateDays, listDates, softOf, slugify, dateLabel, weekday, addDays, softBg, todayISO } from "../lib/tripConfig.js";
import { searchPlaces } from "../lib/geocode.js";
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

  // Step 4 — created
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

  const next = () => {
    setError("");
    if (step === 1) {
      const e = validateBasics();
      if (e) { setError(e); return; }
      // keep destination arrivals inside the (possibly changed) date range
      setDests((ds) => ds.map((d, i) => ({ ...d, arrival: i === 0 ? startDate : d.arrival && d.arrival >= startDate && d.arrival <= endDate ? d.arrival : startDate })));
    }
    if (step === 2 && homeOn && !(parseFloat(homeRate) > 0)) { setError("Enter the conversion rate (1 trip unit = ? home units)."); return; }
    if (step === 3 && dests.length === 0) { setError("Add at least one destination."); return; }
    setStep(step + 1);
  };

  const buildConfig = () => {
    const legs = {};
    const legOrder = [];
    const keyed = dests.map((d) => {
      let key = slugify(d.name);
      while (legs[key]) key += "2";
      legs[key] = { name: d.name, color: d.color, soft: softOf(d.color), lat: d.lat, lon: d.lon, norm: null };
      legOrder.push(key);
      return { ...d, key };
    });
    const sorted = [...keyed].sort((a, b) => (a.arrival < b.arrival ? -1 : 1));
    const legForDate = (iso) => {
      let leg = sorted[0].key;
      for (const d of sorted) if (d.arrival <= iso) leg = d.key;
      return leg;
    };
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
        return { ...d, title: `Day ${i + 1} · ${legName}` };
      }),
      packingTemplate: GENERIC_PACKING,
    };
  };

  const create = async () => {
    setBusy(true); setError("");
    try {
      const config = buildConfig();
      // Best-effort cover photo for the first destination; the gradient
      // fallback covers no-key/offline, so failures are silently ignored.
      try {
        const photos = await searchCoverPhotos(`${dests[0].name} ${dests[0].country || ""} travel`);
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
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Step {step} of 4</span>
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

        {step === 4 && (
          <ReviewStep config={buildConfig()} />
        )}

        {error && <p className="text-xs mt-3" style={{ color: ACCENT }}>{error}</p>}

        <button onClick={step === 4 ? create : next} disabled={busy}
          className="mt-5 w-full text-sm font-bold text-white py-3 rounded-full" style={{ backgroundColor: ACCENT }}>
          {busy ? "Creating…" : step === 4 ? "Create trip" : "Continue"}
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

function ReviewStep({ config }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: INK }}>{config.title}</h1>
      <p className="text-xs mb-4" style={{ color: MUTED }}>
        {config.days.length} days · {config.legOrder.map((k) => config.legs[k].name).join(" → ")} · {config.currency}
        {config.homeCurrency ? ` (+${config.homeCurrency})` : ""}
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
