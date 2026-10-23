import { useMemo, useState } from "react";
import { TripConfigContext, daysToGo, isDuringTrip, tripDayNumber, dateRangeLabel } from "../lib/tripConfig.js";
import { buildDemoTrip } from "../data/demo/kasolWeekend.js";
import ItineraryTab from "../tabs/ItineraryTab.jsx";
import PackingTab from "../tabs/PackingTab.jsx";
import BookingsTab from "../tabs/BookingsTab.jsx";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/ui/icons.jsx";
import s from "./DemoTrip.module.css";

// The read-only demo at /demo, rendered from bundled fixture data the same
// way src/harness.jsx renders tabs. There's no session, so canEditShared()
// is false and the tabs show the member's view of an organiser-run trip;
// saveKey() is a no-op without a session, so ticking your own packing list
// only changes this page. Nothing here may call Supabase: no session, no
// documents (opening one would fetch a signed URL), no live weather.

const TABS = [
  { id: "itinerary", label: "Trip", icon: "route" },
  { id: "packing", label: "Pack", icon: "case" },
  { id: "bookings", label: "Book", icon: "ticket" },
];

const noop = () => {};

export default function DemoTrip() {
  const demo = useMemo(() => buildDemoTrip(), []);
  const { config, members, myId } = demo;
  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);
  const [tab, setTab] = useState("itinerary");
  const [overrides, setOverrides] = useState(demo.overrides);
  const [notesAll, setNotesAll] = useState({});
  const [packingAll, setPackingAll] = useState(demo.packingAll);
  const [bookings, setBookings] = useState(demo.bookings);
  const [documents, setDocuments] = useState([]);

  const dtg = daysToGo(config);
  const cd =
    dtg > 0 ? { n: String(dtg), label: dtg === 1 ? "day to go" : "days to go" } :
    isDuringTrip(config) ? { n: `Day ${tripDayNumber(config)}`, label: "of the trip" } :
    { n: null, label: "Trip complete" };

  return (
    <TripConfigContext.Provider value={config}>
      <div className={s.app}>
        <div className={s.banner}>
          <span className={s.bannerText}>Demo trip. You're seeing what a traveller sees.</span>
          <a href="/" className={s.bannerLink}>Start your own trip <Icon name="arrow" size={12} strokeWidth={2} /></a>
        </div>

        <div className={s.header}>
          <h1 className={s.title}>{config.title}</h1>
          <div className={s.sub}>{dateRangeLabel(config)} · run by {members[0].name}</div>
          <div className={s.headMeta}>
            <span className={s.countdown}>
              {cd.n && <span className={s.countdownNum}>{cd.n}</span>}
              <span className={s.countdownLabel}>{cd.label}</span>
            </span>
            <span className={s.avStack} aria-label={`${members.length} people on this trip`}>
              {members.map((m) => (
                <span key={m.user_id} className={s.avWrap}>
                  <Avatar name={m.name} color={m.color} size="xs" />
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className={s.content}>
          {tab === "itinerary" && (
            <ItineraryTab
              overrides={overrides} setOverrides={setOverrides}
              notesAll={notesAll} setNotesAll={setNotesAll}
              membersById={membersById} members={members} myId={myId}
              weather={null}
              saveConfig={noop}
              packingItems={(packingAll[myId] || []).map((i) => i.text)}
            />
          )}
          {tab === "packing" && (
            <PackingTab packingAll={packingAll} setPackingAll={setPackingAll} membersById={membersById} myId={myId} />
          )}
          {tab === "bookings" && (
            <BookingsTab bookings={bookings} setBookings={setBookings} documents={documents} setDocuments={setDocuments}
              membersById={membersById} myId={myId} />
          )}
        </div>

        <nav className={s.nav}>
          <div className={s.navInner}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                className={[s.navItem, tab === t.id && s.navActive].filter(Boolean).join(" ")}>
                <Icon name={t.icon} size={21} strokeWidth={tab === t.id ? 1.7 : 1.6} />
                <span className={s.navLabel}>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </TripConfigContext.Provider>
  );
}
