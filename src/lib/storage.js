import { get, set, keys } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";
import { getSession, myId } from "./session.js";

// Persistence layer. Public surface stays close to the local-only version
// (loadKey / saveKey / loadPersonalAll ...) so the tabs barely change. Under the
// hood every value is a row in Supabase's `trip_kv` table, scoped to the trip
// and — for personal slices — to the member's user id. IndexedDB is kept as an
// offline cache + a write outbox so the app still works with no signal.

const SHARED = "__shared__";
const OUTBOX_KEY = "__outbox__";

// Which keys are shared between everyone vs. personal to one member.
function scopeOf(key) {
  if (key.startsWith("outfit:")) return "personal";
  switch (key) {
    case "trip-packing":
    case "trip-itinerary-override":
      return "personal";
    default: // trip-itinerary, trip-expenses, trip-bookings, ... are shared
      return "shared";
  }
}

function ownerOf(key) {
  return scopeOf(key) === "shared" ? SHARED : (myId() || "unknown");
}

// ---------- local cache ----------
const cacheId = (tripId, owner, key) => `kv:${tripId}:${owner}:${key}`;
const readCache = (tripId, owner, key) => get(cacheId(tripId, owner, key));
const writeCache = (tripId, owner, key, value) => set(cacheId(tripId, owner, key), value);

function online() {
  return isConfigured && (typeof navigator === "undefined" || navigator.onLine !== false);
}

// ---------- reads ----------
// Read a single (shared or own-personal) key.
export async function loadKey(key, fallback) {
  const s = getSession();
  if (!s) return fallback;
  const owner = ownerOf(key);

  if (online()) {
    try {
      const { data, error } = await supabase
        .from("trip_kv").select("value")
        .eq("trip_id", s.tripId).eq("owner", owner).eq("key", key).maybeSingle();
      if (error) throw error;
      if (data) { await writeCache(s.tripId, owner, key, data.value); return data.value; }
    } catch { /* offline — use cache */ }
  }
  const cached = await readCache(s.tripId, owner, key);
  return cached === undefined ? fallback : cached;
}

// Read a personal key for EVERY member → { [ownerId]: value }.
export async function loadPersonalAll(key) {
  const s = getSession();
  const result = {};
  if (!s) return result;

  if (online()) {
    try {
      const { data, error } = await supabase
        .from("trip_kv").select("owner, value")
        .eq("trip_id", s.tripId).neq("owner", SHARED).eq("key", key);
      if (error) throw error;
      for (const row of data) {
        result[row.owner] = row.value;
        await writeCache(s.tripId, row.owner, key, row.value);
      }
      return result;
    } catch { /* fall through to cache */ }
  }
  // Offline: scan cached rows for this key across owners.
  const suffix = `:${key}`;
  const all = await keys();
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(`kv:${s.tripId}:`) && k.endsWith(suffix)) {
      const owner = k.slice(`kv:${s.tripId}:`.length, k.length - suffix.length);
      if (owner !== SHARED) result[owner] = await get(k);
    }
  }
  return result;
}

// Read outfit photos for EVERY member → { [ownerId]: { d7: {...}, ... } }.
export async function loadOutfitsAll() {
  const s = getSession();
  const result = {};
  if (!s) return result;

  if (online()) {
    try {
      const { data, error } = await supabase
        .from("trip_kv").select("owner, key, value")
        .eq("trip_id", s.tripId).neq("owner", SHARED).like("key", "outfit:%");
      if (error) throw error;
      for (const row of data) {
        const day = row.key.slice("outfit:".length);
        (result[row.owner] ||= {})[day] = row.value;
        await writeCache(s.tripId, row.owner, row.key, row.value);
      }
      return result;
    } catch { /* fall through */ }
  }
  const all = await keys();
  const base = `kv:${s.tripId}:`;
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(base) && k.includes(":outfit:")) {
      const rest = k.slice(base.length); // "<owner>:outfit:<day>"
      const owner = rest.slice(0, rest.indexOf(":outfit:"));
      const day = rest.slice(rest.indexOf(":outfit:") + ":outfit:".length);
      if (owner !== SHARED) (result[owner] ||= {})[day] = await get(k);
    }
  }
  return result;
}

