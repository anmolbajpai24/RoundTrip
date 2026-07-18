import { useEffect, useRef, useState } from "react";
import { useTripConfig, dateLabel, weekday, defaultDay, findDay, todayISO } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { compressImage, compressImageToBlob } from "../lib/image.js";
import { outfitForDay, visibleToOthers, hasPhoto } from "../lib/closet.js";
import { uploadOutfitPhoto, deleteOutfitPhoto } from "../lib/outfitPhotos.js";
import { confirmDialog } from "../components/dialogs.jsx";
import { loadBasePhoto, saveBasePhoto, generateTryOn } from "../lib/tryon.js";
import { FEATURES } from "../appConfig.js";
import DayStrip from "../components/DayStrip.jsx";
import Avatar from "../components/Avatar.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import OutfitImage from "../components/OutfitImage.jsx";
import OutfitGallery from "../components/OutfitGallery.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import s from "./OutfitsTab.module.css";

const VIEWS = [
  { id: "closet", label: "Closet" },
  { id: "day", label: "Day" },
  { id: "alldays", label: "All days" },
];

// Outfit planner: three views under one segmented control (Closet, Day,
// All days) so photos stay big. Upload outfits into your closet, then assign
// each one to days — or work day-first; both write the same closet.
export default function OutfitsTab({ closetsAll, setClosetsAll, membersById, members, myId, initialDay }) {
  const config = useTripConfig();
  const [view, setView] = useState(initialDay ? "day" : "closet");
  const [selected, setSelected] = useState(() => initialDay || defaultDay(config));
  const day = findDay(config, selected);
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

  const openDay = (d) => { setSelected(d); setChoosing(false); setView("day"); };

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

  const mineTodayId = myCloset.days[dk];
  const mineToday = outfitForDay(myCloset, dk);
  const others = (members || []).filter((m) => m.user_id !== myId);
  const editingItem = editingId ? myCloset.items[editingId] : null;
  const today = todayISO();

  // Short day chips for a closet card, e.g. "Fri 16 Aug".
  const daysOfItem = (id) => config.days.filter((d) => myCloset.days[d.date] === id);
  // First day an item is worn — the picker's "worn …" caption.
  const firstWorn = (id) => daysOfItem(id)[0];

  // Anything to look at in the gallery? (mine, or a trip-mate's visible outfit)
  const anyViewable = myItems.length > 0 ||
    others.some((m) => Object.values(closetsAll[m.user_id]?.items || {}).some((it) => it && visibleToOthers(it)));

  return (
    <div>
      <div className={s.topRow}>
        <Segmented value={view} onChange={(v) => { setView(v); setChoosing(false); }} options={VIEWS} />
        <span className={s.gallerySpacer} />
        {anyViewable && (
          <button onClick={() => setGalleryOpen(true)} className={s.galleryLink}>
            <Icon name="image" size={13} /> Gallery
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className={s.hiddenFile} onChange={onFile} />

      {/* ---- CLOSET ---- */}
      {view === "closet" && (
        <>
          <div className={s.closetGrid}>
            {myItems.map(([id, item]) => {
              const chips = daysOfItem(id);
              return (
                <button key={id} onClick={() => setEditingId(id)} className={s.card}>
                  <div className={s.cardPhoto}>
                    {hasPhoto(item) ? (
                      <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.fillImg} />
                    ) : (
                      <div className={s.cardPh}><Icon name="image" size={18} /></div>
                    )}
                    {item.visibility === "private" && (
                      <span className={s.onlyMe}><Icon name="lock" size={9} strokeWidth={2} /> Only me</span>
                    )}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.cardName}>{item.desc || (item.visibility === "private" ? "Not shared with the trip" : "Untitled outfit")}</div>
                    {chips.length ? (
                      <div className={s.cardChips}>
                        {chips.map((d) => <span key={d.date} className={s.dayChip}>{weekday(d.date)} {dateLabel(d.date)}</span>)}
                      </div>
                    ) : (
                      <span className={s.noDay}>No day yet</span>
                    )}
                  </div>
                </button>
              );
            })}
            <button onClick={() => !busy && pickFile((photo) => addOutfit(photo))} disabled={busy}
              className={[s.addTile, photoError && s.addTileError].filter(Boolean).join(" ")}>
              {photoError ? (
                <>
                  <span className={s.addTitleError}>Upload didn't finish</span>
                  <span className={s.addSub}>The photo is still on your phone — tap to retry.</span>
                </>
              ) : busy ? (
                <>
                  <span className={s.addTitle}>Uploading…</span>
                  <span className={s.addSub}>a few seconds</span>
                  <span className={s.addProgress}><span /></span>
                </>
              ) : (
                <>
                  <Icon name="camera" size={20} />
                  <span className={s.addTitle}>Add an outfit</span>
                  <span className={s.addSub}>Photograph it laid out on the bed — whole outfit in frame.</span>
                </>
              )}
            </button>
          </div>
          {myItems.length === 0 && (
            <p className={s.emptyNote}>Your closet is empty — add an outfit, then choose its days.</p>
          )}

          {/* Base photo for "See it on me" — private to this member */}
          {FEATURES.tryOn && (
            <>
              <div className={s.sectionLabelRow}><span className={s.sectionLabel}>Seeing outfits on you</span></div>
              <div className={s.tryonCard}>
                {basePhoto?.photo ? (
                  <img src={basePhoto.photo} alt="My photo" className={s.tryonThumb} />
                ) : (
                  <span className={s.tryonThumbPh}><Icon name="camera" size={17} /></span>
                )}
                <span className={s.tryonBody}>
                  <span className={s.tryonTitle}>{basePhoto ? "My photo" : "Add a photo of you"}</span>
                  <span className={s.tryonSub}>For trying outfits on. Only you can ever see it.</span>
                </span>
                <button onClick={() => pickFile((p) => setMyBasePhoto(p), { raw: true })} disabled={busy} className={s.linkAccent}>
                  {basePhoto ? "Replace" : "Add"}
                </button>
                {basePhoto && <button onClick={() => setMyBasePhoto(null)} className={s.linkMuted}>Remove</button>}
              </div>
            </>
          )}
        </>
      )}

      {/* ---- DAY ---- */}
      {view === "day" && (
        <>
          <DayStrip selected={dk} onSelect={openDay} />

          <div className={s.sectionLabelRow}>
            <span className={s.sectionLabel}>Your outfit</span>
            <span className={s.sectionMeta}>{weekday(dk)} {dateLabel(dk)} · {day.title}</span>
          </div>

          {mineToday ? (
            <div className={s.dayCard}>
              <div className={s.dayThumb}>
                <OutfitPhoto key={`${mineTodayId}:${dk}`} item={mineToday} alt={`Outfit for ${dateLabel(dk)}`} mine />
              </div>
              <div className={s.dayDetails}>
                <PersonBadge member={membersById[myId]} size="xs" />
                {mineToday.desc && <p className={s.dayDesc}>{mineToday.desc}</p>}
                <span className={s.daySpacer} />
                <div className={s.actionRow}>
                  <button onClick={() => setChoosing(true)} className={s.linkAccent}>Change</button>
                  <button onClick={() => setEditingId(mineTodayId)} className={s.linkAccent}>Edit</button>
                  <button onClick={() => unassignDay(dk)} className={s.linkMuted}>Remove from day</button>
                </div>
              </div>
            </div>
          ) : (
            <div className={s.emptyCard}>
              <div className={s.emptyTitle}>Nothing to wear yet.</div>
              <div className={s.emptyBody}>Plan it now — a laid-out outfit photo keeps the morning simple.</div>
              <div className={s.emptyActions}>
                <Button icon="camera" onClick={() => pickFile((photo) => addOutfit(photo, dk))} disabled={busy}>
                  {busy ? "Saving…" : "Upload new"}
                </Button>
                {myItems.length > 0 && (
                  <Button variant="tonal" onClick={() => setChoosing(true)}>From closet</Button>
                )}
              </div>
            </div>
          )}
          {photoError && <p className={s.error}>{photoError}</p>}

          {/* Closet picker strip for this day */}
          {choosing && (
            <>
              <div className={s.sectionLabelRow}>
                <span className={s.sectionLabel}>From your closet</span>
                <span className={s.sectionMeta}>tap one to wear it {weekday(dk)} {dateLabel(dk)}</span>
              </div>
              <div className={s.pickerStrip}>
                {myItems.map(([id, item]) => {
                  const worn = firstWorn(id);
                  return (
                    <button key={id} onClick={() => { assignDay(dk, id); setChoosing(false); }}
                      className={[s.pickerCard, id === mineTodayId && s.pickerCardActive].filter(Boolean).join(" ")}>
                      <div className={s.pickerPhoto}>
                        {hasPhoto(item) ? (
                          <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.fillImg} />
                        ) : (
                          <div className={s.cardPh}><Icon name="image" size={14} /></div>
                        )}
                        {item.visibility === "private" && (
                          <span className={s.pickerLock}><Icon name="lock" size={8} strokeWidth={2.2} /></span>
                        )}
                      </div>
                      <div className={s.pickerBody}>
                        <span className={s.pickerName}>{item.desc || "Outfit"}</span>
                        <span className={s.pickerWorn}>{worn ? `worn ${weekday(worn.date)} ${dateLabel(worn.date)}` : "free"}</span>
                      </div>
                    </button>
                  );
                })}
                <button onClick={() => pickFile((photo) => addOutfit(photo, dk))} disabled={busy} aria-label="Upload a new outfit" className={s.pickerAdd}>
                  <Icon name="plus" size={15} strokeWidth={1.8} />
                </button>
              </div>
              <p className={s.pickerHint}>Wearing it twice is allowed — travellers repeat outfits.</p>
            </>
          )}

          {/* Other members' outfits — read-only, respecting per-outfit privacy */}
          {others.length > 0 && (
            <div className={s.sectionLabelRow}><span className={s.sectionLabel}>Everyone else</span></div>
          )}
          {others.map((m) => {
            const o = outfitForDay(closetsAll[m.user_id], dk);
            const shown = o && visibleToOthers(o);
            if (shown && hasPhoto(o)) {
              return (
                <button key={m.user_id} onClick={() => setGalleryOpen(true)} className={s.otherCard}>
                  <div className={s.otherThumb}>
                    <OutfitImage item={o} alt={`${m.name}'s outfit`} className={s.fillImg} />
                  </div>
                  <span className={s.otherBody}>
                    <PersonBadge member={m} size="xs" />
                    {o.desc && <span className={s.otherDesc}>{o.desc}</span>}
                  </span>
                  <span className={s.otherIcon}><Icon name="arrow" size={13} strokeWidth={2} /></span>
                </button>
              );
            }
            return (
              <div key={m.user_id} className={s.otherCard}>
                <span className={s.otherAvatar}><Avatar name={m.name} color={m.color} size="xs" /></span>
                {o && !shown ? (
                  <>
                    <span className={s.otherNote}>{m.name} is keeping this outfit private.</span>
                    <span className={s.otherIcon}><Icon name="lock" size={12} strokeWidth={2} /></span>
                  </>
                ) : (
                  <span className={s.otherNoteQuiet}>{m.name} hasn't planned this day yet.</span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ---- ALL DAYS ---- */}
      {view === "alldays" && (
        <>
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
                <button key={d.date} onClick={() => openDay(d.date)} className={s.gridTile} style={{ "--c": Lg.color || "var(--ink-faint)" }}>
                  <span className={s.gridHead}>
                    <span className={s.gridDate}>{weekday(d.date)} {dateLabel(d.date)}</span>
                    {d.date === today && <span className={s.gridToday} />}
                  </span>
                  <span className={s.gridMid}>
                    {hasPhoto(o) ? (
                      <span className={s.gridThumb}>
                        <OutfitImage item={o} alt="" className={s.fillImg} />
                      </span>
                    ) : (
                      <Icon name={o?.desc ? "image" : "plus"} size={15} strokeWidth={1.8} />
                    )}
                  </span>
                  <span className={s.gridDots}>
                    {otherDots.map((m) => <span key={m.user_id} className={s.gridDot} style={{ backgroundColor: m.color }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={s.legend}>
            <span className={s.legendDot} />
            <span className={s.legendText}>dots = trip-mates with an outfit you can see that day</span>
          </div>
        </>
      )}

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
      <OutfitImage item={item} src={onMe && t ? t : undefined} alt={alt} className={s.fillImg} />
      {t && (
        <button onClick={(e) => { e.stopPropagation(); setOnMe(!onMe); }} className={s.flipBtn}>
          <Icon name={onMe ? "hanger" : "flip"} size={9} strokeWidth={2} /> {onMe ? "Outfit" : mine ? "On me" : "On them"}
        </button>
      )}
    </div>
  );
}

// Bottom-sheet editor for one closet outfit. No save button — every change
// lands instantly, and the header label says so.
function OutfitEditor({ item, itemId, busy, config, daysMap, onToggleDay, onSaveDesc, onSetVisibility, onReplacePhoto, onDelete, onClose,
  basePhoto, onAddBasePhoto, tryOnBusy, tryOnError, onTryOn, onRemoveTryOn }) {
  const [desc, setDesc] = useState(item.desc || "");
  const isPrivate = item.visibility === "private";

  return (
    <Sheet onClose={onClose} label="Your outfit">
      <div className={s.editorHead}>
        <h2 className={s.editorTitle}>{item.desc || "Your outfit"}</h2>
        <span className={s.editorSaves}>Saves as you go</span>
      </div>

      <div className={s.editorPhoto}>
        {hasPhoto(item) ? (
          <OutfitImage item={item} alt={item.desc || "Outfit"} className={s.fillImg} />
        ) : (
          <div className={s.editorPh}><Icon name="image" size={24} /></div>
        )}
        <button onClick={onReplacePhoto} disabled={busy} className={s.replacePill}>
          <Icon name="camera" size={10} strokeWidth={1.8} /> {busy ? "Saving…" : "Replace"}
        </button>
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel}>What it is</label>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => onSaveDesc(desc)}
          placeholder="e.g. Black tee, olive chinos, rain jacket" className={s.descInput} />
      </div>

      <div className={s.visRow}>
        <span className={s.fieldLabel}>Who sees it</span>
        <Segmented
          value={isPrivate ? "private" : "trip"}
          onChange={(v) => onSetVisibility(v)}
          options={[{ id: "trip", label: "Trip-mates" }, { id: "private", label: "Only me", icon: "lock" }]}
        />
      </div>

      <div className={s.field}>
        <label className={s.fieldLabel}>Wear it on</label>
        <div className={s.dayGrid}>
          {config.days.map((d) => {
            const assignedId = daysMap[d.date];
            const checked = assignedId === itemId;
            const taken = assignedId && !checked;
            return (
              <button key={d.date} onClick={() => onToggleDay(d.date)}
                aria-pressed={checked}
                className={[s.dayCell, checked && s.dayCellOn, taken && s.dayCellTaken].filter(Boolean).join(" ")}>
                <Icon name={checked ? "check" : taken ? "swap" : "plus"} size={10} strokeWidth={checked ? 2.4 : 2} />
                {weekday(d.date)} {dateLabel(d.date)}
              </button>
            );
          })}
        </div>
        <p className={s.fieldHint}>✓ assigned · ⇄ that day belongs to another outfit — tapping swaps it to this one · + free.</p>
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

      <div className={s.deleteRow}>
        <button onClick={onDelete} className={s.deleteLink}>Delete outfit</button>
        <span className={s.deleteHint}>Days it was assigned to will be cleared.</span>
      </div>
    </Sheet>
  );
}
