import { get, set, del } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";
import { getProfile, saveProfile, syncProfileToAuth } from "./profile.js";
import { clearLocalTrip } from "./storage.js";

// The session ties this device to a shared trip and to the profile (name +
// colour) this person chose. It's cached locally so the app boots instantly
// and works offline; Supabase is the source of truth once online.

const SESSION_KEY = "__session__"; // { tripId, code, userId, name, color }

// Colours members can pick for their profile.
export const COLORS = ["#1D2433", "#5B3B8C", "#C8102E", "#2E7D4F", "#C77E1F", "#0F7C8C"];

let cached; // in-memory copy of the session

export function getSession() {
  return cached || null;
}

// This device's member id (its owner key for personal data).
export function myId() {
  return cached?.userId || null;
}

export async function loadSession() {
  if (cached) return cached;
  const stored = (await get(SESSION_KEY)) || null;
  // Discard sessions from an older app version (before named profiles), which
  // lack userId/name — they'd break loading and re-onboarding fixes them.
  if (stored && (!stored.userId || !stored.name)) {
    await del(SESSION_KEY);
    cached = null;
    return null;
  }
  cached = stored;
  return cached;
}

async function saveSession(next) {
  cached = next;
  await set(SESSION_KEY, next);
  return next;
}

export async function clearSession() {
  cached = null;
  await del(SESSION_KEY);
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
  return saveSession({ tripId: trip.id, code: trip.code, userId, name, color });
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
  return saveSession({ tripId: row.trip_id, code: row.trip_code, userId, name, color });
}

// Re-enter a trip this user already belongs to (from the Your Trips screen).
export async function enterTrip(trip) {
  requireConfig();
  const userId = await ensureAuth();
  return saveSession({ tripId: trip.id, code: trip.code, userId, name: trip.myName, color: trip.myColor });
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

  const { error } = await supabase
    .from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
  if (error) throw error;

  await clearLocalTrip(tripId);
  if (getSession()?.tripId === tripId) await clearSession();
}

// All trips this user belongs to, newest membership first:
// [{ id, code, myName, myColor, members: [{user_id,name,color}], config }]
export async function listMyTrips() {
  if (!isConfigured) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: mine, error } = await supabase
    .from("trip_members").select("trip_id, name, color").eq("user_id", user.id);
  if (error) throw error;
  if (!mine?.length) return [];
  const ids = mine.map((m) => m.trip_id);

  const [tripsRes, membersRes, configsRes] = await Promise.all([
    supabase.from("trips").select("id, code, created_at").in("id", ids),
    supabase.from("trip_members").select("trip_id, user_id, name, color").in("trip_id", ids),
    supabase.from("trip_kv").select("trip_id, value").eq("key", "trip-config").eq("owner", "__shared__").in("trip_id", ids),
  ]);
  if (tripsRes.error) throw tripsRes.error;

  const configByTrip = Object.fromEntries((configsRes.data || []).map((r) => [r.trip_id, r.value]));
  const membersByTrip = {};
  for (const m of membersRes.data || []) (membersByTrip[m.trip_id] ||= []).push(m);

  return (tripsRes.data || []).map((t) => {
    const my = mine.find((m) => m.trip_id === t.id);
    return {
      id: t.id,
      code: t.code,
      createdAt: t.created_at,
      myName: my?.name,
      myColor: my?.color,
      members: membersByTrip[t.id] || [],
      config: configByTrip[t.id] || null,
    };
  });
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

// All members of the current trip: [{ user_id, name, color }]. Falls back to
// just this device's own profile when offline.
export async function loadMembers() {
  const s = getSession();
  if (!s) return [];
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from("trip_members").select("user_id, name, color").eq("trip_id", s.tripId);
      if (error) throw error;
      if (data?.length) return data;
    } catch { /* offline — fall through */ }
  }
  return [{ user_id: s.userId, name: s.name, color: s.color }];
}
