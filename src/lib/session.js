import { get, set, del } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";

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
  if (session?.user) return session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user?.id ?? null;
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

// Create a brand-new trip, join it with your profile, return the session.
export async function createTrip(name, color) {
  requireConfig();
  const userId = await ensureAuth();

  let trip;
  for (let attempt = 0; attempt < 5 && !trip; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase.from("trips").insert({ code }).select().single();
    if (!error) { trip = data; break; }
    if (error.code !== "23505") throw error; // 23505 = duplicate code, retry
  }
  if (!trip) throw new Error("Couldn't create a trip — please try again.");

  await upsertMember(trip.id, name, color);
  return saveSession({ tripId: trip.id, code: trip.code, userId, name, color });
}

// Join an existing trip by code with your profile.
export async function joinTrip(code, name, color) {
  requireConfig();
  const userId = await ensureAuth();

  const normalized = code.trim().toUpperCase();
  const { data: trip, error } = await supabase
    .from("trips").select("id, code").eq("code", normalized).maybeSingle();
  if (error) throw error;
  if (!trip) throw new Error("No trip found with that code. Check the letters and try again.");

  await upsertMember(trip.id, name, color);
  return saveSession({ tripId: trip.id, code: trip.code, userId, name, color });
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
