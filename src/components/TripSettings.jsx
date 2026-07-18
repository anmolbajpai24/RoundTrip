import { useState } from "react";
import { generateDays, listDates, softOf, slugify, legGradient } from "../lib/tripConfig.js";
import usePlaceSearch from "../lib/usePlaceSearch.js";
import Spinner from "./Spinner.jsx";
import { searchCoverPhotos, trackDownload, asCover, unsplashEnabled } from "../lib/unsplash.js";
import { CURRENCIES } from "../data/currencies.js";
import { DEST_COLORS } from "../theme.js";
import { getSession } from "../lib/session.js";
import { confirmDialog } from "./dialogs.jsx";
import Sheet from "./ui/Sheet.jsx";
import Button from "./ui/Button.jsx";
import Field, { Input, Select, FormStack, FieldRow } from "./ui/Field.jsx";
import Toggle from "./ui/Toggle.jsx";
import SwatchPicker from "./ui/SwatchPicker.jsx";
import Icon from "./ui/icons.jsx";
import BackupControls from "./BackupControls.jsx";
import s from "./TripSettings.module.css";

const MAX_TRIP_DAYS = 60;

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
  const [addingDest, setAddingDest] = useState(false);
  const { results, searching } = usePlaceSearch(query);

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
      [key]: { name: place.name, color: DEST_COLORS[Object.keys(l).length % DEST_COLORS.length], soft: softOf(DEST_COLORS[Object.keys(l).length % DEST_COLORS.length]), lat: place.lat, lon: place.lon, norm: null },
    }));
    setLegOrder((o) => [...o, key]);
    setQuery("");
    setAddingDest(false);
  };

  const save = (requestClose) => {
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
    requestClose();
  };

  const pickCovers = async () => {
    setCoverBusy(true);
    try { setCoverChoices(await searchCoverPhotos(`${legs[uniqueLegKeys[0]]?.name || title} travel`)); }
    catch { setCoverChoices([]); }
    setCoverBusy(false);
  };

  return (
    <Sheet onClose={onClose} label="Trip settings">
      {(requestClose) => (
        <>
          <h2 className={s.title}>Trip settings</h2>

          <FormStack>
            <Field label="Trip name">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
            </Field>

            <div>
              <FieldRow>
                <Field label="First day">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Last day">
                  <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
              </FieldRow>
              {(startDate !== config.startDate || endDate !== config.endDate) && (
                <p className={s.dateNote}>
                  Changing dates re-generates the day list. Notes and outfits on removed dates are kept and come back if the dates return.
                </p>
              )}
            </div>

            {/* Money — one grouped hairline card with keyed rows */}
            <div>
              <div className={s.sectionLabelTight}>Money</div>
              <div className={s.groupCard}>
                <div className={s.groupRow}>
                  <span className={s.rowKey}>Currency</span>
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className={s.rowControl}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                  </Select>
                </div>
                <div className={s.groupRow}>
                  <span className={s.rowKey}>Second</span>
                  <span className={s.rowSpacer} />
                  <Toggle checked={homeOn} onChange={setHomeOn} />
                </div>
                {homeOn && (
                  <div className={s.groupRow}>
                    <span className={s.rowKey}>Home</span>
                    <Select value={homeCurrency} onChange={(e) => setHomeCurrency(e.target.value)} className={s.rowControl}>
                      {CURRENCIES.filter((c) => c.code !== currency).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </Select>
                    <Input value={homeRate} onChange={(e) => setHomeRate(e.target.value)} inputMode="decimal"
                      placeholder={`1 ${currency} = ?`} aria-label="Conversion rate" className={s.rowRate} />
                  </div>
                )}
                <div className={s.groupRow}>
                  <span className={s.rowKey}>Budget</span>
                  <Input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal"
                    placeholder="Optional — no bar when empty" aria-label={`Budget in ${currency}`} className={s.rowControl} />
                </div>
              </div>
            </div>
          </FormStack>

          <div className={s.sectionLabel}>Cover</div>
          <div className={s.coverRow}>
            <span className={s.coverThumb} style={cover?.url
              ? { backgroundImage: `url("${cover.url}")`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: legGradient({ legs, legOrder }) }} />
            <span className={s.coverBody}>
              <span className={s.coverTitle}>{cover?.author ? `Photo · ${cover.author}` : "Destination colours"}</span>
              <span className={s.coverSub}>Shows on the trips list and the trip header.</span>
            </span>
            {unsplashEnabled && (
              <button onClick={pickCovers} disabled={coverBusy} className={s.linkAccent}>
                {coverBusy ? "Searching…" : "Change"}
              </button>
            )}
            {cover && (
              <button onClick={() => { setCover(null); setCoverChoices(null); }} className={s.linkMuted}>Reset</button>
            )}
          </div>
          {coverChoices !== null && (
            coverChoices.length === 0 ? (
              <p className={s.hint}>No photos found — the colour gradient will be used.</p>
            ) : (
              <div className={s.coverGrid}>
                {coverChoices.map((p, i) => (
                  <button key={i} onClick={() => { setCover(asCover(p)); trackDownload(p); }}
                    className={[s.coverChoice, cover?.url === p.url && s.coverChoiceSel].filter(Boolean).join(" ")}>
                    <img src={p.thumb} alt={`Photo by ${p.author}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )
          )}
          {!unsplashEnabled && (
            <p className={s.hint}>Covers use your destination colours. Add an Unsplash key to pick real photos — see README.</p>
          )}

          <div className={s.sectionLabel}>Destinations</div>
          <div className={s.legList}>
            {uniqueLegKeys.map((key) => {
              const L = legs[key];
              if (!L) return null;
              return (
                <div key={key} className={s.legRow}>
                  <div className={s.legHead}>
                    <span className={s.legDot} style={{ "--c": L.color }} />
                    <Input value={L.name} onChange={(e) => renameLeg(key, e.target.value)} maxLength={30} className={s.legName} />
                    <button onClick={() => removeLeg(key)} aria-label={`Remove ${L.name}`} className={s.legRemove}>
                      <Icon name="x" size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                  <div className={s.legSwatches}>
                    <SwatchPicker colors={DEST_COLORS} value={L.color} onChange={(c) => recolorLeg(key, c)} />
                  </div>
                </div>
              );
            })}
            {/* add lives INSIDE the destinations card, as its last row */}
            <div className={s.addLegRow}>
              {addingDest ? (
                <label className={s.addSearch}>
                  <Icon name="search" size={14} strokeWidth={1.8} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
                    placeholder="Search a city…" className={s.addInput} />
                </label>
              ) : (
                <button onClick={() => setAddingDest(true)} className={s.addLegBtn}>
                  <Icon name="plus" size={12} strokeWidth={2} /> Add a destination
                </button>
              )}
            </div>
          </div>
          {searching && <p className={s.searching}><Spinner size={14} /> Searching…</p>}
          {results.map((r, i) => (
            <button key={i} onClick={() => addLeg(r)} className={s.result}>
              <span className={s.resultName}>{r.name}</span>
              <span className={s.resultWhere}> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
            </button>
          ))}
          <p className={s.assignHint}>Assign a day to a destination from the itinerary's day editor.</p>

          {error && <p className={s.error}>{error}</p>}

          <div className={s.actions}>
            <Button full onClick={() => save(requestClose)}>Save</Button>
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
          </div>

          <div className={s.sectionLabel}>Backup</div>
          <BackupControls />

          <div className={s.dangerLabel}>Danger</div>
          {memberCount > 1 ? (
            <button
              onClick={async () => { if (await confirmDialog({ title: "Leave this trip?", message: "You'll lose access to it, but it stays for everyone else on it.", confirmLabel: "Leave trip", danger: true })) onLeave?.(); }}
              className={s.dangerCard}>
              <span className={s.dangerBody}>
                <span className={s.dangerTitle}>Leave this trip</span>
                <span className={s.dangerSub}>The trip stays for everyone else on it.</span>
              </span>
              <Icon name="chev" size={14} strokeWidth={1.8} />
            </button>
          ) : (
            <button
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Delete this trip?",
                  message: "This permanently removes its itinerary, outfits, packing, budget, bookings and documents. This can't be undone.",
                  confirmLabel: "Delete forever", danger: true,
                  typeToConfirm: getSession()?.code || null,
                });
                if (ok) onDelete?.();
              }}
              className={s.dangerCard}>
              <span className={s.dangerBody}>
                <span className={s.dangerTitle}>Delete this trip</span>
                <span className={s.dangerSub}>For everyone, forever. Only you see this — you made the trip.</span>
              </span>
              <Icon name="chev" size={14} strokeWidth={1.8} />
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
