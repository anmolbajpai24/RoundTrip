// ---------- Trip constants ----------
export const GBP_TO_INR = 127;
export const BUDGET_GBP = 3415;
export const TRIP_START = new Date("2026-08-07T00:00:00");

// `lat`/`lon` locate each leg for the weather forecast; `norm` holds typical
// August climate normals (WMO code 2 = partly cloudy) shown as a fallback when a
// live forecast doesn't yet reach a date. Temps in °C, precipProb in %.
export const LEGS = {
  london: { name: "London", color: "#C8102E", soft: "#FBE9EC", lat: 51.5074, lon: -0.1278, norm: { tempMax: 23, tempMin: 14, precipProb: 30, code: 2 } },
  bath: { name: "Bath", color: "#C77E1F", soft: "#FBF1E2", lat: 51.3811, lon: -2.3590, norm: { tempMax: 22, tempMin: 13, precipProb: 35, code: 2 } },
  lakes: { name: "Lake District", color: "#2E7D4F", soft: "#E7F3EC", lat: 54.3807, lon: -2.9066, norm: { tempMax: 19, tempMin: 11, precipProb: 55, code: 61 } },
  edinburgh: { name: "Edinburgh", color: "#5B3B8C", soft: "#EFE9F7", lat: 55.9533, lon: -3.1883, norm: { tempMax: 19, tempMin: 11, precipProb: 45, code: 3 } },
  york: { name: "York", color: "#0F7C8C", soft: "#E5F2F4", lat: 53.9600, lon: -1.0873, norm: { tempMax: 21, tempMin: 12, precipProb: 40, code: 2 } },
};

export const DAYS = [
  { d: 7, leg: "london", title: "Arrive London", plan: "Land, settle in at your sister's place, easy evening walk nearby." },
  { d: 8, leg: "london", title: "London warm-up", plan: "Local exploring — South Bank stroll, adjust to the timezone." },
  { d: 9, leg: "london", title: "London · conference day 1", plan: "She's at the conference. Solo: British Museum (free), Covent Garden." },
  { d: 10, leg: "london", title: "London · conference day 2", plan: "Solo: Tower Bridge, Borough Market lunch. Evening together." },
  { d: 11, leg: "london", title: "London · conference day 3", plan: "Solo: National Gallery, Trafalgar Square. Evening: West End area." },
  { d: 12, leg: "london", title: "London · conference day 4", plan: "Last conference day. Pack for the loop, book any last trains." },
  { d: 13, leg: "bath", title: "Train to Bath", plan: "Paddington → Bath Spa (~1h20). Roman Baths in the afternoon." },
  { d: 14, leg: "bath", title: "Bath", plan: "Royal Crescent, Pulteney Bridge, Thermae Bath Spa rooftop (book ahead)." },
  { d: 15, leg: "lakes", title: "Bath → Lake District", plan: "Long rail day via Bristol/Birmingham → Oxenholme → Windermere." },
  { d: 16, leg: "lakes", title: "Lake District", plan: "Windermere lake cruise, Bowness, short fell walk (Orrest Head)." },
  { d: 17, leg: "edinburgh", title: "Lakes → Edinburgh", plan: "Oxenholme → Edinburgh Waverley (~2h). Evening: first Fringe show!" },
  { d: 18, leg: "edinburgh", title: "Edinburgh · Fringe", plan: "Royal Mile street acts, Edinburgh Castle, evening Fringe shows." },
  { d: 19, leg: "edinburgh", title: "Edinburgh · Fringe", plan: "Arthur's Seat hike (morning), Old Town, more Fringe — mix free + paid." },
  { d: 20, leg: "york", title: "Edinburgh → York", plan: "East Coast Main Line (~2h30). Evening: city walls walk at sunset." },
  { d: 21, leg: "york", title: "York", plan: "York Minster, The Shambles, Railway Museum (free), ghost walk." },
  { d: 22, leg: "london", title: "York → London", plan: "Train back to King's Cross (~2h). Rest evening at sister's." },
  { d: 23, leg: "london", title: "London · slow day", plan: "Laundry, recover, neighbourhood cafés, plan the day-trip week." },
  { d: 24, leg: "london", title: "Day trip · Oxford", plan: "Colleges, Bodleian, covered market. ~1h from Paddington/Marylebone.", place: "Oxford", lat: 51.7520, lon: -1.2577, norm: { tempMax: 22, tempMin: 12, precipProb: 35, code: 2 } },
  { d: 25, leg: "london", title: "Day trip · Cambridge", plan: "Punting on the Cam, King's College. ~50min from King's Cross.", place: "Cambridge", lat: 52.2053, lon: 0.1218, norm: { tempMax: 22, tempMin: 12, precipProb: 35, code: 2 } },
  { d: 26, leg: "london", title: "Day trip · Brighton", plan: "Pier, The Lanes, beach. ~1h from Victoria. Fish & chips by the sea.", place: "Brighton", lat: 50.8225, lon: -0.1372, norm: { tempMax: 21, tempMin: 14, precipProb: 30, code: 1 } },
  { d: 27, leg: "london", title: "Day trip · Windsor", plan: "Windsor Castle, Eton walk. ~40min from Paddington via Slough.", place: "Windsor", lat: 51.4837, lon: -0.6044, norm: { tempMax: 23, tempMin: 13, precipProb: 30, code: 2 } },
  { d: 28, leg: "london", title: "London · shopping", plan: "Gifts + shopping: Oxford Street, Camden or Portobello Market." },
  { d: 29, leg: "london", title: "Last full day", plan: "Favourite spot revisit, dinner with your sister, pack properly." },
  { d: 30, leg: "london", title: "Fly home", plan: "Airport day. Leave buffer for the Tube/Elizabeth line with bags." },
];

