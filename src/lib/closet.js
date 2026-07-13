import { saveKey } from "./storage.js";

// Helpers over the closet shape produced by loadClosetsAll():
//   closet = { items: { id: {photo,desc,visibility,createdAt} }, days: { dateISO: id } }

// The outfit a member wears on a given day, or undefined.
export function outfitForDay(closet, dateISO) {
  const id = closet?.days?.[dateISO];
  return id ? closet?.items?.[id] : undefined;
}

// Per-outfit privacy: owners always see their own; others only "trip" items.
export function visibleToOthers(item) {
  return !!item && item.visibility !== "private";
}

// One-time upgrade of the signed-in user's pre-closet rows. loadClosetsAll
// synthesizes a `legacy: true` closet from old `outfit:<dateISO>` rows; this
// rewrites it as real outfit-item:<id> rows + an outfit-days map (only self-
// writes are possible through saveKey). The old rows stay as inert backups.
// Returns the migrated closet, or null if nothing needed doing.
export async function migrateMyLegacyOutfits(closet) {
  if (!closet?.legacy) return null;
  const items = {}, days = {};
  for (const [day, legacyId] of Object.entries(closet.days || {})) {
    const old = closet.items?.[legacyId];
    if (!old) continue;
    const id = crypto.randomUUID();
    items[id] = { photo: old.photo || null, desc: old.desc || "", visibility: "trip", createdAt: new Date().toISOString() };
    days[day] = id;
    await saveKey(`outfit-item:${id}`, items[id]);
  }
  await saveKey("outfit-days", days);
  return { items, days };
}
