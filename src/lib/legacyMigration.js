import { getSession, canEditShared, myId } from "./session.js";
import { loadKey, saveKey, loadPersonalAll, upsertRow, flushOutbox } from "./storage.js";
import { CONFIG_KEY } from "./tripConfig.js";
import { buildLegacyConfig, legacyDayISO, seedLegacyBookings } from "../data/exampleTrips/londonLoop.js";

// One-time in-place upgrade of the original pre-wizard trip ("London & the
// Loop"). Trips created through the wizard write their `trip-config` row at
// creation, so only the legacy trip can be missing one. The upgrade:
//   1. writes the archived itinerary as the trip's config, and
//   2. copies every day-keyed kv value from the old "d7" keys to ISO-date keys
//      ("2026-08-07").
// Since 008 (roles) RLS only lets you write shared rows when you can edit
// shared data, and personal rows only for yourself. So each device upgrades
// what it may: shared rows if canEditShared(), and only its own personal
// rows. Other members' personal day notes keep their old dN keys (still in
// the database, not lost); RLS no longer lets one device move them.
// Nothing is deleted: the old dN rows stay in place as inert backups, and the
// whole routine is idempotent (re-running upserts the same values again).

const isLegacyKey = (k) => /^d\d+$/.test(k);
const isoOf = (dk) => legacyDayISO(Number(dk.slice(1)));

// Rewrite the dN keys of a per-day map ({ d7: {...} }) to ISO dates. Existing
// ISO entries win over a rewritten legacy entry with the same date.
function rewriteDayMap(map) {
  const next = { ...map };
  let changed = false;
  for (const [k, v] of Object.entries(map || {})) {
    if (!isLegacyKey(k)) continue;
    const iso = isoOf(k);
    if (next[iso] === undefined) { next[iso] = v; changed = true; }
  }
  return changed ? next : null;
}

const SHARED = "__shared__";

// May this device write the row with this owner? Mirrors the 008 trip_kv
// policies, so a skipped row is one RLS would have rejected anyway.
export function legacyRowWritable(owner, { canEdit, me }) {
  if (owner === SHARED) return canEdit === true;
  return Boolean(me) && owner === me;
}

export { rewriteDayMap };

export async function migrateLegacyTrip() {
  const s = getSession();
  if (!s) throw new Error("No active trip.");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You need to be online to upgrade the trip.");
  }

  const who = { canEdit: canEditShared(), me: myId() };
  const mayWrite = (owner, key) => {
    if (legacyRowWritable(owner, who)) return true;
    console.info(`Legacy upgrade: skipped "${key}" for ${owner === SHARED ? "the trip (organiser only)" : "another member"}.`);
    return false;
  };

  if (mayWrite(SHARED, "shared rows")) {
    // Re-check right before writing to soften a two-devices race; if the
    // other device already upgraded, skip the config write but still copy day
    // data (idempotent upserts of identical values).
    const existing = await loadKey(CONFIG_KEY, null);
    if (!existing) await saveKey(CONFIG_KEY, buildLegacyConfig());

    // Shared per-day notes.
    const shared = await loadKey("trip-itinerary", {});
    const sharedNext = rewriteDayMap(shared);
    if (sharedNext) await saveKey("trip-itinerary", sharedNext);

    // The bookings list used to be seeded client-side only; make sure the
    // shared row exists so the defaults survive now that new trips start empty.
    const bookings = await loadKey("trip-bookings", null);
    if (bookings === null) await saveKey("trip-bookings", seedLegacyBookings());
  }

  // Personal per-day notes: only this member's own row is written.
  const overrides = await loadPersonalAll("trip-itinerary-override");
  for (const [owner, map] of Object.entries(overrides)) {
    const next = rewriteDayMap(map);
    if (next && mayWrite(owner, "trip-itinerary-override")) {
      await upsertRow(owner, "trip-itinerary-override", next);
    }
  }

  // The old weather cache (integer-keyed days) is simply left to expire — the
  // v2 format guard in weather.js triggers a refetch.
  await flushOutbox();
}
