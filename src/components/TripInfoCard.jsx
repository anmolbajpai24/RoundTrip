import { cleanTripInfo, safeMapUrl, telHref } from "../lib/tripConfig.js";
import s from "./TripInfoCard.module.css";

// Pinned at the top of the itinerary: where and when the pickup is, who's
// leading, and who to call in an emergency. Renders nothing when the
// organiser hasn't filled any of it in (friend trips usually won't).
export default function TripInfoCard({ info }) {
  const i = cleanTripInfo(info);
  if (!i) return null;
  const map = safeMapUrl(i.pickupMapUrl);
  const leadTel = telHref(i.leadPhone);
  const emergencyTel = telHref(i.emergency);
  const pickup = [i.pickupPoint, i.pickupTime].filter(Boolean).join(" · ");

  return (
    <div className={s.card}>
      {(pickup || map) && (
        <div className={s.row}>
          <span className={s.key}>Pickup</span>
          <span className={s.value}>{pickup || "See the map"}</span>
          {map && <a href={map} target="_blank" rel="noopener noreferrer" className={s.action}>Map</a>}
        </div>
      )}
      {(i.leadName || i.leadPhone) && (
        <div className={s.row}>
          <span className={s.key}>Trip lead</span>
          <span className={s.value}>{i.leadName || i.leadPhone}</span>
          {leadTel && <a href={leadTel} className={s.action}>Call</a>}
        </div>
      )}
      {i.emergency && (
        <div className={s.row}>
          <span className={s.key}>Emergency</span>
          <span className={s.value}>{i.emergency}</span>
          {emergencyTel && <a href={emergencyTel} className={s.action}>Call</a>}
        </div>
      )}
    </div>
  );
}
