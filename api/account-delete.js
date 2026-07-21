import { createClient } from "@supabase/supabase-js";
import { reportError } from "./_lib/sentry.js";

// Account deletion endpoint. Removes the caller's account and everything only
// they own: personal trip_kv rows, their outfit photos, memberships, trips
// where they are the sole member (including that trip's documents), and
// finally the auth user itself. Trips shared with other members survive, and
// shared rows the caller wrote stay (documented in the privacy policy).
//
// Needs SUPABASE_SERVICE_ROLE_KEY (server-only, never VITE_-prefixed): RLS has
// no delete path for another-user cleanup, and auth.admin.deleteUser requires
// it. Runs as a Vercel function (and is mounted on the Vite dev server by
// vite.config.js).

export const config = { maxDuration: 60 };

// Host-agnostic core: (body, authorization header) → { status, body }.
export async function runAccountDelete(body, authHeader) {
  if (body?.confirm !== true) {
    return reply(400, "bad-input", "Send `confirm: true` to delete the account.");
  }

  const supaUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    console.error("account-delete: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing");
    return reply(503, "misconfigured", "Account deletion is temporarily unavailable.");
  }

  // Identify the caller from their JWT. Fail closed — this endpoint must never
  // delete anyone it can't positively identify.
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, "unauthorized", "Sign in to delete your account.");
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  if (userErr || !uid) return reply(401, "unauthorized", "Sign in to delete your account.");

  try {
    const { data: memberships, error: memErr } = await admin
      .from("trip_members").select("trip_id").eq("user_id", uid);
    if (memErr) throw memErr;

    for (const { trip_id: tripId } of memberships || []) {
      const { count, error: cntErr } = await admin
        .from("trip_members").select("*", { count: "exact", head: true })
        .eq("trip_id", tripId);
      if (cntErr) throw cntErr;

      if ((count ?? 0) <= 1) {
        // Sole member — the trip dies with the account, storage included
        // (the DB cascade from trips doesn't reach Storage objects).
        await removePrefix(admin, "trip-docs", tripId);
        await removePrefix(admin, "outfit-photos", tripId);
        const { error } = await admin.from("trips").delete().eq("id", tripId);
        if (error) throw error; // cascades trip_members + trip_kv
      } else {
        // Shared trip — take only the caller's slice: their outfit photos
        // (paths live in their personal kv rows, so read before deleting),
        // their personal kv rows, then their membership.
        const { data: rows } = await admin
          .from("trip_kv").select("value")
          .eq("trip_id", tripId).eq("owner", uid).like("key", "outfit-item:%");
        const paths = (rows || []).map((r) => r.value?.photoPath).filter(Boolean);
        if (paths.length) {
          await admin.storage.from("outfit-photos").remove(paths).catch(() => {});
        }
        const { error: kvErr } = await admin
          .from("trip_kv").delete().eq("trip_id", tripId).eq("owner", uid);
        if (kvErr) throw kvErr;
        const { error: mErr } = await admin
          .from("trip_members").delete().eq("trip_id", tripId).eq("user_id", uid);
        if (mErr) throw mErr;
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error("account-delete failed:", e?.message || e);
    await reportError(e, { fn: "account-delete" });
    return reply(500, "failed", "Couldn't delete the account — please try again or email support@roundtrip.one.");
  }
}

// Delete every object under <prefix>/ in a bucket (list() pages at 100).
async function removePrefix(admin, bucket, prefix) {
  for (;;) {
    const { data: files, error } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
    if (error || !files?.length) return; // best-effort — orphans are harmless
    const { error: rmErr } = await admin.storage.from(bucket)
      .remove(files.map((f) => `${prefix}/${f.name}`));
    if (rmErr || files.length < 100) return;
  }
}

const reply = (status, error, message) => ({ status, body: { error, message } });

// Vercel entrypoint.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method-not-allowed", message: "POST only." });
  const out = await runAccountDelete(req.body, req.headers.authorization);
  return res.status(out.status).json(out.body);
}
