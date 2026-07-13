import { supabase, isConfigured } from "./supabase.js";
import { getSession } from "./session.js";

// Documents wallet: files live in the private Storage bucket `trip-docs`
// (path <trip_id>/<uuid>-<filename>, member-only via storage RLS — see
// supabase/migrations/002_documents_storage.sql). The document *list* is
// shared kv under DOCS_KEY, so it syncs/backs up like everything else.

const BUCKET = "trip-docs";
export const DOCS_KEY = "trip-documents";
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

const friendly = (error) => {
  const msg = `${error?.message || error}`;
  if (/bucket not found|row-level security/i.test(msg)) {
    return new Error("Documents need a one-time setup: run supabase/migrations/002_documents_storage.sql in the Supabase SQL editor.");
  }
  return error instanceof Error ? error : new Error(msg);
};

// Upload a file; returns the metadata entry to append to the DOCS_KEY list.
export async function uploadDocument(file) {
  const s = getSession();
  if (!isConfigured || !s) throw new Error("Open a trip first.");
  if (!navigator.onLine) throw new Error("Uploading needs a connection.");
  if (file.size > MAX_DOC_BYTES) throw new Error("Files are capped at 10 MB.");
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
  const path = `${s.tripId}/${id}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw friendly(error);
  return { id, name: file.name, path, size: file.size, type: file.type || "", addedBy: s.userId, ts: Date.now() };
}

// Short-lived signed URL for viewing/downloading (bucket is private).
export async function docUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw friendly(error);
  return data.signedUrl;
}

export async function removeDocument(doc) {
  const { error } = await supabase.storage.from(BUCKET).remove([doc.path]);
  if (error) throw friendly(error);
}

export const docIcon = (type) =>
  type?.startsWith("image/") ? "🖼️" : type === "application/pdf" ? "📄" : "📎";

export function docSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