// ---------- writes (optimistic: cache now, sync via outbox) ----------
export async function saveKey(key, value) {
  const s = getSession();
  if (!s) return;
  const owner = ownerOf(key);
  await writeCache(s.tripId, owner, key, value);
  await enqueue({ tripId: s.tripId, owner, key, value });
  flushOutbox();
}

// ---------- write outbox ----------
async function enqueue(entry) {
  const box = (await get(OUTBOX_KEY)) || {};
  box[`${entry.owner}:${entry.key}`] = entry;
  await set(OUTBOX_KEY, box);
}

let flushing = false;
export async function flushOutbox() {
  if (!online() || flushing) return;
  flushing = true;
  try {
    let box = (await get(OUTBOX_KEY)) || {};
    for (const [id, entry] of Object.entries(box)) {
      const { error } = await supabase.from("trip_kv").upsert(
        { trip_id: entry.tripId, owner: entry.owner, key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: "trip_id,owner,key" }
      );
      if (error) throw error;
      box = (await get(OUTBOX_KEY)) || {};
      delete box[id];
      await set(OUTBOX_KEY, box);
    }
  } catch { /* stay queued */ } finally {
    flushing = false;
  }
}

// ---------- realtime ----------
// onChange(key, value, owner) for every change in this trip. `owner` is
// '__shared__' or a member user id. Returns an unsubscribe fn.
export function subscribe(onChange) {
  const s = getSession();
  if (!s || !isConfigured) return () => {};

  const channel = supabase
    .channel(`trip_kv:${s.tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_kv", filter: `trip_id=eq.${s.tripId}` },
      (payload) => {
        const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
        if (!row) return;
        const value = payload.eventType === "DELETE" ? undefined : row.value;
        writeCache(s.tripId, row.owner, row.key, value);
        onChange(row.key, value, row.owner);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// Fire onJoin() whenever the trip's membership changes (someone joins/renames).
export function subscribeMembers(onJoin) {
  const s = getSession();
  if (!s || !isConfigured) return () => {};
  const channel = supabase
    .channel(`trip_members:${s.tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${s.tripId}` },
      () => onJoin()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- backup / restore (current trip: shared + your own) ----------
export async function exportAll() {
  const s = getSession();
  const rows = [];
  if (s && online()) {
    const { data } = await supabase
      .from("trip_kv").select("owner, key, value")
      .eq("trip_id", s.tripId).in("owner", [SHARED, s.userId]);
    if (data) rows.push(...data);
  }
  return { app: "uk-trip-companion", version: 2, exportedAt: new Date().toISOString(), code: s?.code ?? null, rows };
}

export async function importAll(backup) {
  if (!backup || backup.app !== "uk-trip-companion") throw new Error("Not a valid trip backup file");
  if (Array.isArray(backup.rows)) { for (const r of backup.rows) await saveKey(r.key, r.value); return; }
  if (backup.data && typeof backup.data === "object") {
    for (const [key, value] of Object.entries(backup.data)) await saveKey(key, value);
    return;
  }
  throw new Error("Not a valid trip backup file");
}

// ---------- one-time migration of pre-sync local data ----------
const LEGACY_KEYS = ["trip-itinerary", "trip-packing", "trip-expenses", "trip-bookings"];
const MIGRATED_FLAG = "__legacy_migrated__";

export async function hasLegacyData() {
  if (await get(MIGRATED_FLAG)) return false;
  const all = await keys();
  return all.some((k) => typeof k === "string" && (LEGACY_KEYS.includes(k) || k.startsWith("outfit:")));
}

export async function migrateLegacyData() {
  const all = await keys();
  for (const k of all) {
    if (typeof k !== "string") continue;
    if (LEGACY_KEYS.includes(k) || k.startsWith("outfit:")) {
      const value = await get(k);
      if (value !== undefined) await saveKey(k, value);
    }
  }
  await set(MIGRATED_FLAG, true);
  await flushOutbox();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushOutbox());
}
