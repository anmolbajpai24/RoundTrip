import { useState } from "react";
import { useTripConfig, dateLabel, weekday, todayISO, defaultDay, findDay } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { outfitForDay, visibleToOthers, hasPhoto } from "../lib/closet.js";
import { onColor } from "../theme.js";
import OutfitImage from "../components/OutfitImage.jsx";
import LegChip from "../components/LegChip.jsx";
import RouteLine from "../components/ui/RouteLine.jsx";
import DayStrip from "../components/DayStrip.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import DayWeather from "../components/DayWeather.jsx";
import TripMap from "../components/TripMap.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import Field, { Input, TextArea, FormStack } from "../components/ui/Field.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import s from "./ItineraryTab.module.css";

export default function ItineraryTab({ overrides, setOverrides, notesAll, setNotesAll, closetsAll, membersById, members, myId, weather, goToOutfit, saveConfig, packingItems }) {
  const config = useTripConfig();
  const [selected, setSelected] = useState(() => defaultDay(config));
  const [view, setView] = useState("list"); // list | map
  const day = findDay(config, selected);
  const dk = day.date;

  const ov = overrides[dk] || {};
  const myNotes = notesAll[myId] || {};
  const myNote = myNotes[dk]?.notes || "";

  const [editing, setEditing] = useState(false);   // shared note
  const [draft, setDraft] = useState("");
  const [pEditing, setPEditing] = useState(false); // my note
  const [pDraft, setPDraft] = useState("");
  const [dayEditing, setDayEditing] = useState(false); // day title/plan
  const [dayDraft, setDayDraft] = useState({ title: "", plan: "", leg: "" });

  const selectDay = (d) => { setSelected(d); setEditing(false); setPEditing(false); setDayEditing(false); };

  const startShared = () => { setDraft(ov.notes || ""); setEditing(true); };
  const saveShared = () => {
    const next = { ...overrides, [dk]: { ...ov, notes: draft } };
    setOverrides(next); saveKey("trip-itinerary", next); setEditing(false);
  };

  const startMine = () => { setPDraft(myNote); setPEditing(true); };
  const saveMine = () => {
    const nextMy = { ...myNotes, [dk]: { ...(myNotes[dk] || {}), notes: pDraft } };
    setNotesAll((prev) => ({ ...prev, [myId]: nextMy }));
    saveKey("trip-itinerary-override", nextMy);
    setPEditing(false);
  };

  // Edit this day's title/plan/leg in the shared trip config.
  const startDayEdit = () => { setDayDraft({ title: day.title, plan: day.plan, leg: day.leg }); setDayEditing(true); };
  const saveDayEdit = () => {
    const nextDays = config.days.map((d) =>
      d.date === dk ? { ...d, title: dayDraft.title.trim() || d.title, plan: dayDraft.plan, leg: dayDraft.leg } : d
    );
    saveConfig({ ...config, days: nextDays });
    setDayEditing(false);
  };

  // Everyone else's personal notes for this day.
  const otherNotes = (members || [])
    .filter((m) => m.user_id !== myId && notesAll[m.user_id]?.[dk]?.notes)
    .map((m) => ({ member: m, notes: notesAll[m.user_id][dk].notes }));

  // Everyone's outfit (with a photo) for this day — private outfits only for their owner.
  const outfitPeople = (members || [])
    .map((m) => ({ member: m, outfit: outfitForDay(closetsAll[m.user_id], dk) }))
    .filter((x) => hasPhoto(x.outfit) && (x.member.user_id === myId || visibleToOthers(x.outfit)));

  const myColor = membersById[myId]?.color;
  const routeStops = config.legOrder.map((k) => ({ name: config.legs[k]?.name || k, color: config.legs[k]?.color }));
  const activeLeg = Math.max(0, config.legOrder.indexOf(day.leg));
  const isToday = dk === todayISO();

  return (
    <div>
      <DayStrip selected={dk} onSelect={selectDay} />

      {/* the route spine, coupled to the strip: solid behind, dashed ahead.
          Labels only when they fit — long trips get the bare dotted spine. */}
      <div className={s.routeWrap}>
        <RouteLine stops={routeStops} active={activeLeg} labels={routeStops.length <= 4} />
      </div>

      <div className={s.viewRow}>
        <Segmented
          value={view}
          onChange={setView}
          options={[{ id: "list", label: "List" }, { id: "map", label: "Map" }]}
        />
      </div>

      {view === "map" && <TripMap selected={dk} onSelectDay={selectDay} />}

      {view !== "map" && (
        <>
        <div className={s.dayCard}>
          {saveConfig && !dayEditing && (
            <button onClick={startDayEdit} title="Edit this day" aria-label="Edit this day" className={s.editBtn}>
              <Icon name="pencil" size={15} />
            </button>
          )}
          <div className={s.dayContext}>
            <LegChip leg={day.leg} />
            <span className={s.dayMeta}>{weekday(dk)} {dateLabel(dk)}{isToday ? " · today" : ""}</span>
          </div>
          <h3 className={s.dayTitle}>{day.title}</h3>
          <div>
            {dayEditing ? (
              <div className={s.editor}>
                <FormStack>
                  <Field label="Day title">
                    <Input value={dayDraft.title} onChange={(e) => setDayDraft((d) => ({ ...d, title: e.target.value }))} maxLength={60} />
                  </Field>
                  <Field label="Plan">
                    <TextArea value={dayDraft.plan} onChange={(e) => setDayDraft((d) => ({ ...d, plan: e.target.value }))} rows={3} placeholder="What's happening this day?" />
                  </Field>
                  <Field label="Destination">
                    <div className={s.legPick}>
                      {Object.entries(config.legs).map(([key, leg]) => {
                        const on = dayDraft.leg === key;
                        return (
                          <button key={key} onClick={() => setDayDraft((d) => ({ ...d, leg: key }))}
                            className={[s.legOption, on && s.legOn].filter(Boolean).join(" ")}
                            style={{ "--c": leg.color, "--on": onColor(leg.color) }}>
                            {leg.name}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </FormStack>
                <div className={s.editActions}>
                  <Button size="sm" onClick={saveDayEdit}>Save day</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDayEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className={day.plan ? s.plan : s.planEmpty}>
                {day.plan || "No plan yet — tap the pencil to add one."}
              </p>
            )}

            <DayWeather day={day} weather={weather} packingItems={packingItems} />
          </div>
        </div>

        {/* Outfits for the day — page-level, outside the card */}
        <div className={s.sectionLabel}>Outfits for the day</div>
        {outfitPeople.length > 0 ? (
          <div className={s.outfitRow}>
            {outfitPeople.map(({ member, outfit }) => (
              <button key={member.user_id} onClick={() => goToOutfit(dk)} className={s.outfitTile}>
                <div className={s.outfitPhoto}>
                  <OutfitImage item={outfit} alt="" className={s.outfitImg} />
                </div>
                <div className={s.outfitBody}>
                  <span className={s.outfitWho} style={{ "--c": member.color }}>
                    <span className={s.outfitDot} />{member.user_id === myId ? "You" : member.name}
                  </span>
                  {outfit.desc && <span className={s.outfitDesc}>{outfit.desc}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => goToOutfit(dk)} className={s.outfitEmpty}>
            No outfits planned for this day yet — plan one <Icon name="arrow" size={11} strokeWidth={2} />
          </button>
        )}

        <div className={s.notes}>
          <div className={s.notesHead}>
            <span className={s.sectionLabelInline}>Notes</span>
            <span className={s.notesSpacer} />
            <button onClick={ov.notes ? startMine : startShared} className={s.notesAdd}>
              <Icon name="plus" size={11} strokeWidth={2} /> Add
            </button>
          </div>

              {/* Shared note — everyone */}
              <div className={s.noteCard}>
                <div className={s.noteHead}>
                  <span className={s.kicker}>Shared · anyone can edit</span>
                  {!editing && (
                    <button onClick={startShared} className={s.noteAction}>{ov.notes ? "Edit" : "Add"}</button>
                  )}
                </div>
                {editing ? (
                  <div className={s.noteEditor}>
                    <TextArea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Train times, addresses, bookings everyone needs…" />
                    <div className={s.editActions}>
                      <Button size="sm" onClick={saveShared}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className={ov.notes ? s.noteText : s.noteEmpty}>{ov.notes || "Nothing shared yet."}</p>
                )}
              </div>

              {/* My note */}
              <div className={[s.noteCard, (myNote || pEditing) && s.noteMine].filter(Boolean).join(" ")} style={{ "--c": myColor || "var(--border)" }}>
                <div className={s.noteHead}>
                  <PersonBadge member={membersById[myId]} size="xs" />
                  {!pEditing && (
                    <button onClick={startMine} className={s.noteAction}>{myNote ? "Edit" : "Add mine"}</button>
                  )}
                </div>
                {pEditing ? (
                  <div className={s.noteEditor}>
                    <TextArea value={pDraft} onChange={(e) => setPDraft(e.target.value)} rows={3} placeholder="Your own plan for this day (e.g. solo sightseeing)…" />
                    <div className={s.editActions}>
                      <Button size="sm" onClick={saveMine}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className={myNote ? s.noteText : s.noteEmpty}>
                    {myNote || "Just for you — add your own plan for days you split up."}
                  </p>
                )}
              </div>

              {/* Other members' notes (read-only) */}
              {otherNotes.map(({ member, notes }) => (
                <div key={member.user_id} className={[s.noteCard, s.noteOther].join(" ")}>
                  <div className={s.noteHead}><PersonBadge member={member} size="xs" /></div>
                  <p className={s.noteText}>{notes}</p>
                </div>
              ))}
        </div>
        </>
      )}
    </div>
  );
}
