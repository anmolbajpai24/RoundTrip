// Trip cover photos via the Unsplash API. Entirely optional: without
// VITE_UNSPLASH_ACCESS_KEY every caller quietly gets no photos and the UI
// falls back to leg-colour gradients (see legGradient in tripConfig.js).
// Called only from the wizard and trip settings — never on the dashboard —
// so the free demo tier (50 requests/hour) is more than enough.

const KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export const unsplashEnabled = !!KEY;

export async function searchCoverPhotos(query) {
  if (!KEY) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5&content_filter=high`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
  if (!res.ok) throw new Error(`Unsplash search failed (${res.status})`);
  const json = await res.json();
  return (json.results || []).map((p) => ({
    url: p.urls?.regular,
    thumb: p.urls?.small,
    author: p.user?.name || "Unknown",
    authorLink: p.user?.links?.html || null,
    downloadLocation: p.links?.download_location || null,
  })).filter((p) => p.url);
}

// Unsplash API terms require firing a download event when a photo is chosen.
export async function trackDownload(photo) {
  if (!KEY || !photo?.downloadLocation) return;
  try { await fetch(photo.downloadLocation, { headers: { Authorization: `Client-ID ${KEY}` } }); } catch { /* best effort */ }
}

// The subset of a search result that gets stored in trip-config as `cover`.
export const asCover = (photo) => ({
  url: photo.url, thumb: photo.thumb, author: photo.author, authorLink: photo.authorLink,
});
