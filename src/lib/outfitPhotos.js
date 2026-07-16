import { get, set, del } from "idb-keyval";
import { supabase, isConfigured } from "./supabase.js";
import { getSession } from "./session.js";

// Outfit photos live in the private Storage bucket `outfit-photos` at
// <trip_id>/<uuid>.jpg (member-only via storage RLS — see
// supabase/migrations/007_outfit_photos_storage.sql). The closet kv rows
// store just the path (`photoPath`), so boot/realtime payloads stay tiny.
//
// Viewing works offline-ish: every downloaded (or uploaded) photo blob is
// cached in IndexedDB under photo:<path>, so your own closet renders with no
// signal and trip-mates' photos render offline after they've been seen once.

const BUCKET = "outfit-photos";

const cacheId = (path) => `photo:${path}`;

const friendly = (error) => {
  const msg = `${error?.message || error}`;
  if (/bucket not found|row-level security/i.test(msg)) {
    return new Error("Outfit photos need a one-time setup: run supabase/migrations/007_outfit_photos_storage.sql in the Supabase SQL editor.");
  }
  return error instanceof Error ? error : new Error(msg);
};

// Upload a compressed JPEG blob; returns the storage path for the kv value.
// Online-only (like documents) — closet building happens with a connection.
export async function uploadOutfitPhoto(blob) {
  const s = getSession();
  if (!isConfigured || !s) throw new Error("Open a trip first.");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Adding photos needs a connection — try again when you're online.");
  }
  const path = `${s.tripId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw friendly(error);
  await set(cacheId(path), blob).catch(() => {}); // uploader is offline-complete immediately
  return path;
}

// Best-effort removal (called when an outfit or its photo is replaced/deleted).
export async function deleteOutfitPhoto(path) {
  if (!path) return;
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* orphans are harmless */ }
  const memo = urls.get(path);
  if (memo) urls.delete(path);
  await del(cacheId(path)).catch(() => {});
}

// path → displayable object URL. Cache-first, then signed URL + fetch.
// Memoized per session so concurrent renders share one fetch per path.
const urls = new Map(); // path -> Promise<string>
export function getOutfitPhotoUrl(path) {
  if (!path) return Promise.resolve(null);
  if (!urls.has(path)) {
    const p = resolvePhoto(path).catch((e) => { urls.delete(path); throw e; });
    urls.set(path, p);
  }
  return urls.get(path);
}

async function resolvePhoto(path) {
  let blob = await get(cacheId(path)).catch(() => undefined);
  if (!blob) {
    if (!isConfigured) throw new Error("offline");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw friendly(error);
    const res = await fetch(data.signedUrl);
    if (!res.ok) throw new Error(`photo fetch ${res.status}`);
    blob = await res.blob();
    await set(cacheId(path), blob).catch(() => {});
  }
  return URL.createObjectURL(blob);
}
