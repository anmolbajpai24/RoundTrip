import { supabase, isConfigured } from "./supabase.js";

// Global identity: the display name + colour that follow this account across
// trips (each trip's membership can still use a different name/colour).
// Stored in Supabase auth user_metadata so it survives account linking and
// device moves; mirrored in localStorage so it exists before first sign-in.

const LOCAL_KEY = "roundtrip:profile"; // { name, color }

export function getLocalProfile() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); } catch { return null; }
}

// Best profile we know for this user: auth metadata first, local fallback.
export function getProfile(user) {
  const meta = user?.user_metadata;
  if (meta?.name) return { name: meta.name, color: meta.color || null };
  return getLocalProfile();
}

export async function saveProfile({ name, color }) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ name, color })); } catch { /* private mode */ }
  if (!isConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return; // lands in user_metadata later via syncProfileToAuth
  const { error } = await supabase.auth.updateUser({ data: { name, color } });
  if (error) throw error;
}

// Push a pre-auth local profile into user_metadata once a session exists.
// No-op when metadata already has a name (never overwrites).
export async function syncProfileToAuth() {
  if (!isConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user || user.user_metadata?.name) return;
  const local = getLocalProfile();
  if (!local?.name) return;
  await supabase.auth.updateUser({ data: local });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
