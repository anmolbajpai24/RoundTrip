import { generateDays, slugify, softOf } from "./tripConfig.js";

// Pure trip-config assembly for the wizard (extracted so it's unit-testable).
//
//   dests: [{ name, country, lat, lon, color, arrival }] in user order;
//          the first dest covers the trip start, later ones take over on
//          their arrival date.
//   ai:    null, or { days: [{ date, city, plan }], legs: { legs, legOrder,
//          dateKey } } — an accepted AI plan whose cities define the legs.
export default function buildTripConfig({
  title, startDate, endDate, currency,
  homeOn, homeCurrency, homeRate, budget,
  dests, ai = null, packingTemplate = [],
}) {
  const useAi = !!(ai && ai.days && ai.legs && ai.legs.legOrder.length > 0);
  let legs, legOrder, legForDate, planFor;
  if (useAi) {
    ({ legs, legOrder } = ai.legs);
    legForDate = (iso) => ai.legs.dateKey[iso] || legOrder[0];
    planFor = Object.fromEntries(ai.days.map((d) => [d.date, d.plan]));
  } else {
    legs = {};
    legOrder = [];
    const keyed = dests.map((d) => {
      let key = slugify(d.name);
      while (legs[key]) key += "2";
      legs[key] = { name: d.name, color: d.color, soft: softOf(d.color), lat: d.lat, lon: d.lon, norm: null };
      legOrder.push(key);
      return { ...d, key };
    });
    const sorted = [...keyed].sort((a, b) => (a.arrival < b.arrival ? -1 : 1));
    legForDate = (iso) => {
      let leg = sorted[0].key;
      for (const d of sorted) if (d.arrival <= iso) leg = d.key;
      return leg;
    };
    planFor = {};
  }
  return {
    v: 1,
    title: title.trim(),
    startDate, endDate,
    currency,
    homeCurrency: homeOn ? homeCurrency : null,
    homeRate: homeOn ? parseFloat(homeRate) : null,
    budget: parseFloat(budget) > 0 ? parseFloat(budget) : null,
    legs, legOrder,
    days: generateDays(startDate, endDate, legForDate).map((d, i) => {
      const legName = legs[d.leg]?.name || "";
      return { ...d, title: `Day ${i + 1} · ${legName}`, plan: planFor[d.date] || "" };
    }),
    packingTemplate,
  };
}
