import { supabase, isConfigured } from "./supabase.js";

// Account layer on top of Supabase auth. The app is anonymous-first: creating
// or joining a trip signs the device in anonymously (see session.ensureAuth).
// Linking an email or Google identity upgrades that SAME user in place, so all
// memberships and personal kv rows follow the account onto other devices.
// Requires (Supabase dashboard): Anonymous sign-ins ON, Email provider ON,
// Google provider ON, and "Allow manual linking" ON for linkIdentity.

export async function currentUser() {
  if (!isConfigured) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

export const isGuest = (user) => !!user && (user.is_anonymous ?? !user.email);

// ---------- linking (guest → permanent, same user id) ----------
// Step 1: attach an email to the anonymous user; Supabase emails a code.
export async function linkEmailStart(email) {
  const { error } = await supabase.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

// Step 2: confirm with the emailed 6-digit code.
export async function linkEmailVerify(email, token) {
  const { error } = await supabase.auth.verifyOtp({ type: "email_change", email: email.trim(), token: token.trim() });
  if (error) throw error;
}

// Link a Google identity (redirect flow; returns here afterwards).
export async function linkGoogle() {
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// ---------- sign-in (returning user on a new device/origin) ----------
export async function signInEmailStart(email) {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function signInEmailVerify(email, token) {
  const { error } = await supabase.auth.verifyOtp({ type: "email", email: email.trim(), token: token.trim() });
  if (error) throw error;
}

export async function signInGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// Sign out. Never offer this to guests — an anonymous identity can't sign back in.
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Permanently delete the account server-side (/api/account-delete removes
// memberships, personal data, sole-member trips, then the auth user), then
// drop the now-dead local session.
export async function deleteAccount() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  const res = await fetch("/api/account-delete", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ confirm: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Couldn't delete the account — please try again.");
  await supabase.auth.signOut().catch(() => {}); // server already deleted the user; clear local tokens
}

export function onAuthChange(callback) {
  if (!isConfigured) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  return () => subscription.unsubscribe();
}
