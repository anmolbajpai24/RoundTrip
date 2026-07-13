import { WMO, WET_KEYS } from "./weather.js";

// Deterministic, offline outfit advice from a normalized day-weather record.
// No LLM, no network — pure rules, climate-generic (cold through hot bands).
//
// Input: w = { tempMax, tempMin, precipProb, windMax, code, uv },
//        packingItems = the viewer's own packing-list texts (optional). Items
//        the advisor suggests are flagged `packed` when a keyword matches
//        something on that list, so the widget can reassure "you packed this ✓".
// Output: { headline, layers[], accessories[], footwear, note }
//   layers/accessories entries: { text, packed? }

const PACK_KEYWORDS = {
  "rain jacket": ["rain jacket", "raincoat", "waterproof jacket"],
  umbrella: ["umbrella"],
  fleece: ["fleece", "jumper", "sweater", "hoodie", "warm layer"],
  "warm jacket": ["coat", "warm jacket", "puffer", "parka"],
  layer: ["fleece", "jumper", "sweater", "hoodie", "cardigan", "layer", "jacket"],
  sunglasses: ["sunglasses", "shades"],
  sunscreen: ["sunscreen", "sun cream", "spf"],
  hat: ["hat", "cap"],
};

function packedMatcher(packingItems) {
  const texts = (packingItems || []).map((t) => String(t).toLowerCase());
  return (keyword) => {
    const needles = PACK_KEYWORDS[keyword] || [keyword];
    return texts.some((t) => needles.some((n) => t.includes(n))) || undefined;
  };
}

export function suggestOutfit(w, packingItems) {
  const packed = packedMatcher(packingItems);
  const { key: cond } = WMO(w.code);
  const wet = WET_KEYS.has(cond) || (w.precipProb ?? 0) >= 40;
  const windy = (w.windMax ?? 0) >= 30;
  const sunny = (w.uv ?? 0) >= 6 || cond === "clear";
  const snowy = cond === "snow";

  const layers = [];
  const accessories = [];
  let headline;
  let footwear;
  const notes = [];

  // Base outfit by daytime high.
  if (w.tempMax < 8) {
    headline = "Very cold — wrap up properly";
    layers.push({ text: "Thermal base layer" }, { text: "Fleece / jumper", packed: packed("fleece") }, { text: "Warm coat", packed: packed("warm jacket") });
    accessories.push({ text: "Gloves & warm hat" });
    footwear = "Warm, closed walking shoes";
  } else if (w.tempMax < 14) {
    headline = "Cold — bundle up";
    layers.push({ text: "Warm base + fleece", packed: packed("fleece") }, { text: "Warm jacket / coat", packed: packed("warm jacket") });
    footwear = "Warm, closed walking shoes";
  } else if (w.tempMax < 18) {
    headline = "Cool — layer it";
    layers.push({ text: "Long-sleeve top" }, { text: "Light fleece / jumper", packed: packed("fleece") });
    footwear = "Comfortable walking shoes";
  } else if (w.tempMax <= 23) {
    headline = "Pleasant — a light layer to carry";
    layers.push({ text: "T-shirt or shirt" }, { text: "Light layer for later", packed: packed("layer") });
    footwear = "Comfortable walking shoes";
  } else if (w.tempMax <= 29) {
    headline = "Warm — keep it breathable";
    layers.push({ text: "Breathable tee" }, { text: "Light layer for A/C / evening", packed: packed("layer") });
    footwear = "Breathable trainers";
  } else {
    headline = "Hot — sun protection & light fabrics";
    layers.push({ text: "Loose, light-coloured clothing" }, { text: "Breathable fabrics (linen / cotton)" });
    accessories.push({ text: "Sun hat", packed: packed("hat") });
    footwear = "Breathable shoes or sandals";
    notes.push("Stay hydrated and plan shade for midday.");
  }

  // Cool mornings/evenings even on warm days.
  if (w.tempMin < 12 && w.tempMax >= 18) {
    notes.push("Chilly early and late — keep that layer handy.");
  }

  // Rain / snow gear.
  if (snowy) {
    accessories.push({ text: "Waterproof jacket", packed: packed("rain jacket") });
    footwear = "Waterproof boots with grip";
    headline = "Snow — waterproof and warm";
  } else if (wet) {
    accessories.push({ text: "Light rain jacket", packed: packed("rain jacket") }, { text: "Compact umbrella", packed: packed("umbrella") });
    if (w.tempMax >= 14) footwear = "Water-resistant shoes";
    if (!headline.includes("cold") && !headline.includes("Very cold")) headline = "Rain likely — waterproof up";
  }

  // Wind.
  if (windy) {
    notes.push("Breezy — a windproof layer helps; mind the umbrella.");
  }

  // Sun.
  if (sunny && !wet && w.tempMax >= 8) {
    accessories.push({ text: "Sunglasses", packed: packed("sunglasses") }, { text: "Sunscreen", packed: packed("sunscreen") });
  }

  return { headline, layers, accessories, footwear, note: notes.join(" ") };
}
