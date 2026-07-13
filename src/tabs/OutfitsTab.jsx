import { useState, useEffect, useRef } from "react";
import { useTripConfig, dateLabel, weekday, defaultDay, findDay } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { compressImage } from "../lib/image.js";
import SectionTitle from "../components/SectionTitle.jsx";
import LegChip from "../components/LegChip.jsx";
import DayStrip from "../components/DayStrip.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

export default function OutfitsTab({ outfitsAll, setOutfitsAll, membersById, members, myId, initialDay }) {
  const config = useTripConfig();
  const [selected, setSelected] = useState(() => initialDay || defaultDay(config));
  const day = findDay(config, selected);
  const L = config.legs[day.leg] || {};
  const key = day.date;

  const mine = (outfitsAll[myId] || {})[key] || {};
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(mine.desc || "");

  useEffect(() => { setDesc(((outfitsAll[myId] || {})[key] || {}).desc || ""); }, [key, outfitsAll, myId]);

  const persist = async (next) => {
    setOutfitsAll((prev) => ({ ...prev, [myId]: { ...(prev[myId] || {}), [key]: next } }));
    await saveKey(`outfit:${key}`, next);
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { await persist({ ...mine, photo: await compressImage(file), desc }); }
    catch (err) { console.error(err); }
    setBusy(false);
    e.target.value = "";
  };
  const saveDesc = () => persist({ ...mine, desc });
  const removePhoto = () => persist({ ...mine, photo: null });

  // Other members' outfits for this day.
  const others = (members || []).filter((m) => m.user_id !== myId);

  // Count of days I've planned (for the grid header).
  const myMap = outfitsAll[myId] || {};
  const plannedCount = Object.values(myMap).filter((o) => o?.photo || o?.desc).length;

  return (
    <div>
      <SectionTitle sub={`You've planned ${plannedCount} of ${config.days.length} days`}>Outfit planner</SectionTitle>
      <DayStrip selected={key} onSelect={setSelected} />

      <div className="mt-3 rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "#F0EDE6" }}>
          <span className="text-sm font-bold" style={{ color: "#1D2433" }}>{weekday(key)} {dateLabel(key)} · {day.title}</span>
          <LegChip leg={day.leg} />
        </div>

        {/* My outfit — editable */}
        <div className="p-4">
          <div className="mb-2"><PersonBadge member={membersById[myId]} size="xs" /></div>
          {mine.photo ? (
            <div className="relative">
              <img src={mine.photo} alt={`Outfit for ${dateLabel(key)}`} className="w-full rounded-xl object-cover" style={{ maxHeight: 380 }} />
              <button onClick={removePhoto} className="absolute top-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(29,36,51,0.75)" }}>Remove</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-2" style={{ borderColor: L.color, backgroundColor: L.soft }}>
              <span className="text-3xl">📸</span>
              <span className="text-sm font-bold" style={{ color: L.color }}>{busy ? "Saving photo…" : "Add your outfit photo"}</span>
              <span className="text-xs" style={{ color: "#8A8F98" }}>Lay it out on the bed &amp; snap it</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {mine.photo && (
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="mt-2 text-xs font-semibold" style={{ color: L.color }}>{busy ? "Saving…" : "Replace photo"}</button>
          )}
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A8F98" }}>What you're wearing</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={saveDesc} rows={2}
              placeholder="e.g. Black tee, olive chinos, rain jacket, white sneakers"
              className="mt-1 w-full text-sm rounded-xl border p-3" style={{ borderColor: "#E5E2DA", backgroundColor: "#FAF9F6", color: "#1D2433" }} />
            <p className="text-[11px] mt-1" style={{ color: "#B8B5AD" }}>Saved automatically when you tap away.</p>
          </div>
        </div>

        {/* Other members' outfits — read-only */}
        {others.map((m) => {
          const o = (outfitsAll[m.user_id] || {})[key];
          return (
            <div key={m.user_id} className="p-4 border-t" style={{ borderColor: "#F0EDE6" }}>
              <div className="mb-2"><PersonBadge member={m} size="xs" /></div>
              {o?.photo ? (
                <img src={o.photo} alt={`${m.name}'s outfit`} className="w-full rounded-xl object-cover" style={{ maxHeight: 380 }} />
              ) : (
                <div className="w-full rounded-xl py-8 text-center text-sm" style={{ backgroundColor: "#FAF9F6", color: "#B8B5AD" }}>
                  {m.name} hasn't planned this day yet
                </div>
              )}
              {o?.desc && <p className="text-sm mt-2" style={{ color: "#1D2433" }}>{o.desc}</p>}
            </div>
          );
        })}
      </div>

      {/* Grid: my days, with dots showing who else has an outfit */}
      <div className="mt-5">
        <SectionTitle>All days</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {config.days.map((d) => {
            const dk = d.date;
            const o = myMap[dk];
            const Lg = config.legs[d.leg] || {};
            const otherDots = (members || []).filter((m) => m.user_id !== myId && (outfitsAll[m.user_id] || {})[dk]?.photo);
            return (
              <button key={dk} onClick={() => { setSelected(dk); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl overflow-hidden border text-left relative" style={{ borderColor: "#E5E2DA", backgroundColor: "#FFF" }}>
                {o?.photo ? (
                  <img src={o.photo} alt="" className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center text-lg" style={{ backgroundColor: Lg.soft }}>{o?.desc ? "📝" : "＋"}</div>
                )}
                {otherDots.length > 0 && (
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    {otherDots.map((m) => <span key={m.user_id} className="w-2 h-2 rounded-full border border-white" style={{ backgroundColor: m.color }} />)}
                  </div>
                )}
                <div className="px-1.5 py-1 text-[10px] font-semibold" style={{ color: "#1D2433" }}>{dateLabel(dk)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
