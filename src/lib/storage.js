import { get, set, del, keys } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";
import { getSession, myId, canEditShared } from "./session.js";
import { APP_SLUG, LEGACY_APP_SLUG } from "../theme.js";

// Persistence layer. Public surface stays close to the local-only version
// (loadKey / saveKey / loadPersonalAll ...) so the tabs barely change. Under the
// hood every value is a row in Supabase's `trip_kv` table, scoped to the trip
// and — for personal slices — to the member's user id. IndexedDB is kept as an
// offline cache + a write outbox so the app still works with no signal.

const SHARED = "__shared__";
const LOCAL = "__local__"; // cache-only owner for device-local keys
const OUTBOX_KEY = "__outbox__";

// Which keys are shared between everyone vs. personal to one member, plus
// "local" keys that never leave this device.
//   trip-weather is a cache every device can rebuild from Open-Meteo. It used
//   to be a shared row written by every member's phone, which fails RLS for
//   members once roles exist (008), so it stays in IndexedDB only.
function scopeOf(key) {
  switch (key) {
    case "trip-weather":
      return "local";
    case "trip-packing":
    case "trip-itinerary-override":
      return "personal";
    default: // trip-itinerary, trip-expenses, trip-bookings, ... are shared
      return "shared";
  }
}

function ownerOf(key) {
  const scope = scopeOf(key);
  if (scope === "local") return LOCAL;
  return scope === "shared" ? SHARED : (myId() || "unknown");
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

  if (owner !== LOCAL && online()) {
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

// ---------- writes (optimistic: cache now, sync via outbox) ----------
// Shared writes are skipped when this person can't edit shared data (RLS
// would reject them, and a rejected entry would show "Sync failed"). The UI
// should already hide those controls; this is the backstop.
export async function saveKey(key, value) {
  const s = getSession();
  if (!s) return;
  const owner = ownerOf(key);
  if (owner === LOCAL) return saveLocal(key, value);
  if (owner === SHARED && !canEditShared()) {
    console.warn(`Not saved: you can't edit "${key}" on this trip.`);
    return;
  }
  await writeCache(s.tripId, owner, key, value);
  await enqueue({ tripId: s.tripId, owner, key, value });
  flushOutbox();
}

// Device-only write for "local" keys: IndexedDB, no outbox, no Supabase.
export async function saveLocal(key, value) {
  const s = getSession();
  if (!s) return;
  await writeCache(s.tripId, LOCAL, key, value);
}

// ---------- write outbox ----------
// Sync status is observable so the UI can show "n to sync / sync failed"
// instead of silently holding changes in the queue.
let syncStatus = { pending: 0, error: null };
const syncListeners = new Set();
export function subscribeSyncStatus(cb) {
  syncListeners.add(cb);
  cb(syncStatus);
  return () => syncListeners.delete(cb);
}
function setSyncStatus(patch) {
  syncStatus = { ...syncStatus, ...patch };
  for (const cb of syncListeners) cb(syncStatus);
}

async function enqueue(entry) {
  const box = (await get(OUTBOX_KEY)) || {};
  box[`${entry.owner}:${entry.key}`] = { ...entry, at: Date.now() };
  await set(OUTBOX_KEY, box);
  setSyncStatus({ pending: Object.keys(box).length });
}

let flushing = false;
export async function flushOutbox() {
  if (!online() || flushing) return;
  flushing = true;
  try {
    const snapshot = (await get(OUTBOX_KEY)) || {};
    for (const [id, entry] of Object.entries(snapshot)) {
      const { error } = await supabase.from("trip_kv").upsert(
        { trip_id: entry.tripId, owner: entry.owner, key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: "trip_id,owner,key" }
      );
      // 42501 = RLS refused it: this person may no longer edit (an organiser
      // turned "Members can edit" off while the write was queued). Retrying
      // can't succeed and would block every later write, so drop it and put
      // the server's value back in the cache.
      if (error?.code === "42501") { await dropRejected(id, entry); continue; }
      if (error) throw error;
      // Dequeue only if the entry wasn't superseded while the upsert was in
      // flight — otherwise the newer value must survive for the next flush.
      const box = (await get(OUTBOX_KEY)) || {};
      if (box[id] && box[id].at === entry.at) {
        delete box[id];
        await set(OUTBOX_KEY, box);
      }
      setSyncStatus({ pending: Object.keys(box).length });
    }
    const left = (await get(OUTBOX_KEY)) || {};
    setSyncStatus({ pending: Object.keys(left).length, error: null });
  } catch (e) {
    // Queue stays intact; surface the failure instead of swallowing it.
    setSyncStatus({ error: e?.message || "Sync failed" });
  } finally {
    flushing = false;
  }
}

async function dropRejected(id, entry) {
  const box = (await get(OUTBOX_KEY)) || {};
  if (box[id] && box[id].at === entry.at) { delete box[id]; await set(OUTBOX_KEY, box); }
  setSyncStatus({ pending: Object.keys(box).length });
  try {
    const { data } = await supabase.from("trip_kv").select("value")
      .eq("trip_id", entry.tripId).eq("owner", entry.owner).eq("key", entry.key).maybeSingle();
    if (data) await writeCache(entry.tripId, entry.owner, entry.key, data.value);
    else await del(cacheId(entry.tripId, entry.owner, entry.key));
  } catch { /* the next load refetches anyway */ }
}

// Drop every local trace of a trip (its cached kv rows + any queued outbox
// writes). Used after a trip is deleted or left so stale
// data doesn't linger.
export async function clearLocalTrip(tripId) {
  const all = await keys();
  for (const k of all)
    if (typeof k === "string" && k.startsWith(`kv:${tripId}:`)) await del(k);
  const box = (await get(OUTBOX_KEY)) || {};
  let changed = false;
  for (const [id, e] of Object.entries(box))
    if (e.tripId === tripId) { delete box[id]; changed = true; }
  if (changed) await set(OUTBOX_KEY, box);
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
        // Older app builds still write trip-weather as a shared row; this
        // device keeps its own copy, so ignore theirs.
        if (row.key && scopeOf(row.key) === "local") return;
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

// Write a kv row for an arbitrary owner (used by the legacy migration to move
// every member's rows from one device). Online-only; RLS gates on membership.
export async function upsertRow(owner, key, value) {
  const s = getSession();
  if (!s || !online()) throw new Error("You need to be online for this.");
  const { error } = await supabase.from("trip_kv").upsert(
    { trip_id: s.tripId, owner, key, value, updated_at: new Date().toISOString() },
    { onConflict: "trip_id,owner,key" }
  );
  if (error) throw error;
  await writeCache(s.tripId, owner, key, value);
}

// ---------- retired outfit data ----------
// Outfits and try-on are gone (migration 009 purges the rows and photos).
// Old backups can still carry outfit-*, outfit:<day> and tryon-base-photo
// rows; restoring them would now land as shared rows, so they're skipped.
const isRetiredKey = (key) =>
  typeof key === "string" && (key.startsWith("outfit") || key === "tryon-base-photo");

// Devices still hold cached outfit rows, face photos and downloaded outfit
// photo blobs (photo:<path>) in IndexedDB. Drop them once, best-effort.
async function purgeRetiredCache() {
  for (const k of await keys()) {
    if (typeof k !== "string") continue;
    if (k.startsWith("photo:")) { await del(k); continue; }
    if (!k.startsWith("kv:")) continue;
    // kv:<tripId>:<owner>:<key>; trip ids and owners are uuids or __x__, no colons.
    const key = k.split(":").slice(3).join(":");
    if (isRetiredKey(key)) await del(k);
  }
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
  return { app: APP_SLUG, version: 2, exportedAt: new Date().toISOString(), code: s?.code ?? null, rows };
}

export async function importAll(backup) {
  if (!backup || (backup.app !== APP_SLUG && backup.app !== LEGACY_APP_SLUG)) throw new Error("Not a valid trip backup file");
  if (Array.isArray(backup.rows)) {
    for (const r of backup.rows) if (!isRetiredKey(r.key)) await saveKey(r.key, r.value);
    return;
  }
  if (backup.data && typeof backup.data === "object") {
    for (const [key, value] of Object.entries(backup.data)) if (!isRetiredKey(key)) await saveKey(key, value);
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
  return all.some((k) => typeof k === "string" && LEGACY_KEYS.includes(k));
}

export async function migrateLegacyData() {
  const all = await keys();
  for (const k of all) {
    if (typeof k !== "string") continue;
    if (LEGACY_KEYS.includes(k)) {
      const value = await get(k);
      if (value !== undefined) await saveKey(k, value);
    }
  }
  await set(MIGRATED_FLAG, true);
  await flushOutbox();
}

if (typeof window !== "undefined") {
  purgeRetiredCache().catch(() => {});
  window.addEventListener("online", () => flushOutbox());
  // Surface any queue left over from a previous session right away.
  get(OUTBOX_KEY).then((box) => { if (box) setSyncStatus({ pending: Object.keys(box).length }); }).catch(() => {});
}
