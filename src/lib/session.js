import { get, set, del } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";
import { getProfile, saveProfile, syncProfileToAuth } from "./profile.js";
import { clearLocalTrip } from "./storage.js";
import shiftTrip from "./shiftTrip.js";

// The session ties this device to a shared trip and to the profile (name +
// colour) this person chose. It's cached locally so the app boots instantly
// and works offline; Supabase is the source of truth once online.

// { tripId, code, userId, name, color, role, membersCanEdit }
//   role: "organiser" | "member" (this person on this trip)
//   membersCanEdit: the trip's members_can_edit switch (migration 008)
const SESSION_KEY = "__session__";
const SHARED = "__shared__";

// Colours members can pick for their profile (the Grand Tour member palette;
// legacy stored colours keep rendering as-is — see theme.js).
export { MEMBER_COLORS as COLORS } from "../theme.js";

let cached; // in-memory copy of the session

// Listeners for any session change, so the UI re-renders when an organiser
// changes this person's role or the trip's "Members can edit" switch.
const sessionListeners = new Set();
export function subscribeSession(cb) {
  sessionListeners.add(cb);
  return () => sessionListeners.delete(cb);
}

export function getSession() {
  return cached || null;
}

// This device's member id (its owner key for personal data).
export function myId() {
  return cached?.userId || null;
}

// Can I write this trip's shared data (itinerary, bookings, documents,
// config)? Synchronous so render code can call it. No session means no: the
// read-only demo relies on that. RLS enforces the same rule server-side.
export function canEditShared() {
  if (!cached) return false;
  return cached.role === "organiser" || cached.membersCanEdit === true;
}

export async function loadSession() {
  if (cached) return cached;
  let stored = (await get(SESSION_KEY)) || null;
  // Discard sessions from an older app version (before named profiles), which
  // lack userId/name — they'd break loading and re-onboarding fixes them.
  if (stored && (!stored.userId || !stored.name)) {
    await del(SESSION_KEY);
    setCached(null);
    return null;
  }
  // Sessions saved before roles existed belong to pre-008 trips, where the
  // backfill made everyone an organiser. The refresh below corrects it.
  if (stored && stored.role === undefined) stored = { ...stored, role: "organiser", membersCanEdit: true };
  setCached(stored);
  if (stored) refreshAccess();
  return cached;
}

async function saveSession(next) {
  setCached(next);
  await set(SESSION_KEY, next);
  return next;
}

export async function clearSession() {
  setCached(null);
  await del(SESSION_KEY);
}

function setCached(next) {
  cached = next;
  watchAccess();
  for (const cb of sessionListeners) cb(cached || null);
}

// ---------- role and "Members can edit" ----------

// Databases without migration 008 have no role or members_can_edit columns.
// There every member can write everything, so treat everyone as an organiser.
const columnMissing = (error) => error?.code === "42703";
const LEGACY_ACCESS = { role: "organiser", membersCanEdit: true };

// Run a select with the 008 columns; on a pre-008 database, run it again
// without them.
async function selectCompat(run, cols, legacyCols) {
  const res = await run(cols);
  return columnMissing(res.error) ? run(legacyCols) : res;
}

// { role, membersCanEdit } for a user on a trip, or null when they aren't on it.
async function fetchAccess(tripId, userId) {
  const [m, t] = await Promise.all([
    supabase.from("trip_members").select("role").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
    supabase.from("trips").select("members_can_edit").eq("id", tripId).maybeSingle(),
  ]);
  if (columnMissing(m.error) || columnMissing(t.error)) return LEGACY_ACCESS;
  if (m.error) throw m.error;
  if (t.error) throw t.error;
  if (!m.data || !t.data) return null;
  return { role: m.data.role, membersCanEdit: !!t.data.members_can_edit };
}

// Re-read my role and the trip's switch from the server. Called on boot, on
// realtime changes to trip_members or trips, and when the app regains focus,
// so an organiser's change reaches open apps without a reinstall. Offline or
// on error it keeps the cached values.
export async function refreshAccess() {
  const s = cached;
  if (!s || !isConfigured || (typeof navigator !== "undefined" && navigator.onLine === false)) return s || null;
  try {
    const access = await fetchAccess(s.tripId, s.userId);
    if (!access || cached?.tripId !== s.tripId) return cached || null;
    if (access.role !== cached.role || access.membersCanEdit !== cached.membersCanEdit) {
      await saveSession({ ...cached, ...access });
    }
  } catch { /* offline or transient — keep what we have */ }
  return cached || null;
}

