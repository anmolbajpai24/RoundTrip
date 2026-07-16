import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "./geocode.js";

// Debounced place search shared by the trip wizard and trip settings.
// Results clear automatically when the query drops under 2 characters,
// so callers reset by clearing their query state.
export default function usePlaceSearch(query) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchPlaces(query)); } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query]);

  return { results, searching };
}
