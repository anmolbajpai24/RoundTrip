import { useEffect, useRef, useState } from "react";
import { useTripConfig, dateLabel, weekday, defaultDay, findDay, softBg } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { compressImage, compressImageToBlob } from "../lib/image.js";
import { outfitForDay, visibleToOthers, hasPhoto } from "../lib/closet.js";
import { uploadOutfitPhoto, deleteOutfitPhoto } from "../lib/outfitPhotos.js";
import { confirmDialog } from "../components/dialogs.jsx";
import { loadBasePhoto, saveBasePhoto, generateTryOn } from "../lib/tryon.js";
import { FEATURES } from "../appConfig.js";
import SectionTitle from "../components/SectionTitle.jsx";
import LegChip from "../components/LegChip.jsx";
import DayStrip from "../components/DayStrip.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import OutfitImage from "../components/OutfitImage.jsx";
import OutfitGallery from "../components/OutfitGallery.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import { TextArea } from "../components/ui/Field.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import s from "./OutfitsTab.module.css";

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
  const [photoError, setPhotoError] = useState("");
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
  const deleteItem = async (id) => {
    const ok = await confirmDialog({
      title: "Delete this outfit?",
      message: "Days it was assigned to will be cleared.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    const items = { ...myCloset.items };
    const gone = items[id];
    delete items[id];
    const days = Object.fromEntries(Object.entries(myCloset.days).filter(([, v]) => v !== id));
    commit({ ...myCloset, items, days }, [[`outfit-item:${id}`, null], ["outfit-days", days]]);
    deleteOutfitPhoto(gone?.photoPath);
    setEditingId(null);
  };
  const addOutfit = (photoPath, assignTo) => {
    const id = crypto.randomUUID();
    const item = { photoPath, desc: "", visibility: "trip", createdAt: new Date().toISOString() };
    const items = { ...myCloset.items, [id]: item };
    if (assignTo) {
      const days = { ...myCloset.days, [assignTo]: id };
      commit({ ...myCloset, items, days }, [[`outfit-item:${id}`, item], ["outfit-days", days]]);
    } else {
      commit({ ...myCloset, items }, [[`outfit-item:${id}`, item]]);
      setEditingId(id); // straight into the editor to pick days
    }
  };
  const replacePhoto = (id, item, photoPath) => {
    const old = item.photoPath;
    const { photo: _legacy, ...rest } = item; // drop any legacy base64 on replace
    saveItem(id, { ...rest, photoPath });
    if (old && old !== photoPath) deleteOutfitPhoto(old);
  };

  // Closet picks upload to Storage and hand back a path; `raw` picks (the
  // private try-on base photo, kv-stored) hand back a data-URL instead.
  const pickFile = (action, opts) => { fileAction.current = { action, ...(opts || {}) }; fileRef.current?.click(); };

  // ---- try-on ----
  const setMyBasePhoto = (photo) => { setBasePhoto(photo ? { photo } : null); saveBasePhoto(photo); };
  const doTryOn = async (id) => {
    // NOTE: try-on still expects a data-URL in item.photo; new-model items only
    // carry photoPath. Before re-enabling FEATURES.tryOn, fetch the blob via
    // outfitPhotos.getOutfitPhotoUrl and pass a data-URL here.
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
    setPhotoError("");
    try {
      if (fileAction.current?.raw) {
        const photo = await compressImage(file);
        fileAction.current.action?.(photo);
      } else {
        const blob = await compressImageToBlob(file);
        const path = await uploadOutfitPhoto(blob);
        fileAction.current?.action?.(path);
      }
    } catch (err) {
      console.error(err);
      setPhotoError(err.message || "Couldn't save the photo — please try again.");
    }
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
      <div className={s.head}>
        <SectionTitle sub={`You've planned ${plannedCount} of ${config.days.length} days`}>Outfit planner</SectionTitle>
        {anyViewable && (
          <button onClick={() => setGalleryOpen(true)} className={s.galleryBtn}>
            <Icon name="image" size={13} /> Gallery
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className={s.hiddenFile} onChange={onFile} />

      {/* ---- My closet ---- */}
      <div className={s.closet}>
        <SectionTitle sub="Upload outfits, then pick which days they're for">My closet</SectionTitle>

        {/* Base photo for "See it on me" — private to this member */}
        {FEATURES.tryOn && (
        <div className={s.baseCard}>
          {basePhoto?.photo ? (
            <img src={basePhoto.photo} alt="My photo" className={s.baseThumb} />
          ) : (
            <div className={s.basePlaceholder}><Icon name="camera" size={20} /></div>
          )}
          <div className={s.baseText}>
            <div className={s.baseTitle}>My photo</div>
            <div className={s.baseSub}>Used for "See it on me" — only you can ever see it.</div>
          </div>
          <div className={s.baseActions}>
            <button onClick={() => pickFile((p) => setMyBasePhoto(p), { raw: true })} disabled={busy} className={s.linkAccent}>{basePhoto ? "Replace" : "Add"}</button>
            {basePhoto && <button onClick={() => setMyBasePhoto(null)} className={s.linkMuted}>Remove</button>}
          </div>
        </div>
        )}

        <div className={s.grid}>
          <button onClick={() => pickFile((photo) => addOutfit(photo))} disabled={busy} className={s.addTile} style={{ "--c": L.color, backgroundColor: softBg(L.color) }}>
            <Icon name="camera" size={22} />
            <span className={s.addLabel}>{busy ? "Saving…" : "Add outfit"}</span>
          </button>
          {myItems.map(([id, item]) => {
            const chips = daysOfItem(id);
            return (
              <button key={id} onClick={() => setEditingId(id)} className={s.tile}>
                {hasPhoto(item) ? (
                  <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.tileImg} />
                ) : (
                  <div className={s.tilePlaceholder}><Icon name="image" size={18} /></div>
                )}
                {item.visibility === "private" && (
                  <span className={s.lockBadge}><Icon name="lock" size={11} strokeWidth={2} /></span>
                )}
                <div className={chips.length ? s.tileDays : s.tileDaysEmpty}>
                  {chips.length ? chips.map((d) => dateLabel(d.date)).join(" · ") : "No day yet"}
                </div>
              </button>
            );
          })}
        </div>
        {myItems.length === 0 && (
          <p className={s.emptyNote}>Your closet is empty — add an outfit, then choose its days.</p>
        )}
        {photoError && <p className={s.error}>{photoError}</p>}
      </div>

      {/* ---- Day planner ---- */}
      <div className={s.section}>
        <SectionTitle>Day by day</SectionTitle>
        <DayStrip selected={dk} onSelect={selectDay} />

        <div className={s.dayCard}>
          <div className={s.dayHead}>
            <span className={s.dayTitle}>{weekday(dk)} {dateLabel(dk)} · {day.title}</span>
            <LegChip leg={day.leg} />
          </div>

          {/* My outfit for this day */}
          <div className={s.dayBody}>
            <div className={s.badgeRow}><PersonBadge member={membersById[myId]} size="xs" /></div>
            {mineToday ? (
              <div>
                {hasPhoto(mineToday) && (
                  <OutfitPhoto key={`${mineTodayId}:${dk}`} item={mineToday} alt={`Outfit for ${dateLabel(dk)}`} mine />
                )}
                {mineToday.desc && <p className={s.desc}>{mineToday.desc}</p>}
                <div className={s.actionRow}>
                  <button onClick={() => setChoosing(true)} className={s.linkAccent}>Change</button>
                  <button onClick={() => setEditingId(mineTodayId)} className={s.linkAccent}>Edit outfit</button>
                  <button onClick={() => unassignDay(dk)} className={s.linkMuted}>Remove from this day</button>
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => pickFile((photo) => addOutfit(photo, dk))} disabled={busy} className={s.uploadZone} style={{ "--c": L.color, backgroundColor: softBg(L.color) }}>
                  <Icon name="camera" size={28} />
                  <span className={s.uploadTitle}>{busy ? "Saving photo…" : "Upload a new outfit for this day"}</span>
                  <span className={s.uploadSub}>Lay it out on the bed &amp; snap it</span>
                </button>
                {myItems.length > 0 && (
                  <Button full variant="tonal" icon="hanger" onClick={() => setChoosing(true)} className={s.chooseBtn}>Choose from closet</Button>
                )}
              </div>
            )}

            {/* Closet picker for this day */}
            {choosing && (
              <div className={s.picker}>
                <div className={s.pickerHead}>
                  <span className={s.pickerLabel}>Pick an outfit for {dateLabel(dk)}</span>
                  <button onClick={() => setChoosing(false)} aria-label="Close" className={s.pickerClose}><Icon name="x" size={14} strokeWidth={2} /></button>
                </div>
                <div className={s.pickerRow}>
                  {myItems.map(([id, item]) => (
                    <button key={id} onClick={() => { assignDay(dk, id); setChoosing(false); }}
                      className={[s.pickerTile, id === mineTodayId && s.pickerTileActive].filter(Boolean).join(" ")}>
                      {hasPhoto(item) ? (
                        <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.pickerImg} />
                      ) : (
                        <div className={s.pickerPlaceholder}><Icon name="image" size={16} /></div>
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
              <div key={m.user_id} className={s.otherRow}>
                <div className={s.badgeRow}><PersonBadge member={m} size="xs" /></div>
                {shown && hasPhoto(o) ? (
                  <OutfitPhoto key={`${m.user_id}:${dk}`} item={o} alt={`${m.name}'s outfit`} />
                ) : (
                  <div className={s.otherEmpty}>
                    {o && !shown ? `${m.name} is keeping this outfit private` : `${m.name} hasn't planned this day yet`}
                  </div>
                )}
                {shown && o.desc && <p className={s.desc}>{o.desc}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: my days, with dots showing who else has an outfit */}
      <div className={s.section}>
        <SectionTitle>All days</SectionTitle>
        <div className={s.grid}>
          {config.days.map((d) => {
            const o = outfitForDay(myCloset, d.date);
            const Lg = config.legs[d.leg] || {};
            const otherDots = (members || []).filter((m) => {
              if (m.user_id === myId) return false;
              const theirs = outfitForDay(closetsAll[m.user_id], d.date);
              return theirs && visibleToOthers(theirs) && hasPhoto(theirs);
            });
            return (
              <button key={d.date} onClick={() => { selectDay(d.date); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={s.gridTile}>
                {hasPhoto(o) ? (
                  <OutfitImage item={o} alt="" className={s.gridImg} />
                ) : (
                  <div className={s.gridPlaceholder} style={{ backgroundColor: softBg(Lg.color) }}><Icon name={o?.desc ? "image" : "plus"} size={16} /></div>
                )}
                {otherDots.length > 0 && (
                  <div className={s.gridDots}>
                    {otherDots.map((m) => <span key={m.user_id} className={s.gridDot} style={{ backgroundColor: m.color }} />)}
                  </div>
                )}
                <div className={s.gridDate}>{dateLabel(d.date)}</div>
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
          onReplacePhoto={() => pickFile((path) => replacePhoto(editingId, editingItem, path))}
          onDelete={() => deleteItem(editingId)}
          onClose={() => { setEditingId(null); setTryOnError(""); }}
          basePhoto={basePhoto}
          onAddBasePhoto={() => pickFile((p) => setMyBasePhoto(p), { raw: true })}
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
  return (
    <div className={s.photoWrap}>
      <OutfitImage item={item} src={onMe && t ? t : undefined} alt={alt} className={s.photo} />
      {t && (
        <button onClick={(e) => { e.stopPropagation(); setOnMe(!onMe); }} className={s.flipBtn}>
          <Icon name={onMe ? "hanger" : "flip"} size={12} /> {onMe ? "Outfit" : mine ? "On me" : "On them"}
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
    <Sheet onClose={onClose} label="Your outfit">
      {(requestClose) => (
        <>
          <div className={s.editorHead}>
            <h2 className={s.editorTitle}>Your outfit</h2>
            <Button size="sm" onClick={requestClose}>Done</Button>
          </div>

          {hasPhoto(item) ? (
            <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.editorPhoto} />
          ) : (
            <div className={s.editorPlaceholder}><Icon name="image" size={24} /></div>
          )}
          <button onClick={onReplacePhoto} disabled={busy} className={s.replaceLink}>{busy ? "Saving…" : "Replace photo"}</button>

          <div className={s.field}>
            <label className={s.fieldLabel}>What it is</label>
            <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => onSaveDesc(desc)} rows={2}
              placeholder="e.g. Black tee, olive chinos, rain jacket, white sneakers" />
          </div>

          <div className={s.field}>
            <label className={s.fieldLabel}>Who can see it</label>
            <Segmented
              value={isPrivate ? "private" : "trip"}
              onChange={(v) => onSetVisibility(v)}
              className={s.visPicker}
              options={[{ id: "trip", label: "Trip-mates" }, { id: "private", label: "Only me", icon: "lock" }]}
            />
          </div>

          {FEATURES.tryOn && (
          <div className={s.field}>
            <label className={s.fieldLabel}>See it on me</label>
            {item.tryOn?.photo && (
              <img src={item.tryOn.photo} alt="This outfit on you" className={s.tryOnImg} />
            )}
            {!basePhoto ? (
              <div>
                <Button full variant="tonal" icon="camera" onClick={onAddBasePhoto} disabled={busy}>Add a photo of yourself first</Button>
                <p className={s.fieldHint}>One photo, reused for every try-on. Only you can ever see it.</p>
              </div>
            ) : (
              <div className={s.tryOnRow}>
                <Button full icon={item.tryOn ? "reload" : "camera"} onClick={onTryOn} disabled={tryOnBusy}>
                  {tryOnBusy ? "Dressing you up…" : item.tryOn ? "Regenerate" : "See it on me"}
                </Button>
                {item.tryOn && !tryOnBusy && (
                  <Button variant="ghost" onClick={onRemoveTryOn}>Remove</Button>
                )}
              </div>
            )}
            {tryOnError && <p className={s.error}>{tryOnError}</p>}
          </div>
          )}

          <div className={s.field}>
            <label className={s.fieldLabel}>Wearing it on</label>
            <div className={s.dayList}>
              {config.days.map((d) => {
                const assignedId = daysMap[d.date];
                const checked = assignedId === itemId;
                const taken = assignedId && !checked;
                return (
                  <button key={d.date} onClick={() => onToggleDay(d.date)}
                    className={[s.dayRow, checked && s.dayRowChecked].filter(Boolean).join(" ")}>
                    <span className={s.dayRowText}>
                      <span className={s.dayRowStrong}>{weekday(d.date)} {dateLabel(d.date)}</span>
                      <span className={s.dayRowSub}> · {d.title}</span>
                    </span>
                    <span className={s.dayRowMark}>
                      {checked ? <Icon name="check" size={14} strokeWidth={2} /> : taken ? "swap" : <Icon name="plus" size={14} strokeWidth={2} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={s.fieldHint}>Tap a day to wear this outfit then — "swap" replaces that day's current outfit.</p>
          </div>

          <button onClick={onDelete} className={s.deleteLink}>Delete this outfit</button>
        </>
      )}
    </Sheet>
  );
}
