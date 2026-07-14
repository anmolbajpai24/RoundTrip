import { useEffect, useRef, useState } from "react";
import { useTripConfig, dateLabel, weekday, defaultDay, findDay, softBg } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { compressImage } from "../lib/image.js";
import { outfitForDay, visibleToOthers } from "../lib/closet.js";
import { loadBasePhoto, saveBasePhoto, generateTryOn } from "../lib/tryon.js";
import { FEATURES } from "../appConfig.js";
import SectionTitle from "../components/SectionTitle.jsx";
import LegChip from "../components/LegChip.jsx";
import DayStrip from "../components/DayStrip.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import OutfitGallery from "../components/OutfitGallery.jsx";

// Outfit planner: upload outfits into your closet first, then assign each one
// to one or more days (or work day-first — both write the same closet).
export default function OutfitsTab({ closetsAll, setClosetsAll, membersById, members, myId, initialDay }) {
  const config = useTripConfig();
  const [selected, setSelected] = useState(() => initialDay || defaultDay(config));
  const day = findDay(config, selected);
  const L = config.legs[day.leg] || {};
  const dk = day.date;

  const myCloset = closetsAll[myId] || { items: {}, days: {} };
  const myItems = Object.entries(myCloset.items || {})
    .sort((a, b) => (b[1]?.createdAt || "").localeCompare(a[1]?.createdAt || ""));

  const [editingId, setEditingId] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const fileAction = useRef(null); // what to do with the next picked photo

  // Try-on: my private base photo + per-generation status.
  const [basePhoto, setBasePhoto] = useState(null); // { photo } | null
  const [tryOnBusy, setTryOnBusy] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  useEffect(() => { if (FEATURES.tryOn) loadBasePhoto().then((v) => setBasePhoto(v || null)); }, [myId]);

  const selectDay = (d) => { setSelected(d); setChoosing(false); };

  // ---- persistence: update state + queue the matching kv writes together ----
  const commit = (nextCloset, writes) => {
    setClosetsAll((prev) => ({ ...prev, [myId]: nextCloset }));
    for (const [key, value] of writes) saveKey(key, value);
  };
  const saveItem = (id, item) =>
    commit({ ...myCloset, items: { ...myCloset.items, [id]: item } }, [[`outfit-item:${id}`, item]]);
  // Merge a patch against the LATEST item state — used after slow async work
  // (try-on generation) so a desc edit made meanwhile isn't clobbered.
  const patchItem = (id, patch) =>
    setClosetsAll((prev) => {
      const closet = prev[myId] || { items: {}, days: {} };
      const item = closet.items[id];
      if (!item) return prev;
      const next = { ...item, ...patch };
      saveKey(`outfit-item:${id}`, next);
      return { ...prev, [myId]: { ...closet, items: { ...closet.items, [id]: next } } };
    });
  const saveDays = (days) => commit({ ...myCloset, days }, [["outfit-days", days]]);
  const assignDay = (date, id) => saveDays({ ...myCloset.days, [date]: id });
  const unassignDay = (date) => {
    const days = { ...myCloset.days };
    delete days[date];
    saveDays(days);
  };
  const toggleDayForItem = (id, date) =>
    myCloset.days[date] === id ? unassignDay(date) : assignDay(date, id);
  const deleteItem = (id) => {
    if (!window.confirm("Delete this outfit? Days it was assigned to will be cleared.")) return;
    const items = { ...myCloset.items };
    delete items[id];
    const days = Object.fromEntries(Object.entries(myCloset.days).filter(([, v]) => v !== id));
    commit({ ...myCloset, items, days }, [[`outfit-item:${id}`, null], ["outfit-days", days]]);
    setEditingId(null);
  };
  const addOutfit = (photo, assignTo) => {
    const id = crypto.randomUUID();
    const item = { photo, desc: "", visibility: "trip", createdAt: new Date().toISOString() };
    const items = { ...myCloset.items, [id]: item };
    if (assignTo) {
      const days = { ...myCloset.days, [assignTo]: id };
      commit({ ...myCloset, items, days }, [[`outfit-item:${id}`, item], ["outfit-days", days]]);
    } else {
      commit({ ...myCloset, items }, [[`outfit-item:${id}`, item]]);
      setEditingId(id); // straight into the editor to pick days
    }
  };

  const pickFile = (action) => { fileAction.current = action; fileRef.current?.click(); };

  // ---- try-on ----
  const setMyBasePhoto = (photo) => { setBasePhoto(photo ? { photo } : null); saveBasePhoto(photo); };
  const doTryOn = async (id) => {
    const item = myCloset.items[id];
    if (!item?.photo || !basePhoto?.photo || tryOnBusy) return;
    setTryOnError("");
    setTryOnBusy(true);
    try {
      const raw = await generateTryOn(basePhoto.photo, item.photo, item.desc);
      // Recompress the (often large PNG) result to the app's usual JPEG weight.
      const blob = await (await fetch(raw)).blob();
      const photo = await compressImage(blob);
      patchItem(id, { tryOn: { photo, at: new Date().toISOString() } });
    } catch (e) {
      setTryOnError(e.message || "Try-on failed — please try again.");
    }
    setTryOnBusy(false);
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { const photo = await compressImage(file); fileAction.current?.(photo); }
    catch (err) { console.error(err); }
    setBusy(false);
    e.target.value = "";
  };

  const plannedCount = config.days.filter((d) => outfitForDay(myCloset, d.date)).length;
  const mineTodayId = myCloset.days[dk];
  const mineToday = outfitForDay(myCloset, dk);
  const others = (members || []).filter((m) => m.user_id !== myId);
  const editingItem = editingId ? myCloset.items[editingId] : null;

  // Short day chips for a closet card, e.g. "Wed 15".
  const daysOfItem = (id) => config.days.filter((d) => myCloset.days[d.date] === id);

  // Anything to look at in the gallery? (mine, or a trip-mate's visible outfit)
  const anyViewable = myItems.length > 0 ||
    others.some((m) => Object.values(closetsAll[m.user_id]?.items || {}).some((it) => it && visibleToOthers(it)));

  return (
    <div>
      <div className="flex items-start justify-between">
        <SectionTitle sub={`You've planned ${plannedCount} of ${config.days.length} days`}>Outfit planner</SectionTitle>
        {anyViewable && (
          <button onClick={() => setGalleryOpen(true)} className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--ink)" }}>
            🖼 Gallery
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* ---- My closet ---- */}
      <div className="mt-1">
        <SectionTitle sub="Upload outfits, then pick which days they're for">My closet</SectionTitle>

        {/* Base photo for "See it on me" — private to this member */}
        {FEATURES.tryOn && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {basePhoto?.photo ? (
            <img src={basePhoto.photo} alt="My photo" className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: "var(--field)" }}>👤</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold" style={{ color: "var(--ink)" }}>My photo</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>Used for "See it on me" — only you can ever see it.</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => pickFile((p) => setMyBasePhoto(p))} disabled={busy} className="text-xs font-semibold" style={{ color: L.color }}>{basePhoto ? "Replace" : "Add"}</button>
            {basePhoto && <button onClick={() => setMyBasePhoto(null)} className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Remove</button>}
          </div>
        </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => pickFile((photo) => addOutfit(photo))} disabled={busy}
            className="rounded-xl border-2 border-dashed h-32 flex flex-col items-center justify-center gap-1"
            style={{ borderColor: L.color, backgroundColor: softBg(L.color) }}>
            <span className="text-2xl">📸</span>
            <span className="text-[11px] font-bold px-1 text-center" style={{ color: L.color }}>{busy ? "Saving…" : "Add outfit"}</span>
          </button>
          {myItems.map(([id, item]) => {
            const chips = daysOfItem(id);
            return (
              <button key={id} onClick={() => setEditingId(id)} className="rounded-xl overflow-hidden border text-left relative h-32 flex flex-col"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                {item.photo ? (
                  <img src={item.photo} alt={item.desc || "Outfit"} className="w-full flex-1 object-cover min-h-0" />
                ) : (
                  <div className="w-full flex-1 flex items-center justify-center text-lg" style={{ backgroundColor: "var(--field)" }}>📝</div>
                )}
                {item.visibility === "private" && (
                  <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "rgba(29,36,51,0.75)" }}>🔒</span>
                )}
                <div className="px-1.5 py-1 text-[10px] font-semibold truncate" style={{ color: chips.length ? "var(--ink)" : "var(--faint)" }}>
                  {chips.length ? chips.map((d) => dateLabel(d.date)).join(" · ") : "No day yet"}
                </div>
              </button>
            );
          })}
        </div>
        {myItems.length === 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--faint)" }}>Your closet is empty — add an outfit, then choose its days.</p>
        )}
      </div>

      {/* ---- Day planner ---- */}
      <div className="mt-5">
        <SectionTitle>Day by day</SectionTitle>
        <DayStrip selected={dk} onSelect={selectDay} />

        <div className="mt-3 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "var(--divider)" }}>
            <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>{weekday(dk)} {dateLabel(dk)} · {day.title}</span>
            <LegChip leg={day.leg} />
          </div>

          {/* My outfit for this day */}
          <div className="p-4">
            <div className="mb-2"><PersonBadge member={membersById[myId]} size="xs" /></div>
            {mineToday ? (
              <div>
                {mineToday.photo && (
                  <OutfitPhoto key={`${mineTodayId}:${dk}`} item={mineToday} alt={`Outfit for ${dateLabel(dk)}`} mine />
                )}
                {mineToday.desc && <p className="text-sm mt-2" style={{ color: "var(--ink)" }}>{mineToday.desc}</p>}
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setChoosing(true)} className="text-xs font-semibold" style={{ color: L.color }}>Change</button>
                  <button onClick={() => setEditingId(mineTodayId)} className="text-xs font-semibold" style={{ color: L.color }}>Edit outfit</button>
                  <button onClick={() => unassignDay(dk)} className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Remove from this day</button>
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => pickFile((photo) => addOutfit(photo, dk))} disabled={busy}
                  className="w-full rounded-xl border-2 border-dashed py-8 flex flex-col items-center gap-2"
                  style={{ borderColor: L.color, backgroundColor: softBg(L.color) }}>
                  <span className="text-3xl">📸</span>
                  <span className="text-sm font-bold" style={{ color: L.color }}>{busy ? "Saving photo…" : "Upload a new outfit for this day"}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Lay it out on the bed &amp; snap it</span>
                </button>
                {myItems.length > 0 && (
                  <button onClick={() => setChoosing(true)} className="mt-2 w-full text-sm font-bold py-2.5 rounded-xl border"
                    style={{ borderColor: L.color, color: L.color }}>
                    👕 Choose from closet
                  </button>
                )}
              </div>
            )}

            {/* Closet picker for this day */}
            {choosing && (
              <div className="mt-3 rounded-xl border p-2" style={{ borderColor: "var(--divider)", backgroundColor: "var(--field)" }}>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Pick an outfit for {dateLabel(dk)}</span>
                  <button onClick={() => setChoosing(false)} className="text-xs font-semibold" style={{ color: "var(--muted)" }}>✕</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {myItems.map(([id, item]) => (
                    <button key={id} onClick={() => { assignDay(dk, id); setChoosing(false); }}
                      className="flex-shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: id === mineTodayId ? L.color : "var(--border)", borderWidth: id === mineTodayId ? 2 : 1 }}>
                      {item.photo ? (
                        <img src={item.photo} alt={item.desc || "Outfit"} className="w-20 h-20 object-cover" />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>📝</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Other members' outfits — read-only, respecting per-outfit privacy */}
          {others.map((m) => {
            const o = outfitForDay(closetsAll[m.user_id], dk);
            const shown = o && visibleToOthers(o);
            return (
              <div key={m.user_id} className="p-4 border-t" style={{ borderColor: "var(--divider)" }}>
                <div className="mb-2"><PersonBadge member={m} size="xs" /></div>
                {shown && o.photo ? (
                  <OutfitPhoto key={`${m.user_id}:${dk}`} item={o} alt={`${m.name}'s outfit`} />
                ) : (
                  <div className="w-full rounded-xl py-8 text-center text-sm" style={{ backgroundColor: "var(--field)", color: "var(--faint)" }}>
                    {o && !shown ? `${m.name} is keeping this outfit private 🔒` : `${m.name} hasn't planned this day yet`}
                  </div>
                )}
                {shown && o.desc && <p className="text-sm mt-2" style={{ color: "var(--ink)" }}>{o.desc}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: my days, with dots showing who else has an outfit */}
      <div className="mt-5">
        <SectionTitle>All days</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {config.days.map((d) => {
            const o = outfitForDay(myCloset, d.date);
            const Lg = config.legs[d.leg] || {};
            const otherDots = (members || []).filter((m) => {
              if (m.user_id === myId) return false;
              const theirs = outfitForDay(closetsAll[m.user_id], d.date);
              return theirs && visibleToOthers(theirs) && theirs.photo;
            });
            return (
              <button key={d.date} onClick={() => { selectDay(d.date); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-xl overflow-hidden border text-left relative" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                {o?.photo ? (
                  <img src={o.photo} alt="" className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center text-lg" style={{ backgroundColor: softBg(Lg.color) }}>{o?.desc ? "📝" : "＋"}</div>
                )}
                {otherDots.length > 0 && (
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    {otherDots.map((m) => <span key={m.user_id} className="w-2 h-2 rounded-full border border-white" style={{ backgroundColor: m.color }} />)}
                  </div>
                )}
                <div className="px-1.5 py-1 text-[10px] font-semibold" style={{ color: "var(--ink)" }}>{dateLabel(d.date)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Outfit editor ---- */}
      {editingItem && (
        <OutfitEditor
          key={editingId}
          item={editingItem}
          busy={busy}
          config={config}
          daysMap={myCloset.days}
          itemId={editingId}
          onToggleDay={(date) => toggleDayForItem(editingId, date)}
          onSaveDesc={(desc) => saveItem(editingId, { ...editingItem, desc })}
          onSetVisibility={(visibility) => saveItem(editingId, { ...editingItem, visibility })}
          onReplacePhoto={() => pickFile((photo) => saveItem(editingId, { ...editingItem, photo }))}
          onDelete={() => deleteItem(editingId)}
          onClose={() => { setEditingId(null); setTryOnError(""); }}
          basePhoto={basePhoto}
          onAddBasePhoto={() => pickFile((p) => setMyBasePhoto(p))}
          tryOnBusy={tryOnBusy}
          tryOnError={tryOnError}
          onTryOn={() => doTryOn(editingId)}
          onRemoveTryOn={() => patchItem(editingId, { tryOn: null })}
        />
      )}

      {/* ---- Gallery (read-only swipe deck) ---- */}
      {galleryOpen && (
        <OutfitGallery
          closetsAll={closetsAll} members={members} membersById={membersById} myId={myId}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

// A photo that can flip between the flat outfit shot and the generated
// try-on image, when one exists.
function OutfitPhoto({ item, alt, mine }) {
  const [onMe, setOnMe] = useState(false);
  const t = FEATURES.tryOn ? item.tryOn?.photo : null;
  const src = onMe && t ? t : item.photo;
  return (
    <div className="relative">
      <img src={src} alt={alt} className="w-full rounded-xl object-cover" style={{ maxHeight: 380 }} />
      {t && (
        <button onClick={(e) => { e.stopPropagation(); setOnMe(!onMe); }}
          className="absolute bottom-2 right-2 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
          style={{ backgroundColor: "rgba(29,36,51,0.75)" }}>
          {onMe ? "👕 Outfit" : mine ? "👤 On me" : "👤 On them"}
        </button>
      )}
    </div>
  );
}

// Bottom-sheet editor for one closet outfit: photo, description, privacy,
// try-on and which days it's worn. Every control persists immediately.
function OutfitEditor({ item, itemId, busy, config, daysMap, onToggleDay, onSaveDesc, onSetVisibility, onReplacePhoto, onDelete, onClose,
  basePhoto, onAddBasePhoto, tryOnBusy, tryOnError, onTryOn, onRemoveTryOn }) {
  const [desc, setDesc] = useState(item.desc || "");
  const isPrivate = item.visibility === "private";

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto" style={{ backgroundColor: "var(--card)", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>Your outfit</h2>
          <button onClick={onClose} className="text-sm font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: "var(--solid)" }}>Done</button>
        </div>

        {item.photo ? (
          <img src={item.photo} alt={item.desc || "Outfit"} className="w-full rounded-xl object-cover" style={{ maxHeight: 300 }} />
        ) : (
          <div className="w-full rounded-xl py-10 text-center text-2xl" style={{ backgroundColor: "var(--field)" }}>📝</div>
        )}
        <button onClick={onReplacePhoto} disabled={busy} className="mt-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {busy ? "Saving…" : "Replace photo"}
        </button>

        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>What it is</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => onSaveDesc(desc)} rows={2}
            placeholder="e.g. Black tee, olive chinos, rain jacket, white sneakers"
            className="mt-1 w-full text-sm rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: "var(--ink)" }} />
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Who can see it</label>
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => onSetVisibility("trip")} className="flex-1 text-xs font-bold py-2 rounded-full border"
              style={isPrivate ? { borderColor: "var(--border)", color: "var(--muted)" } : { borderColor: "var(--solid)", backgroundColor: "var(--solid)", color: "#FFF" }}>
              👥 Trip-mates
            </button>
            <button onClick={() => onSetVisibility("private")} className="flex-1 text-xs font-bold py-2 rounded-full border"
              style={isPrivate ? { borderColor: "var(--solid)", backgroundColor: "var(--solid)", color: "#FFF" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
              🔒 Only me
            </button>
          </div>
        </div>

        {FEATURES.tryOn && (
        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>See it on me</label>
          {item.tryOn?.photo && (
            <img src={item.tryOn.photo} alt="This outfit on you" className="mt-1.5 w-full rounded-xl object-cover" style={{ maxHeight: 300 }} />
          )}
          {!basePhoto ? (
            <div className="mt-1.5">
              <button onClick={onAddBasePhoto} disabled={busy} className="w-full text-xs font-bold py-2.5 rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                📷 Add a photo of yourself first
              </button>
              <p className="text-[11px] mt-1" style={{ color: "var(--faint)" }}>One photo, reused for every try-on. Only you can ever see it.</p>
            </div>
          ) : (
            <div className="mt-1.5 flex gap-2 items-center">
              <button onClick={onTryOn} disabled={tryOnBusy} className="flex-1 text-xs font-bold py-2.5 rounded-xl text-white" style={{ backgroundColor: "var(--solid)", opacity: tryOnBusy ? 0.6 : 1 }}>
                {tryOnBusy ? "Dressing you up… can take a minute" : item.tryOn ? "↺ Regenerate" : "✨ See it on me"}
              </button>
              {item.tryOn && !tryOnBusy && (
                <button onClick={onRemoveTryOn} className="text-xs font-semibold px-2" style={{ color: "var(--muted)" }}>Remove</button>
              )}
            </div>
          )}
          {tryOnError && <p className="text-[11px] mt-1 font-semibold" style={{ color: "#C0392B" }}>{tryOnError}</p>}
        </div>
        )}

        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Wearing it on</label>
          <div className="mt-1.5 rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {config.days.map((d) => {
              const assignedId = daysMap[d.date];
              const checked = assignedId === itemId;
              const taken = assignedId && !checked;
              return (
                <button key={d.date} onClick={() => onToggleDay(d.date)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left" style={{ borderColor: "var(--divider)", backgroundColor: checked ? "var(--field)" : "transparent" }}>
                  <span className="text-sm min-w-0 truncate" style={{ color: "var(--ink)" }}>
                    <span className="font-semibold">{weekday(d.date)} {dateLabel(d.date)}</span>
                    <span style={{ color: "var(--muted)" }}> · {d.title}</span>
                  </span>
                  <span className="text-xs font-bold flex-shrink-0 ml-2" style={{ color: checked ? "var(--ink)" : "var(--faint)" }}>
                    {checked ? "✓" : taken ? "swap" : "＋"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--faint)" }}>Tap a day to wear this outfit then — "swap" replaces that day's current outfit.</p>
        </div>

        <button onClick={onDelete} className="mt-4 text-xs font-bold" style={{ color: "#C0392B" }}>Delete this outfit</button>
      </div>
    </div>
  );
}
