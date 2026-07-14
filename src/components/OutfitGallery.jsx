import { useEffect, useMemo, useRef, useState } from "react";
import { useTripConfig, dateLabel, weekday } from "../lib/tripConfig.js";
import { outfitForDay, visibleToOthers } from "../lib/closet.js";
import { FEATURES } from "../appConfig.js";
import LegChip from "./LegChip.jsx";

// Full-screen swipe-deck gallery: one outfit photo at a time, flicked
// left/right through a member's closet or through the trip days. Read-only
// viewer — planning/editing stays in the Outfits tab underneath.

const BG = "#0D1017";
const DIM = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.35)";

export default function OutfitGallery({ closetsAll, members, membersById, myId, onClose }) {
  const config = useTripConfig();
  const [mode, setMode] = useState("closet"); // closet | byday
  const [memberId, setMemberId] = useState(myId);
  const [index, setIndex] = useState(0);
  const touch = useRef(null);

  const mine = memberId === myId;
  const closet = closetsAll[memberId] || { items: {}, days: {} };

  // Days each outfit id is worn, for closet captions.
  const daysOfItem = (id) => config.days.filter((d) => closet.days[d.date] === id);

  // Build the slide sequence for the current mode + member.
  const slides = useMemo(() => {
    const visible = (item) => item && (mine || visibleToOthers(item));
    if (mode === "closet") {
      return Object.entries(closet.items || {})
        .filter(([, item]) => visible(item))
        .sort((a, b) => (b[1]?.createdAt || "").localeCompare(a[1]?.createdAt || ""))
        .map(([id, item]) => ({ key: id, item }));
    }
    return config.days.map((d) => {
      const item = outfitForDay(closet, d.date);
      return { key: d.date, day: d, item: visible(item) ? item : null, hidden: !!item && !visible(item) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, memberId, closetsAll, config]);

  const count = slides.length;
  const i = Math.min(index, Math.max(0, count - 1));
  const go = (next) => setIndex(Math.max(0, Math.min(count - 1, next)));
  const switchMode = (m) => { setMode(m); setIndex(0); };
  const switchMember = (id) => { setMemberId(id); setIndex(0); };

  // Keyboard + body scroll lock while open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((v) => Math.min(count - 1, v + 1));
      else if (e.key === "ArrowLeft") setIndex((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [count, onClose]);

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
  };

  const current = slides[i];

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: BG, color: "#FFF" }}>
      {/* Top bar: view toggle + close */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="flex rounded-full overflow-hidden text-[11px] font-bold" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          {[["closet", "👕 Closet"], ["byday", "🗓 By day"]].map(([id, lbl]) => (
            <button key={id} onClick={() => switchMode(id)} className="px-3.5 py-2"
              style={mode === id ? { backgroundColor: "#FFF", color: "#1D2433" } : { color: DIM }}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Close gallery" className="w-9 h-9 rounded-full text-base font-bold" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>✕</button>
      </div>

      {/* Member chips */}
      {(members || []).length > 1 && (
        <div className="flex gap-1.5 px-4 pb-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {members.map((m) => {
            const active = m.user_id === memberId;
            return (
              <button key={m.user_id} onClick={() => switchMember(m.user_id)}
                className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={active ? { backgroundColor: m.color, color: "#FFF" } : { backgroundColor: "rgba(255,255,255,0.08)", color: DIM }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#FFF" : m.color }} />
                {m.user_id === myId ? "Me" : m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Deck */}
      <div className="relative flex-1 min-h-0 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {count === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="text-4xl">🪞</span>
            <p className="text-sm font-semibold" style={{ color: DIM }}>
              {mine ? "Your closet is empty — add outfits in the planner to see them here." : `${membersById[memberId]?.name || "They"} has no outfits to show yet.`}
            </p>
          </div>
        ) : (
          slides.map((s, j) => {
            if (Math.abs(j - i) > 1) return null; // only current ± 1 mounted
            return (
              <div key={s.key} className="absolute inset-0 px-4 pb-1"
                style={{ transform: `translateX(${(j - i) * 100}%)`, transition: "transform 0.28s ease" }}>
                <Slide slide={s} mine={mine} memberName={membersById[memberId]?.name} active={j === i} />
              </div>
            );
          })
        )}

        {/* ‹ › nav */}
        {count > 1 && (
          <>
            <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-14 rounded-xl text-xl font-bold"
              style={{ backgroundColor: "rgba(13,16,23,0.5)", color: i === 0 ? FAINT : "#FFF" }}>‹</button>
            <button onClick={() => go(i + 1)} disabled={i === count - 1} aria-label="Next"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-14 rounded-xl text-xl font-bold"
              style={{ backgroundColor: "rgba(13,16,23,0.5)", color: i === count - 1 ? FAINT : "#FFF" }}>›</button>
          </>
        )}
      </div>

      {/* Caption + position */}
      <div className="px-5 pt-2 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))", minHeight: 92 }}>
        {current && <Caption slide={current} mine={mine} daysOfItem={daysOfItem} />}
        {count > 1 && (
          count <= 10 ? (
            <div className="flex justify-center gap-1.5 mt-2.5">
              {slides.map((s, j) => (
                <button key={s.key} onClick={() => go(j)} aria-label={`Slide ${j + 1}`} className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: j === i ? "#FFF" : FAINT }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-[11px] font-bold mt-2.5" style={{ color: DIM }}>{i + 1} / {count}</p>
          )
        )}
      </div>
    </div>
  );
}

// One deck card: the photo (with optional try-on flip) or a placeholder.
function Slide({ slide, mine, memberName, active }) {
  const [onMe, setOnMe] = useState(false);
  useEffect(() => { if (!active) setOnMe(false); }, [active]);
  const item = slide.item;

  if (!item) {
    return (
      <div className="h-full rounded-2xl flex flex-col items-center justify-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
        <span className="text-3xl">{slide.hidden ? "🔒" : "🫥"}</span>
        <p className="text-sm font-semibold px-8 text-center" style={{ color: DIM }}>
          {slide.hidden ? `${memberName || "They"} kept this day's outfit private` : "Nothing planned for this day yet"}
        </p>
      </div>
    );
  }

  const t = FEATURES.tryOn ? item.tryOn?.photo : null;
  const src = onMe && t ? t : item.photo;
  return (
    <div className="relative h-full">
      {src ? (
        <img src={src} alt={item.desc || "Outfit"} className="w-full h-full object-contain rounded-2xl" />
      ) : (
        <div className="h-full rounded-2xl flex flex-col items-center justify-center gap-3 px-8" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
          <span className="text-4xl">📝</span>
          {item.desc && <p className="text-base font-semibold text-center">{item.desc}</p>}
        </div>
      )}
      {t && (
        <button onClick={() => setOnMe(!onMe)}
          className="absolute bottom-3 right-3 text-[11px] font-bold px-3 py-1.5 rounded-full text-white"
          style={{ backgroundColor: "rgba(13,16,23,0.7)" }}>
          {onMe ? "👕 Outfit" : mine ? "👤 On me" : "👤 On them"}
        </button>
      )}
    </div>
  );
}

function Caption({ slide, mine, daysOfItem }) {
  const item = slide.item;

  if (slide.day) {
    const d = slide.day;
    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-bold">{weekday(d.date)} {dateLabel(d.date)}</span>
          <LegChip leg={d.leg} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: DIM }}>{d.title}</p>
        {item?.desc && <p className="text-xs mt-1 line-clamp-2" style={{ color: "#FFF" }}>{item.desc}</p>}
      </div>
    );
  }

  const chips = item ? daysOfItem(slide.key) : [];
  return (
    <div className="text-center">
      {item?.desc
        ? <p className="text-sm font-semibold line-clamp-2">{item.desc}</p>
        : <p className="text-sm" style={{ color: FAINT }}>No description</p>}
      <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
        {mine && item?.visibility === "private" && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>🔒 Only me</span>
        )}
        {chips.length > 0 ? (
          chips.map((d) => (
            <span key={d.date} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
              {weekday(d.date)} {dateLabel(d.date)}
            </span>
          ))
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: FAINT }}>No day yet</span>
        )}
      </div>
    </div>
  );
}
