import { useState } from "react";
import { useTripConfig, dateLabel, weekday, dateRangeLabel, defaultDay, findDay } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import SectionTitle from "../components/SectionTitle.jsx";
import LegChip from "../components/LegChip.jsx";
import DayStrip from "../components/DayStrip.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import DayWeather from "../components/DayWeather.jsx";

export default function ItineraryTab({ overrides, setOverrides, notesAll, setNotesAll, outfitsAll, membersById, members, myId, weather, goToOutfit, saveConfig, packingItems }) {
  const config = useTripConfig();
  const [selected, setSelected] = useState(() => defaultDay(config));
  const day = findDay(config, selected);
  const L = config.legs[day.leg] || {};
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

  // Everyone's outfit (with a photo) for this day.
  const outfitPeople = (members || [])
    .map((m) => ({ member: m, outfit: outfitsAll[m.user_id]?.[dk] }))
    .filter((x) => x.outfit?.photo);

  return (
    <div>
      <SectionTitle sub={`${dateRangeLabel(config)} · tap a day`}>Itinerary</SectionTitle>
      <DayStrip selected={dk} onSelect={selectDay} />

      <div className="mt-3 rounded-2xl overflow-hidden border" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: L.color }}>
          <div className="min-w-0">
            <div className="text-white font-bold text-base truncate">{day.title}</div>
            <div className="text-white text-xs" style={{ opacity: 0.85, fontFamily: "ui-monospace, monospace" }}>
              {weekday(dk)} · {dateLabel(dk)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LegChip leg={day.leg} />
            {saveConfig && !dayEditing && (
              <button onClick={startDayEdit} title="Edit this day" className="text-white text-sm" style={{ opacity: 0.85 }}>✎</button>
            )}
          </div>
        </div>
        <div className="p-4">
          {dayEditing ? (
            <div className="mb-2">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Day title</label>
              <input value={dayDraft.title} onChange={(e) => setDayDraft((d) => ({ ...d, title: e.target.value }))} maxLength={60}
                className="mt-1 mb-3 w-full text-sm rounded-xl border px-3 py-2.5" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Plan</label>
              <textarea value={dayDraft.plan} onChange={(e) => setDayDraft((d) => ({ ...d, plan: e.target.value }))} rows={3}
                placeholder="What's happening this day?"
                className="mt-1 mb-3 w-full text-sm rounded-xl border p-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8A8F98" }}>Destination</label>
              <div className="flex gap-1.5 flex-wrap mt-1 mb-3">
                {Object.entries(config.legs).map(([key, leg]) => (
                  <button key={key} onClick={() => setDayDraft((d) => ({ ...d, leg: key }))}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border"
                    style={{ borderColor: dayDraft.leg === key ? leg.color : "#E5E2DA", backgroundColor: dayDraft.leg === key ? leg.color : "#FFF", color: dayDraft.leg === key ? "#FFF" : "#8A8F98" }}>
                    {leg.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveDayEdit} className="text-xs font-bold text-white px-4 py-2 rounded-full" style={{ backgroundColor: L.color }}>Save day</button>
                <button onClick={() => setDayEditing(false)} className="text-xs font-semibold px-4 py-2 rounded-full" style={{ color: "#8A8F98" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: day.plan ? "#1D2433" : "#B8B5AD" }}>
              {day.plan || "No plan yet — tap ✎ to add one."}
            </p>
          )}

          <DayWeather day={day} weather={weather} legColor={L.color} legSoft={L.soft} packingItems={packingItems} />

          {outfitPeople.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {outfitPeople.map(({ member, outfit }) => (
                <button key={member.user_id} onClick={() => goToOutfit(dk)} className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: "#E5E2DA" }}>
                  <img src={outfit.photo} alt="Outfit" className="w-10 h-10 rounded-lg object-cover" />
                  <PersonBadge member={member} size="xs" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <SectionTitle>Notes</SectionTitle>

            {/* Shared note — everyone */}
            <div className="rounded-xl border p-3 mb-2" style={{ borderColor: "#E5E2DA" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDEAE2", color: "#5A5F6A" }}>Shared · everyone</span>
                {!editing && (
                  <button onClick={startShared} className="text-xs font-semibold" style={{ color: L.color }}>{ov.notes ? "Edit" : "Add"}</button>
                )}
              </div>
              {editing ? (
                <div>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                    placeholder="Train times, addresses, bookings everyone needs…"
                    className="w-full text-sm rounded-xl border p-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveShared} className="text-xs font-bold text-white px-4 py-2 rounded-full" style={{ backgroundColor: L.color }}>Save</button>
                    <button onClick={() => setEditing(false)} className="text-xs font-semibold px-4 py-2 rounded-full" style={{ color: "#8A8F98" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap" style={{ color: ov.notes ? "#1D2433" : "#B8B5AD" }}>
                  {ov.notes || "Nothing shared yet."}
                </p>
              )}
            </div>

            {/* My note */}
            <div className="rounded-xl border p-3 mb-2" style={{ borderColor: myNote || pEditing ? membersById[myId]?.color || "#E5E2DA" : "#E5E2DA" }}>
              <div className="flex items-center justify-between mb-1">
                <PersonBadge member={membersById[myId]} size="xs" />
                {!pEditing && (
                  <button onClick={startMine} className="text-xs font-semibold" style={{ color: L.color }}>{myNote ? "Edit" : "Add mine"}</button>
                )}
              </div>
              {pEditing ? (
                <div>
                  <textarea value={pDraft} onChange={(e) => setPDraft(e.target.value)} rows={3}
                    placeholder="Your own plan for this day (e.g. solo sightseeing)…"
                    className="w-full text-sm rounded-xl border p-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveMine} className="text-xs font-bold text-white px-4 py-2 rounded-full" style={{ backgroundColor: L.color }}>Save</button>
                    <button onClick={() => setPEditing(false)} className="text-xs font-semibold px-4 py-2 rounded-full" style={{ color: "#8A8F98" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap" style={{ color: myNote ? "#1D2433" : "#B8B5AD" }}>
                  {myNote || "Just for you — add your own plan for days you split up."}
                </p>
              )}
            </div>

            {/* Other members' notes (read-only) */}
            {otherNotes.map(({ member, notes }) => (
              <div key={member.user_id} className="rounded-xl border p-3 mb-2" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6" }}>
                <div className="mb-1"><PersonBadge member={member} size="xs" /></div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "#1D2433" }}>{notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
