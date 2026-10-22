import { addDays, diffDays } from "./tripConfig.js";

// "Run this trip again": move a trip's plan to a new start date. Pure, so it
// can be tested without Supabase; duplicateTrip() in session.js does the I/O.
//
// Where dates live in a trip (all YYYY-MM-DD strings, see tripConfig.js):
//   trip-config     startDate, endDate, days[].date. Any other date field a
//                   later config version adds (pickup day and so on) is
//                   covered too, because every ISO date string and ISO-date
//                   object key anywhere in the config is moved.
//   trip-itinerary  shared day notes, an object keyed by ISO date.
//   trip-bookings   a checklist with no dates; only the done flags reset.
// Personal keys (trip-packing, trip-itinerary-override), expenses, documents
// and the weather cache are never copied, so they aren't handled here.
//
//   shiftTrip(config, kv, newStart) -> { config, kv }
//   kv: { "trip-itinerary"?, "trip-bookings"? } (other keys are ignored)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = (s) => typeof s === "string" && ISO_DATE.test(s);

// Deep copy that moves every ISO date string, and every ISO-date object key,
// by `offset` days. Everything else is copied as-is.
function shiftDeep(value, offset) {
  if (isISODate(value)) return addDays(value, offset);
  if (Array.isArray(value)) return value.map((v) => shiftDeep(v, offset));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[isISODate(k) ? addDays(k, offset) : k] = shiftDeep(v, offset);
    return out;
  }
  return value;
}

// Shared day notes: keep only ISO-dated days (pre-ISO "d7" keys were left
// behind as inert backups by the legacy migration and mean nothing here).
function shiftItinerary(map, offset) {
  if (!map || typeof map !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(map)) if (isISODate(k)) out[addDays(k, offset)] = shiftDeep(v, offset);
  return out;
}

// Bookings start unbooked. Linked documents and "added by" badges are dropped:
// documents aren't copied and the other members aren't on the new trip.
function resetBookings(list) {
  if (!Array.isArray(list)) return null;
  return list.map((b) => {
    const { docId: _doc, addedBy: _by, ...rest } = b || {};
    return { ...rest, done: false };
  });
}

export default function shiftTrip(config, kv = {}, newStart) {
  if (!config || !isISODate(config.startDate)) throw new Error("This trip has no start date to move.");
  if (!isISODate(newStart)) throw new Error("Pick a new start date.");
  const offset = diffDays(config.startDate, newStart);

  const nextKv = {};
  const itinerary = shiftItinerary(kv["trip-itinerary"], offset);
  if (itinerary) nextKv["trip-itinerary"] = itinerary;
  const bookings = resetBookings(kv["trip-bookings"]);
  if (bookings) nextKv["trip-bookings"] = bookings;

  return { config: shiftDeep(config, offset), kv: nextKv };
}
