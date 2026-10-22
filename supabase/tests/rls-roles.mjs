// RLS check for migration 008 (roles). Run against roundtrip-dev ONLY, after
// 008 has been applied there:
//
//   node --env-file=.env.local supabase/tests/rls-roles.mjs
//
// It reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment
// and never prints them. It signs in three throwaway anonymous users
// (organiser, member A, member B), builds one trip, checks what each may
// write, then deletes the trip. Uses 3 of the project's anonymous sign-ins
// (Supabase limits these per IP per hour). Exit code 1 if any check fails.

// Node script, but eslint.config.js only gives api/ node globals.
/* global process, console, Blob */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (e.g. node --env-file=.env.local ...).");
  process.exit(2);
}
if (!process.argv.includes("--i-know-this-is-dev")) {
  console.log("This creates and deletes a test trip. Add --i-know-this-is-dev to run it against roundtrip-dev.");
  process.exit(2);
}

const SHARED = "__shared__";
let failures = 0;
const pass = (name) => console.log(`PASS  ${name}`);
const fail = (name, detail) => { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ""}`); };

async function user(label) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`${label}: anonymous sign-in failed: ${error.message}`);
  return { client, id: data.user.id, label };
}

const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const upsert = (u, tripId, owner, k, value) =>
  u.client.from("trip_kv").upsert({ trip_id: tripId, owner, key: k, value, updated_at: new Date().toISOString() }, { onConflict: "trip_id,owner,key" });

async function readRow(u, tripId, owner, k) {
  const { data } = await u.client.from("trip_kv").select("value").eq("trip_id", tripId).eq("owner", owner).eq("key", k).maybeSingle();
  return data?.value;
}

// A write that must be refused. Upserts and RPCs come back with an error;
// updates and deletes that RLS filters out "succeed" on zero rows, so those
// are checked by reading the row back.
async function expectDenied(name, run) {
  const { error } = await run();
  if (error) pass(name); else fail(name, "write was allowed");
}
async function expectAllowed(name, run) {
  const { error } = await run();
  if (!error) pass(name); else fail(name, `${error.code || ""} ${error.message}`);
}
async function expectValue(name, actual, expected) {
  if (JSON.stringify(await actual) === JSON.stringify(expected)) pass(name);
  else fail(name, `got ${JSON.stringify(await actual)}`);
}

async function main() {
  const org = await user("organiser");
  const a = await user("member A");
  const b = await user("member B");

  // ---- setup: organiser creates the trip, A and B join ----
  const { data: created, error: createErr } = await org.client.rpc("create_trip_with_code", { p_code: code(), p_name: "RLS Org", p_color: "#1D2433" });
  if (createErr) throw new Error(`create_trip_with_code: ${createErr.message}`);
  const trip = (Array.isArray(created) ? created[0] : created);
  const tripId = trip.trip_id;
  console.log(`test trip ${trip.trip_code}`);

  try {
    for (const m of [a, b]) {
      const { error } = await m.client.rpc("join_trip_with_code", { p_code: trip.trip_code, p_name: `RLS ${m.label}`, p_color: "#1D2433" });
      if (error) throw new Error(`${m.label} join: ${error.message}`);
    }

    // ---- shape: created_by, roles, default switch ----
    const { data: tRow } = await org.client.from("trips").select("created_by, members_can_edit").eq("id", tripId).maybeSingle();
    if (tRow?.created_by === org.id) pass("trips.created_by is the creator"); else fail("trips.created_by is the creator", JSON.stringify(tRow));
    if (tRow?.members_can_edit === true) pass("members_can_edit defaults to true"); else fail("members_can_edit defaults to true");
    const { data: roles } = await org.client.from("trip_members").select("user_id, role").eq("trip_id", tripId);
    const roleOf = (id) => roles?.find((r) => r.user_id === id)?.role;
    if (roleOf(org.id) === "organiser" && roleOf(a.id) === "member" && roleOf(b.id) === "member") pass("creator is organiser, joiners are members");
    else fail("creator is organiser, joiners are members", JSON.stringify(roles));

    // Seed rows: a shared row by the organiser and a personal row for B.
    await expectAllowed("organiser writes a shared row", () => upsert(org, tripId, SHARED, "trip-bookings", ["org"]));
    await expectAllowed("member B writes own personal row", () => upsert(b, tripId, b.id, "trip-packing", ["b"]));

    // ---- members can't edit ----
    await expectDenied("member can't call set_members_can_edit", () => a.client.rpc("set_members_can_edit", { p_trip_id: tripId, p_value: false }));
    await expectAllowed("organiser turns members_can_edit off", () => org.client.rpc("set_members_can_edit", { p_trip_id: tripId, p_value: false }));

    await expectDenied("[locked] member upserts a shared row", () => upsert(a, tripId, SHARED, "trip-bookings", ["a"]));
    await expectDenied("[locked] member inserts a new shared row", () => upsert(a, tripId, SHARED, "trip-itinerary", { x: 1 }));
    await a.client.from("trip_kv").update({ value: ["a-update"] }).eq("trip_id", tripId).eq("owner", SHARED).eq("key", "trip-bookings");
    await a.client.from("trip_kv").delete().eq("trip_id", tripId).eq("owner", SHARED).eq("key", "trip-bookings");
    await expectValue("[locked] member update/delete leaves the shared row alone", readRow(org, tripId, SHARED, "trip-bookings"), ["org"]);
    await expectDenied("[locked] member upserts another member's personal row", () => upsert(a, tripId, b.id, "trip-packing", ["a"]));
    await a.client.from("trip_kv").delete().eq("trip_id", tripId).eq("owner", b.id);
    await expectValue("[locked] member can't delete another member's personal row", readRow(b, tripId, b.id, "trip-packing"), ["b"]);
    await expectAllowed("[locked] member writes own personal row", () => upsert(a, tripId, a.id, "trip-packing", ["a"]));
    await expectAllowed("[locked] organiser writes a shared row", () => upsert(org, tripId, SHARED, "trip-bookings", ["org2"]));
    await expectDenied("[locked] organiser writes a member's personal row", () => upsert(org, tripId, b.id, "trip-packing", ["org"]));

    // Storage: trip-docs uploads need can_edit_shared.
    const file = new Blob(["rls test"], { type: "text/plain" });
    await expectDenied("[locked] member uploads to trip-docs", () => a.client.storage.from("trip-docs").upload(`${tripId}/rls-member.txt`, file));
    await expectAllowed("[locked] organiser uploads to trip-docs", () => org.client.storage.from("trip-docs").upload(`${tripId}/rls-org.txt`, file));
    await a.client.storage.from("trip-docs").remove([`${tripId}/rls-org.txt`]);
    const { data: listed } = await org.client.storage.from("trip-docs").list(tripId);
    if (listed?.some((f) => f.name === "rls-org.txt")) pass("[locked] member can't delete a trip-docs file");
    else fail("[locked] member can't delete a trip-docs file");

    // Role column: members can't promote themselves.
    await expectDenied("member can't set own role by update", () =>
      a.client.from("trip_members").update({ role: "organiser" }).eq("trip_id", tripId).eq("user_id", a.id));
    await expectAllowed("member can still rename self", () =>
      a.client.from("trip_members").update({ name: "RLS member A2" }).eq("trip_id", tripId).eq("user_id", a.id));
    await expectDenied("member can't call set_member_role", () => a.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: a.id, p_role: "organiser" }));
    await expectDenied("member can't turn members_can_edit back on", () => a.client.rpc("set_members_can_edit", { p_trip_id: tripId, p_value: true }));
    await expectDenied("direct insert into trips is blocked", () => a.client.from("trips").insert({ code: code(), created_by: org.id }));

    // ---- members can edit ----
    await expectAllowed("organiser turns members_can_edit on", () => org.client.rpc("set_members_can_edit", { p_trip_id: tripId, p_value: true }));
    await expectAllowed("[open] member upserts a shared row", () => upsert(a, tripId, SHARED, "trip-bookings", ["a"]));
    await expectDenied("[open] member upserts another member's personal row", () => upsert(a, tripId, b.id, "trip-packing", ["a"]));
    await a.client.from("trip_kv").delete().eq("trip_id", tripId).eq("owner", b.id);
    await expectValue("[open] member can't delete another member's personal row", readRow(b, tripId, b.id, "trip-packing"), ["b"]);
    await expectAllowed("[open] member uploads to trip-docs", () => a.client.storage.from("trip-docs").upload(`${tripId}/rls-member.txt`, file));

    // ---- roles ----
    await expectDenied("organiser can't demote the last organiser", () => org.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: org.id, p_role: "member" }));
    await expectAllowed("organiser makes A a co-organiser", () => org.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: a.id, p_role: "organiser" }));
    await expectAllowed("[locked] off again, by co-organiser A", () => a.client.rpc("set_members_can_edit", { p_trip_id: tripId, p_value: false }));
    await expectAllowed("[locked] co-organiser A writes a shared row", () => upsert(a, tripId, SHARED, "trip-bookings", ["a2"]));
    await expectAllowed("A demotes the original organiser", () => a.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: org.id, p_role: "member" }));
    await expectDenied("[locked] demoted organiser can't write shared rows", () => upsert(org, tripId, SHARED, "trip-bookings", ["org3"]));
    await expectDenied("A can't demote themself as last organiser", () => a.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: a.id, p_role: "member" }));
    await expectDenied("set_member_role rejects a bad role", () => a.client.rpc("set_member_role", { p_trip_id: tripId, p_user_id: b.id, p_role: "admin" }));
  } finally {
    // ---- cleanup: A (organiser now) removes docs, everyone else leaves, A deletes ----
    await a.client.storage.from("trip-docs").remove([`${tripId}/rls-member.txt`, `${tripId}/rls-org.txt`]).catch(() => {});
    await org.client.storage.from("trip-docs").remove([`${tripId}/rls-member.txt`, `${tripId}/rls-org.txt`]).catch(() => {});
    for (const m of [org, b]) await m.client.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", m.id);
    const { error } = await a.client.rpc("delete_trip", { p_trip_id: tripId });
    if (error) console.log(`cleanup: couldn't delete test trip ${tripId}: ${error.message}`);
    else console.log("cleanup: test trip deleted");
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
