import { useEffect, useMemo, useRef, useState } from "react";
import { useTripConfig, dateLabel, weekday } from "../lib/tripConfig.js";
import { outfitForDay, visibleToOthers, hasPhoto } from "../lib/closet.js";
import { FEATURES } from "../appConfig.js";
import useBackClose from "../lib/useBackClose.js";
import LegChip from "./LegChip.jsx";
import OutfitImage from "./OutfitImage.jsx";
import Icon from "./ui/icons.jsx";
import g from "./OutfitGallery.module.css";

// Full-screen swipe-deck gallery: one outfit photo at a time, flicked
// left/right through a member's closet or through the trip days. Read-only
// viewer — planning/editing stays in the Outfits tab underneath. The dark
// shell is a deliberate photography surface, not app chrome.

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
  const requestClose = useBackClose(onClose);

  // Keyboard + body scroll lock while open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowRight") setIndex((v) => Math.min(count - 1, v + 1));
      else if (e.key === "ArrowLeft") setIndex((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

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
    <div className={g.shell}>
      {/* Top bar: view toggle + close */}
      <div className={g.topbar}>
        <div className={g.modes}>
          {[["closet", "Closet", "hanger"], ["byday", "By day", "grip"]].map(([id, lbl, icon]) => (
            <button key={id} onClick={() => switchMode(id)} className={[g.mode, mode === id && g.modeActive].filter(Boolean).join(" ")}>
              <Icon name={icon} size={13} /> {lbl}
            </button>
          ))}
        </div>
        <button onClick={requestClose} aria-label="Close gallery" className={g.close}><Icon name="x" size={18} strokeWidth={2} /></button>
      </div>

      {/* Member chips */}
      {(members || []).length > 1 && (
        <div className={g.members}>
          {members.map((m) => {
            const active = m.user_id === memberId;
            return (
              <button key={m.user_id} onClick={() => switchMember(m.user_id)}
                className={[g.memberChip, active && g.memberActive].filter(Boolean).join(" ")}
                style={active ? { backgroundColor: m.color } : undefined}>
                <span className={g.memberDot} style={{ backgroundColor: active ? "#FFF" : m.color }} />
                {m.user_id === myId ? "Me" : m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Deck */}
      {/* touch-action: pan-y — the browser keeps vertical scrolling, we take
          horizontal swipes (otherwise some browsers hijack them for history). */}
      <div className={g.deck} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {count === 0 ? (
          <div className={g.empty}>
            <span className={g.emptyMark}><Icon name="hanger" size={26} /></span>
            <p className={g.emptyText}>
              {mine ? "Your closet is empty — add outfits in the planner to see them here." : `${membersById[memberId]?.name || "They"} has no outfits to show yet.`}
            </p>
          </div>
        ) : (
          slides.map((s, j) => {
            if (Math.abs(j - i) > 1) return null; // only current ± 1 mounted
            return (
              <div key={s.key} className={g.slideWrap} style={{ transform: `translateX(${(j - i) * 100}%)` }}>
                <Slide slide={s} mine={mine} memberName={membersById[memberId]?.name} active={j === i} />
              </div>
            );
          })
        )}

        {/* ‹ › nav */}
        {count > 1 && (
          <>
            <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous" className={[g.nav, g.navPrev].join(" ")}><Icon name="back" size={20} strokeWidth={1.8} /></button>
            <button onClick={() => go(i + 1)} disabled={i === count - 1} aria-label="Next" className={[g.nav, g.navNext].join(" ")}><Icon name="chev" size={20} strokeWidth={1.8} /></button>
          </>
        )}
      </div>

      {/* Caption + position */}
      <div className={g.captionBar}>
        {current && <Caption slide={current} mine={mine} daysOfItem={daysOfItem} />}
        {count > 1 && (
          count <= 10 ? (
            <div className={g.dots}>
              {slides.map((s, j) => (
                <button key={s.key} onClick={() => go(j)} aria-label={`Slide ${j + 1}`} className={g.dotBtn}>
                  <span className={[g.dot, j === i && g.dotActive].filter(Boolean).join(" ")} />
                </button>
              ))}
            </div>
          ) : (
            <p className={g.position}>{i + 1} / {count}</p>
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
      <div className={g.slidePlaceholder}>
        <span className={g.placeholderMark}><Icon name={slide.hidden ? "lock" : "image"} size={24} /></span>
        <p className={g.placeholderText}>
          {slide.hidden ? `${memberName || "They"} kept this day's outfit private` : "Nothing planned for this day yet"}
        </p>
      </div>
    );
  }

  const t = FEATURES.tryOn ? item.tryOn?.photo : null;
  const showTry = onMe && t;
  return (
    <div className={g.slide}>
      {showTry || hasPhoto(item) ? (
        <OutfitImage item={item} src={showTry ? t : undefined} alt={item.desc || "Outfit"} className={g.slideImg} />
      ) : (
        <div className={g.descOnly}>
          <span className={g.placeholderMark}><Icon name="image" size={26} /></span>
          {item.desc && <p className={g.descText}>{item.desc}</p>}
        </div>
      )}
      {t && (
        <button onClick={() => setOnMe(!onMe)} className={g.flipBtn}>
          <Icon name={onMe ? "hanger" : "flip"} size={12} /> {onMe ? "Outfit" : mine ? "On me" : "On them"}
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
      <div className={g.caption}>
        <div className={g.captionHead}>
          <span className={g.captionTitle}>{weekday(d.date)} {dateLabel(d.date)}</span>
          <LegChip leg={d.leg} />
        </div>
        <p className={g.captionSub}>{d.title}</p>
        {item?.desc && <p className={g.captionDesc}>{item.desc}</p>}
      </div>
    );
  }

  const chips = item ? daysOfItem(slide.key) : [];
  return (
    <div className={g.caption}>
      {item?.desc
        ? <p className={g.captionDescStrong}>{item.desc}</p>
        : <p className={g.captionMuted}>No description</p>}
      <div className={g.captionChips}>
        {mine && item?.visibility === "private" && (
          <span className={g.gChip}><Icon name="lock" size={10} strokeWidth={2} /> Only me</span>
        )}
        {chips.length > 0 ? (
          chips.map((d) => (
            <span key={d.date} className={g.gChip}>{weekday(d.date)} {dateLabel(d.date)}</span>
          ))
        ) : (
          <span className={g.gChipFaint}>No day yet</span>
        )}
      </div>
    </div>
  );
}
