// Helpers over the closet shape produced by loadClosetsAll():
//   closet = { items: { id: {photoPath|photo,desc,visibility,createdAt} }, days: { dateISO: id } }

// The outfit a member wears on a given day, or undefined.
export function outfitForDay(closet, dateISO) {
  const id = closet?.days?.[dateISO];
  return id ? closet?.items?.[id] : undefined;
}

// Per-outfit privacy: owners always see their own; others only "trip" items.
export function visibleToOthers(item) {
  return !!item && item.visibility !== "private";
}

// True when the item has a picture — either a Storage path (current model)
// or a legacy inline data-URL still sitting in an offline cache.
export function hasPhoto(item) {
  return !!(item?.photoPath || item?.photo);
}
