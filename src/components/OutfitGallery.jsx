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
  const closet = (memberId && closetsAll[memberId]) || { items: {}, days: {} };

  // Days an outfit id is worn (owner's closet), for closet captions.
  const daysOfItem = (id, ownerId) =>
    config.days.filter((d) => (closetsAll[ownerId]?.days || {})[d.date] === id);

  // Build the slide sequence for the current mode + member. memberId === null
  // is the ALL deck: everyone's visible closet items in one flick-through.
  const slides = useMemo(() => {
    if (!memberId) {
      return (members || [])
        .flatMap((m) => Object.entries(closetsAll[m.user_id]?.items || {})
          .filter(([, item]) => item && (m.user_id === myId || visibleToOthers(item)))
          .map(([id, item]) => ({ key: `${m.user_id}:${id}`, id, item, member: m })))
        .sort((a, b) => (b.item?.createdAt || "").localeCompare(a.item?.createdAt || ""));
    }
    const visible = (item) => item && (mine || visibleToOthers(item));
    if (mode === "closet") {
      return Object.entries(closet.items || {})
        .filter(([, item]) => visible(item))
        .sort((a, b) => (b[1]?.createdAt || "").localeCompare(a[1]?.createdAt || ""))
        .map(([id, item]) => ({ key: id, id, item }));
    }
    return config.days.map((d) => {
      const item = outfitForDay(closet, d.date);
      return { key: d.date, day: d, item: visible(item) ? item : null, hidden: !!item && !visible(item) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, memberId, closetsAll, config, members]);

  const count = slides.length;
  const i = Math.min(index, Math.max(0, count - 1));
  const go = (next) => setIndex(Math.max(0, Math.min(count - 1, next)));
  // BY DAY needs one member's plan, so leaving the ALL deck falls back to me.
  const switchMode = (m) => { if (m === "byday" && !memberId) setMemberId(myId); setMode(m); setIndex(0); };
  const switchMember = (id) => { if (!id) setMode("closet"); setMemberId(id); setIndex(0); };
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
  const curOwner = current?.member?.user_id || memberId;
  const curMine = curOwner === myId;

  return (
    <div className={g.shell}>
      {/* Top bar: close · view toggle · position */}
      <div className={g.topbar}>
        <button onClick={requestClose} aria-label="Close gallery" className={g.close}><Icon name="x" size={18} strokeWidth={2} /></button>
        <div className={g.modes}>
          {[["closet", "Closet"], ["byday", "By day"]].map(([id, lbl]) => (
            <button key={id} onClick={() => switchMode(id)} className={[g.mode, mode === id && memberId && g.modeActive].filter(Boolean).join(" ")}>
              {lbl}
            </button>
          ))}
        </div>
        <span className={g.topSpacer} />
        {count > 1 && <span className={g.topCount}>{i + 1} / {count}</span>}
      </div>

      {/* Member chips */}
      {(members || []).length > 1 && (
        <div className={g.members}>
          <button onClick={() => switchMember(null)}
            className={[g.memberChip, !memberId && g.memberActive].filter(Boolean).join(" ")}>
            All
          </button>
          {members.map((m) => {
            const active = m.user_id === memberId;
            return (
              <button key={m.user_id} onClick={() => switchMember(m.user_id)}
                className={[g.memberChip, active && g.memberActive].filter(Boolean).join(" ")}>
                <span className={g.memberDot} style={{ backgroundColor: m.color }} />
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
            const owner = s.member?.user_id || memberId;
            return (
              <div key={s.key} className={g.slideWrap} style={{ transform: `translateX(${(j - i) * 100}%)` }}>
                <Slide slide={s} mine={owner === myId} memberName={s.member?.name || membersById[memberId]?.name} active={j === i} />
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

        {/* Caption overlaid on the photo's lower edge */}
        {current && (
          <div className={g.captionOverlay}>
            <Caption slide={current} mine={curMine} owner={current.member || membersById[curOwner]}
              daysOfItem={(id) => daysOfItem(id, curOwner)} />
          </div>
        )}
      </div>

      {count > 1 && count <= 10 && (
        <div className={g.captionBar}>
          <div className={g.dots}>
            {slides.map((s, j) => (
              <button key={s.key} onClick={() => go(j)} aria-label={`Slide ${j + 1}`} className={g.dotBtn}>
                <span className={[g.dot, j === i && g.dotActive].filter(Boolean).join(" ")} />
              </button>
            ))}
          </div>
        </div>
      )}
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

function Caption({ slide, mine, owner, daysOfItem }) {
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

  const chips = item ? daysOfItem(slide.id || slide.key) : [];
  return (
    <div className={g.caption}>
      {owner && (
        <div className={g.captionOwner}>
          <span className={g.captionOwnerDot} style={{ backgroundColor: owner.color }} />
          {mine ? "You" : owner.name}
        </div>
      )}
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