// One pair of realtime channels for the current trip, swapped when the trip
// changes. Two channels, not one, so a database where `trips` isn't in the
// realtime publication yet (pre-008) can't break the trip_members one.
let watch = null; // { tripId, channels }
function watchAccess() {
  const tripId = cached?.tripId || null;
  if (watch?.tripId === tripId) return;
  if (watch) { for (const ch of watch.channels) supabase.removeChannel(ch); watch = null; }
  if (!tripId || !isConfigured) return;
  const listen = (table, filter) =>
    supabase.channel(`session-access:${table}:${tripId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, () => refreshAccess())
      .subscribe();
  watch = { tripId, channels: [listen("trip_members", `trip_id=eq.${tripId}`), listen("trips", `id=eq.${tripId}`)] };
}

// Backstop for missed realtime events (phone asleep, socket dropped).
let lastFocusRefresh = 0;
function refreshOnFocus() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  if (Date.now() - lastFocusRefresh < 15000) return;
  lastFocusRefresh = Date.now();
  refreshAccess();
}
if (typeof window !== "undefined") {
  window.addEventListener("focus", refreshOnFocus);
  window.addEventListener("online", refreshOnFocus);
  document.addEventListener("visibilitychange", refreshOnFocus);
}

// Turn an RPC error into a thrown Error with a plain message.
function rpcError(error) {
  if (rpcMissing(error)) return new Error("The app's backend isn't fully set up — please try again later.");
  const msg = `${error?.message || ""}`;
  if (msg.includes("at least one organiser")) return new Error("A trip needs at least one organiser.");
  if (msg.includes("only an organiser")) return new Error("Only an organiser can do that.");
  return Object.assign(new Error(msg || "Something went wrong — please try again."), { code: error?.code });
}

function requireOrganiser() {
  requireConfig();
  const s = getSession();
  if (!s) throw new Error("No active trip.");
  if (s.role !== "organiser") throw new Error("Only an organiser can do that.");
  return s;
}

// Organiser only: let members edit shared trip data, or make it read-only for them.
export async function setMembersCanEdit(value) {
  const s = requireOrganiser();
  const next = !!value;
  const { error } = await supabase.rpc("set_members_can_edit", { p_trip_id: s.tripId, p_value: next });
  if (error) throw rpcError(error);
  if (cached?.tripId === s.tripId) await saveSession({ ...cached, membersCanEdit: next });
}

// Organiser only: make someone a co-organiser ("organiser") or a "member".
// The server refuses to demote the trip's last organiser.
export async function setMemberRole(userId, role) {
  const s = requireOrganiser();
  if (role !== "organiser" && role !== "member") throw new Error("Role must be organiser or member.");
  const { error } = await supabase.rpc("set_member_role", { p_trip_id: s.tripId, p_user_id: userId, p_role: role });
  if (error) throw rpcError(error);
  if (userId === s.userId && cached?.tripId === s.tripId) await saveSession({ ...cached, role });
}

// Ensure an anonymous auth user exists; returns its id (or null if unconfigured).
export async function ensureAuth() {
  if (!isConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    syncProfileToAuth().catch(() => {});
    return session.user.id;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  await syncProfileToAuth().catch(() => {});
  return data.user?.id ?? null;
}

// First trip create/join also seeds the global profile if there is none yet.
async function adoptProfile(name, color) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!getProfile(user)?.name) await saveProfile({ name, color });
  } catch { /* non-fatal */ }
}

// Human-friendly join code: 6 chars, no ambiguous 0/O/1/I.
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function requireConfig() {
  if (!isConfigured) throw new Error("Supabase isn't set up yet — see supabase/SETUP.md.");
}

// True when the DB error means "that RPC doesn't exist (yet)" — the matching
// migration in supabase/migrations/ hasn't been run on this database.
const rpcMissing = (error) => error && (error.code === "PGRST202" || error.code === "42883");

// Create a brand-new trip, join it with your profile, return the session.
// Goes through the create_trip_with_code RPC (001); direct table access is
// blocked by the members-only trips_select policy (005).
export async function createTrip(name, color) {
  requireConfig();
  const userId = await ensureAuth();

  let trip;
  for (let attempt = 0; attempt < 5 && !trip; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase.rpc("create_trip_with_code", { p_code: code, p_name: name, p_color: color });
    if (!error) { const row = Array.isArray(data) ? data[0] : data; trip = { id: row.trip_id, code: row.trip_code }; break; }
    if (rpcMissing(error)) throw new Error("The app's backend isn't fully set up — please try again later.");
    if (error.code !== "23505" && !`${error.message}`.includes("23505")) throw error; // duplicate code → retry
  }
  if (!trip) throw new Error("Couldn't create a trip — please try again.");
  await adoptProfile(name, color);
  // The creator is the organiser (008); members_can_edit starts at its default, true.
  return saveSession({ tripId: trip.id, code: trip.code, userId, name, color, role: "organiser", membersCanEdit: true });
}

// Join an existing trip by code with your profile.
export async function joinTrip(code, name, color) {
  requireConfig();
  const userId = await ensureAuth();
  const normalized = code.trim().toUpperCase();

  const { data, error } = await supabase.rpc("join_trip_with_code", { p_code: normalized, p_name: name, p_color: color });
  if (error) {
    if (rpcMissing(error)) throw new Error("The app's backend isn't fully set up — please try again later.");
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("No trip found with that code. Check the letters and try again.");
  await adoptProfile(name, color);
  // Rejoining keeps whatever role you had; a new joiner is a member. If the
  // lookup fails, start read-only and let refreshAccess() correct it.
  const access = (await fetchAccess(row.trip_id, userId).catch(() => null)) || { role: "member", membersCanEdit: false };
  return saveSession({ tripId: row.trip_id, code: row.trip_code, userId, name, color, ...access });
}

// Re-enter a trip this user already belongs to (from the Your Trips screen).
// `trip` is a listMyTrips() entry; refreshAccess() confirms the role after.
export async function enterTrip(trip) {
  requireConfig();
  const userId = await ensureAuth();
  const session = await saveSession({
    tripId: trip.id, code: trip.code, userId, name: trip.myName, color: trip.myColor,
    role: trip.myRole || LEGACY_ACCESS.role,
    membersCanEdit: trip.membersCanEdit ?? LEGACY_ACCESS.membersCanEdit,
  });
  refreshAccess();
  return session;
}

// Leave the trip view back to the trips list (keeps auth + memberships).
export async function leaveToHome() {
  await clearSession();
}

// Permanently destroy a trip (only allowed when you're its sole member — the
// RPC enforces this too). Cascades away all members + kv content; we also clear
// the trip's uploaded documents and this device's local cache.
export async function deleteTrip(tripId) {
  requireConfig();
  await ensureAuth();

  // Uploaded documents live in Storage, which the DB cascade doesn't reach.
  // Remove them while we're still a member (storage RLS is member-only).
  try {
    const { data: files } = await supabase.storage.from("trip-docs").list(tripId);
    if (files?.length) {
      await supabase.storage.from("trip-docs").remove(files.map((f) => `${tripId}/${f.name}`));
    }
  } catch { /* best-effort — orphaned files are harmless */ }

  const { error } = await supabase.rpc("delete_trip", { p_trip_id: tripId });
  if (error) {
    if (rpcMissing(error)) throw new Error("Deleting trips needs a one-time setup: run supabase/migrations/003_delete_trip.sql in the Supabase SQL editor.");
    throw error;
  }

  await clearLocalTrip(tripId);
  if (getSession()?.tripId === tripId) await clearSession();
}

// Leave a shared trip: remove only your own membership (and your personal data),
// leaving the trip intact for everyone else.
export async function leaveTrip(tripId) {
  requireConfig();
  await ensureAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // Clear your own personal rows first (still permitted while a member).
  try {
    await supabase.from("trip_kv").delete().eq("trip_id", tripId).eq("owner", user.id);
  } catch { /* best-effort */ }

  // If you're the last organiser, migration 010's trigger promotes the
  // earliest-joined remaining member in the same transaction, so the trip is
  // never left without one and this delete doesn't need to wait for it.
  const { error } = await supabase
    .from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
  if (error) throw error;

  await clearLocalTrip(tripId);
  if (getSession()?.tripId === tripId) await clearSession();
}

// All trips this user belongs to, newest membership first:
// [{ id, code, createdAt, myName, myColor, myRole, membersCanEdit,
//    members: [{user_id,name,color,role}], config }]
export async function listMyTrips() {
  if (!isConfigured) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: mine, error } = await selectCompat(
    (cols) => supabase.from("trip_members").select(cols).eq("user_id", user.id),
    "trip_id, name, color, role", "trip_id, name, color");
  if (error) throw error;
  if (!mine?.length) return [];
  const ids = mine.map((m) => m.trip_id);

  const [tripsRes, membersRes, configsRes] = await Promise.all([
    selectCompat((cols) => supabase.from("trips").select(cols).in("id", ids),
      "id, code, created_at, members_can_edit", "id, code, created_at"),
    selectCompat((cols) => supabase.from("trip_members").select(cols).in("trip_id", ids),
      "trip_id, user_id, name, color, role", "trip_id, user_id, name, color"),
    supabase.from("trip_kv").select("trip_id, value").eq("key", "trip-config").eq("owner", SHARED).in("trip_id", ids),
  ]);
  if (tripsRes.error) throw tripsRes.error;

  const configByTrip = Object.fromEntries((configsRes.data || []).map((r) => [r.trip_id, r.value]));
  const membersByTrip = {};
  for (const m of membersRes.data || []) (membersByTrip[m.trip_id] ||= []).push({ ...m, role: m.role || LEGACY_ACCESS.role });

  return (tripsRes.data || []).map((t) => {
    const my = mine.find((m) => m.trip_id === t.id);
    return {
      id: t.id,
      code: t.code,
      createdAt: t.created_at,
      myName: my?.name,
      myColor: my?.color,
      myRole: my?.role || LEGACY_ACCESS.role,
      membersCanEdit: t.members_can_edit ?? LEGACY_ACCESS.membersCanEdit,
      members: membersByTrip[t.id] || [],
      config: configByTrip[t.id] || null,
    };
  });
}

// "Run this trip again" (organiser only): a new trip with a fresh code and
// this person as its only member and organiser, holding the old trip's
// config, shared day notes and bookings checklist moved to `newStartISO`
// (see shiftTrip.js). Members, expenses, documents and personal data stay
// behind. The trip's "Members can edit" setting carries over. Online only.
// Returns the new session, like createTrip(), and switches to it.
const COPY_KEYS = ["trip-config", "trip-itinerary", "trip-bookings"];

export async function duplicateTrip(tripId, newStartISO) {
  requireConfig();
  const userId = await ensureAuth();

  const [meRes, tripRes, kvRes] = await Promise.all([
    selectCompat((cols) => supabase.from("trip_members").select(cols).eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
      "name, color, role", "name, color"),
    selectCompat((cols) => supabase.from("trips").select(cols).eq("id", tripId).maybeSingle(),
      "id, members_can_edit", "id"),
    supabase.from("trip_kv").select("key, value").eq("trip_id", tripId).eq("owner", SHARED).in("key", COPY_KEYS),
  ]);
  for (const res of [meRes, tripRes, kvRes]) if (res.error) throw res.error;
  const me = meRes.data;
  if (!me || !tripRes.data) throw new Error("You're not on that trip.");
  if ((me.role || LEGACY_ACCESS.role) !== "organiser") throw new Error("Only an organiser can run this trip again.");

  const source = Object.fromEntries((kvRes.data || []).map((r) => [r.key, r.value]));
  if (!source["trip-config"]) throw new Error("That trip has no plan to copy yet.");
  // Shift before creating anything, so a bad date fails without a stray trip.
  const shifted = shiftTrip(source["trip-config"], source, newStartISO);

  const session = await createTrip(me.name, me.color);
  const now = new Date().toISOString();
  const rows = [["trip-config", shifted.config], ...Object.entries(shifted.kv)].map(([key, value]) => (
    { trip_id: session.tripId, owner: SHARED, key, value, updated_at: now }
  ));
  const { error } = await supabase.from("trip_kv").upsert(rows, { onConflict: "trip_id,owner,key" });
  if (error) throw error;

  if (tripRes.data.members_can_edit === false) await setMembersCanEdit(false);
  return getSession();
}

// Insert this member; if already present, update the name/colour instead.
// (A plain insert is used first because an upsert's ON CONFLICT needs read
// visibility we don't have until the membership row exists.)
async function upsertMember(tripId, name, color) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("trip_members")
    .insert({ trip_id: tripId, user_id: user.id, name, color });
  if (!error) return;
  if (error.code === "23505") {
    const { error: updateErr } = await supabase
      .from("trip_members").update({ name, color })
      .eq("trip_id", tripId).eq("user_id", user.id);
    if (updateErr) throw updateErr;
    return;
  }
  throw error;
}

// Rename / recolour yourself later.
export async function setProfile(name, color) {
  const s = getSession();
  if (!s) throw new Error("No active trip.");
  if (isConfigured) await upsertMember(s.tripId, name, color);
  return saveSession({ ...s, name, color });
}

// All members of the current trip: [{ user_id, name, color, role }]. Falls
// back to just this device's own profile when offline.
export async function loadMembers() {
  const s = getSession();
  if (!s) return [];
  if (isConfigured) {
    try {
      const { data, error } = await selectCompat(
        (cols) => supabase.from("trip_members").select(cols).eq("trip_id", s.tripId),
        "user_id, name, color, role", "user_id, name, color");
      if (error) throw error;
      if (data?.length) return data.map((m) => ({ ...m, role: m.role || LEGACY_ACCESS.role }));
    } catch { /* offline — fall through */ }
  }
  return [{ user_id: s.userId, name: s.name, color: s.color, role: s.role }];
}