export const DEFAULT_PACKING = [
  ["Documents", ["Passports + visa printouts", "Travel insurance PDF", "Niyo Global SBM card", "ICICI Multicurrency backup card", "Two Together Railcard", "Flight + train confirmations"]],
  ["Clothes", ["Light rain jacket (UK August!)", "1 warm layer / fleece", "Comfortable walking shoes", "1 nicer outfit for evenings", "Compact umbrella"]],
  ["Tech", ["UK plug adapters (Type G) ×2", "Power bank", "Phone chargers", "Earphones"]],
  ["Other", ["Medicines + basic first aid", "Day backpack for the loop", "Gifts for Gemma & Neil", "Reusable water bottle"]],
];

export const DEFAULT_BOOKINGS = [
  { text: "Edinburgh Fringe beds (17–20 Aug) — BOOK FIRST, scarce & 2–3× price", urgent: true },
  { text: "Two Together Railcard (£35, both photos needed)", urgent: true },
  { text: "Advance train tickets for the loop (cheapest ~12 weeks out)", urgent: true },
  { text: "Bath accommodation (13–15 Aug)", urgent: false },
  { text: "Lake District accommodation (15–17 Aug)", urgent: false },
  { text: "York accommodation (20–22 Aug)", urgent: false },
  { text: "Thermae Bath Spa slot", urgent: false },
  { text: "2–3 paid Fringe shows (rest free)", urgent: false },
  { text: "Edinburgh Castle tickets (timed entry)", urgent: false },
  { text: "Windsor Castle tickets", urgent: false },
];

export const dayKey = (d) => `d${d}`;
export const dateLabel = (d) => `${d} Aug`;
export const weekday = (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(2026, 7, d).getDay()];

// Resolve the weather location for a day: a per-day override (day trips) wins,
// otherwise fall back to the day's leg. Always returns { name, lat, lon, norm }.
export const locationOf = (day) => {
  const L = LEGS[day.leg];
  return {
    name: day.place || L.name,
    leg: day.leg,
    lat: day.lat ?? L.lat,
    lon: day.lon ?? L.lon,
    norm: day.norm || L.norm,
  };
};

// ISO date string (YYYY-MM-DD) for a trip day-of-month in August 2026.
export const isoDate = (d) => `2026-08-${String(d).padStart(2, "0")}`;
