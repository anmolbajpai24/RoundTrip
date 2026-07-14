import { useState, useEffect, useRef } from "react";
import { generateDays, listDates, softOf, slugify, legGradient } from "../lib/tripConfig.js";
import { searchPlaces } from "../lib/geocode.js";
import { searchCoverPhotos, trackDownload, asCover, unsplashEnabled } from "../lib/unsplash.js";
import { CURRENCIES } from "../data/currencies.js";
import { COLORS } from "../lib/session.js";
import { ACCENT, INK, MUTED } from "../theme.js";

const MAX_TRIP_DAYS = 60;
const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--field)", color: INK };

// Trip settings modal: title, dates, money, destinations. Saving rebuilds the
// day list for the (possibly new) date range while preserving each existing
// day's title/plan; days outside a shrunk range disappear from view but their
// notes/outfits stay in the kv store (and reappear if the range grows back).
export default function TripSettings({ config, onSave, onClose, memberCount = 1, onDelete, onLeave }) {
  const [title, setTitle] = useState(config.title);
  const [startDate, setStartDate] = useState(config.startDate);
  const [endDate, setEndDate] = useState(config.endDate);
  const [currency, setCurrency] = useState(config.currency);
  const [homeOn, setHomeOn] = useState(!!config.homeCurrency);
  const [homeCurrency, setHomeCurrency] = useState(config.homeCurrency || "USD");
  const [homeRate, setHomeRate] = useState(config.homeRate ? String(config.homeRate) : "");
  const [budget, setBudget] = useState(config.budget != null ? String(config.budget) : "");
  const [legs, setLegs] = useState(config.legs);
  const [legOrder, setLegOrder] = useState(config.legOrder);
  const [cover, setCover] = useState(config.cover || null);
  const [coverChoices, setCoverChoices] = useState(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState("");

  // destination search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults(await searchPlaces(query)); } catch { setResults([]); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query]);

  const uniqueLegKeys = [...new Set(legOrder)];

  const renameLeg = (key, name) => setLegs((l) => ({ ...l, [key]: { ...l[key], name } }));
  const recolorLeg = (key, color) => setLegs((l) => ({ ...l, [key]: { ...l[key], color, soft: softOf(color) } }));
  const removeLeg = (key) => {
    if (uniqueLegKeys.length <= 1) { setError("A trip needs at least one destination."); return; }
    setLegOrder((o) => o.filter((k) => k !== key));
    setLegs((l) => { const { [key]: _, ...rest } = l; return rest; });
  };
  const addLeg = (place) => {
    let key = slugify(place.name);
    while (legs[key]) key += "2";
    setLegs((l) => ({
      ...l,
      [key]: { name: place.name, color: COLORS[Object.keys(l).length % COLORS.length], soft: softOf(COLORS[Object.keys(l).length % COLORS.length]), lat: place.lat, lon: place.lon, norm: null },
    }));
    setLegOrder((o) => [...o, key]);
    setQuery(""); setResults([]);
  };

  const save = () => {
    setError("");
    if (!title.trim()) { setError("The trip needs a name."); return; }
    if (!startDate || !endDate || endDate < startDate) { setError("Check the dates."); return; }
    if (listDates(startDate, endDate).length > MAX_TRIP_DAYS) { setError(`Trips are capped at ${MAX_TRIP_DAYS} days.`); return; }
    if (homeOn && !(parseFloat(homeRate) > 0)) { setError("Enter the conversion rate."); return; }

    const fallbackLeg = uniqueLegKeys[0];
    const legForDate = (iso) => {
      const existing = config.days.find((d) => d.date === iso);
      return existing && legs[existing.leg] ? existing.leg : fallbackLeg;
    };
    const days = generateDays(startDate, endDate, legForDate, config.days);

    onSave({
      ...config,
      title: title.trim(),
      startDate, endDate,
      currency,
      homeCurrency: homeOn ? homeCurrency : null,
      homeRate: homeOn ? parseFloat(homeRate) : null,
      budget: parseFloat(budget) > 0 ? parseFloat(budget) : null,
      cover,
      legs,
      legOrder: legOrder.length ? legOrder : uniqueLegKeys,
      days: days.map((d) => (legs[d.leg] ? d : { ...d, leg: fallbackLeg })),
    });
    onClose();
  };

  const label = (t) => <label className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{t}</label>;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm m-4 rounded-2xl p-5 overflow-y-auto" style={{ backgroundColor: "var(--card)", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold mb-4" style={{ color: INK }}>Trip settings</h2>

        {label("Trip name")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40}
          className="mt-1 mb-3 w-full text-sm rounded-xl border px-4 py-2.5" style={inputStyle} />

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            {label("First day")}
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
          </div>
          <div className="flex-1">
            {label("Last day")}
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
          </div>
        </div>
        {(startDate !== config.startDate || endDate !== config.endDate) && (
          <p className="text-[11px] mb-3" style={{ color: "var(--warn-ink)" }}>
            Changing dates re-generates the day list. Notes and outfits on removed dates are kept and come back if the dates return.
          </p>
        )}

        {label("Trip currency")}
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 mb-3 w-full text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        </select>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: INK }}>Second currency</span>
          <button onClick={() => setHomeOn(!homeOn)} className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: homeOn ? "#2E7D4F" : "var(--chip)" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: homeOn ? 22 : 2 }} />
          </button>
        </div>
        {homeOn && (
          <div className="flex gap-2 mb-3">
            <select value={homeCurrency} onChange={(e) => setHomeCurrency(e.target.value)} className="flex-1 text-sm rounded-xl border px-3 py-2.5" style={inputStyle}>
              {CURRENCIES.filter((c) => c.code !== currency).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <input value={homeRate} onChange={(e) => setHomeRate(e.target.value)} inputMode="decimal" placeholder={`1 ${currency} = ?`}
              className="flex-1 text-sm rounded-xl border px-3 py-2.5" style={inputStyle} />
          </div>
        )}

        {label(`Budget in ${currency} (optional)`)}
        <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="No budget bar when empty"
          className="mt-1 mb-4 w-full text-sm rounded-xl border px-4 py-2.5" style={inputStyle} />

        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Cover photo</div>
        <div className="rounded-xl overflow-hidden mb-2 relative" style={{ height: 72 }}>
          <div className="absolute inset-0" style={cover?.url
            ? { backgroundImage: `url("${cover.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: legGradient({ legs, legOrder }) }} />
          {cover?.author && (
            <span className="absolute bottom-1 right-2 text-[9px]" style={{ color: "rgba(255,255,255,0.75)" }}>Photo: {cover.author} / Unsplash</span>
          )}
        </div>
        <div className="flex gap-2 mb-2">
          {unsplashEnabled && (
            <button onClick={async () => {
              setCoverBusy(true);
              try { setCoverChoices(await searchCoverPhotos(`${legs[uniqueLegKeys[0]]?.name || title} travel`)); }
              catch { setCoverChoices([]); }
              setCoverBusy(false);
            }} className="text-xs font-bold px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)", color: INK }}>
              {coverBusy ? "Searching…" : "Choose a photo"}
            </button>
          )}
          {cover && (
            <button onClick={() => { setCover(null); setCoverChoices(null); }} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color: MUTED }}>
              Use colours instead
            </button>
          )}
        </div>
        {coverChoices !== null && (
          coverChoices.length === 0 ? (
            <p className="text-[11px] mb-3" style={{ color: MUTED }}>No photos found — the colour gradient will be used.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {coverChoices.map((p, i) => (
                <button key={i} onClick={() => { setCover(asCover(p)); trackDownload(p); }} className="rounded-lg overflow-hidden" style={{ height: 52, outline: cover?.url === p.url ? "3px solid #C8102E" : "none" }}>
                  <img src={p.thumb} alt={`Photo by ${p.author}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )
        )}
        {!unsplashEnabled && (
          <p className="text-[11px] mb-3" style={{ color: MUTED }}>Covers use your destination colours. Add an Unsplash key to pick real photos — see README.</p>
        )}

        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Destinations</div>
        {uniqueLegKeys.map((key) => {
          const L = legs[key];
          if (!L) return null;
          return (
            <div key={key} className="rounded-xl border p-3 mb-2" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <input value={L.name} onChange={(e) => renameLeg(key, e.target.value)} maxLength={30}
                  className="flex-1 text-sm rounded-lg border px-2.5 py-1.5" style={inputStyle} />
                <button onClick={() => removeLeg(key)} className="text-xs px-1" style={{ color: "var(--faint)" }}>✕</button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => recolorLeg(key, c)} className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: c, outline: L.color === c ? "2px solid var(--ink)" : "none", outlineOffset: 1 }} />
                ))}
              </div>
            </div>
          );
        })}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a destination…"
          className="w-full text-sm rounded-xl border px-4 py-2.5" style={inputStyle} />
        {results.map((r, i) => (
          <button key={i} onClick={() => addLeg(r)} className="w-full text-left rounded-xl border px-3 py-2 mt-1.5 text-sm" style={{ borderColor: "var(--border)", color: INK }}>
            <span className="font-semibold">{r.name}</span>
            <span style={{ color: MUTED }}> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
          </button>
        ))}
        <p className="text-[11px] mt-2" style={{ color: MUTED }}>Assign a day to a destination from the itinerary's ✎ day editor.</p>

        {error && <p className="text-xs mt-3" style={{ color: ACCENT }}>{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={save} className="flex-1 text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: ACCENT }}>Save</button>
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2.5 rounded-full" style={{ color: MUTED }}>Cancel</button>
        </div>

        <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
          {memberCount > 1 ? (
            <button
              onClick={() => { if (window.confirm("Leave this trip? You'll lose access to it, but it stays for everyone else on it.")) onLeave?.(); }}
              className="text-xs font-bold" style={{ color: "#C0392B" }}>
              Leave this trip
            </button>
          ) : (
            <button
              onClick={() => { if (window.confirm("Delete this trip permanently? This removes its itinerary, outfits, packing, budget, bookings and documents for good. This can't be undone.")) onDelete?.(); }}
              className="text-xs font-bold" style={{ color: "#C0392B" }}>
              Delete this trip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
