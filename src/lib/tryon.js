import { supabase, isConfigured } from "./supabase.js";
import { loadKey, saveKey } from "./storage.js";

// Client side of the virtual try-on feature. The base photo (a picture of
// yourself) is a personal kv row that is never rendered for other members;
// generation happens server-side via /api/tryon so no engine keys ship in
// the bundle.

export const loadBasePhoto = () => loadKey("tryon-base-photo", null);
export const saveBasePhoto = (photo) => saveKey("tryon-base-photo", photo ? { photo } : null);

// POST the base + garment photos to the try-on endpoint → generated data-URL.
// Throws Error with `.code` = quota | busy | unavailable | unauthorized | ...
export async function generateTryOn(personPhoto, garmentPhoto, desc) {
  let token = "";
  if (isConfigured) {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || "";
  }
  const res = await fetch("/api/tryon", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ person: personPhoto, garment: garmentPhoto, desc }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || "Try-on failed — please try again.");
    err.code = body.error;
    throw err;
  }
  return body.photo;
}
