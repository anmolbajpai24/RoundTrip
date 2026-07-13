import { WMO, WET_KEYS } from "./weather.js";

// Deterministic, offline outfit advice from a normalized day-weather record.
// No LLM, no network — pure rules tuned for a UK August. Items flagged `packed`
// match things already on the default packing list (see DEFAULT_PACKING in
// data/trip.js) so the widget can reassure "you packed this ✓".
//
// Input: { tempMax, tempMin, precipProb, windMax, code, uv }
// Output: { headline, layers[], accessories[], footwear, note }
//   layers/accessories entries: { text, packed? }
export function suggestOutfit(w) {
  const { key: cond } = WMO(w.code);
  const wet = WET_KEYS.has(cond) || (w.precipProb ?? 0) >= 40;
  const windy = (w.windMax ?? 0) >= 30;
  const sunny = (w.uv ?? 0) >= 6 || cond === "clear";

  const layers = [];
  const accessories = [];
  let headline;
  let footwear;
  const notes = [];

  // Base outfit by daytime high.
  if (w.tempMax < 14) {
    headline = "Bundle up — cold for August";
    layers.push({ text: "Warm base + fleece" }, { text: "Warm jacket / coat" });
    footwear = "Warm, closed walking shoes";
  } else if (w.tempMax < 18) {
    headline = "Mild — layer it";
    layers.push({ text: "Long-sleeve top" }, { text: "Light fleece / jumper", packed: true });
    footwear = "Comfortable walking shoes";
  } else if (w.tempMax <= 23) {
    headline = "Pleasant — a light layer to carry";
    layers.push({ text: "T-shirt or shirt" }, { text: "Light layer for later", packed: true });
    footwear = "Comfortable walking shoes";
  } else {
    headline = "Warm — keep it breathable";
    layers.push({ text: "Breathable tee" }, { text: "Light layer for A/C / evening" });
    footwear = "Breathable trainers";
  }

  // Cool mornings/evenings even on warm days.
  if (w.tempMin < 12 && w.tempMax >= 18) {
    notes.push("Chilly early and late — keep that layer handy.");
  }

  // Rain gear.
  if (wet) {
    accessories.push({ text: "Light rain jacket", packed: true }, { text: "Compact umbrella", packed: true });
    footwear = "Water-resistant shoes";
    if (headline.indexOf("cold") === -1) headline = "Rain likely — waterproof up";
  }

  // Wind.
  if (windy) {
    notes.push("Breezy — a windproof layer helps; mind the umbrella.");
  }

  // Sun.
  if (sunny && !wet) {
    accessories.push({ text: "Sunglasses" }, { text: "Sunscreen" });
  }

  return { headline, layers, accessories, footwear, note: notes.join(" ") };
}
