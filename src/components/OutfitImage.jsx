import { useEffect, useState } from "react";
import { getOutfitPhotoUrl } from "../lib/outfitPhotos.js";
import s from "./OutfitImage.module.css";

// Renders an outfit photo wherever the closet used to inline base64 images.
// Resolution order: explicit `src` (e.g. a try-on data-URL) → legacy
// `item.photo` data-URL (pre-cutover rows still in caches) → `item.photoPath`
// resolved through the Storage/IndexedDB cache. Shows a neutral placeholder
// while resolving or on failure.
export default function OutfitImage({ item, src, alt = "", className }) {
  const direct = src || item?.photo || null;
  const path = direct ? null : item?.photoPath || null;
  const [url, setUrl] = useState(direct);

  useEffect(() => {
    if (!path) { setUrl(direct); return; }
    let live = true;
    setUrl(null);
    getOutfitPhotoUrl(path)
      .then((u) => { if (live) setUrl(u); })
      .catch(() => { if (live) setUrl(null); });
    return () => { live = false; };
  }, [path, direct]);

  if (!url) return <div className={[s.ph, className].filter(Boolean).join(" ")} aria-hidden="true" />;
  return <img src={url} alt={alt} loading="lazy" className={[s.img, className].filter(Boolean).join(" ")} />;
}
