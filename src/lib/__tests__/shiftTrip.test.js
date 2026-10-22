import { describe, it, expect } from "vitest";
import shiftTrip from "../shiftTrip.js";
import buildTripConfig from "../buildTripConfig.js";

// A 3-day Kasol weekend built the way the wizard builds it, so the test
// follows the real config shape instead of a hand-written copy of it.
const config = buildTripConfig({
  title: "Kasol weekend",
  startDate: "2026-11-06", endDate: "2026-11-08",
  currency: "INR", homeOn: false, homeCurrency: "USD", homeRate: "", budget: "",
  dests: [
    { name: "Kasol", country: "India", lat: 32.01, lon: 77.31, color: "#2E7D5B", arrival: "2026-11-06" },
    { name: "Tosh", country: "India", lat: 32.02, lon: 77.45, color: "#7A4FB0", arrival: "2026-11-08" },
  ],
  packingTemplate: [{ category: "Warm", items: ["Jacket", "Gloves"] }],
});
config.days[1].plan = "Chalal walk";

const kv = {
  "trip-itinerary": {
    "2026-11-06": { notes: "Pickup 9pm Majnu ka Tilla" },
    "2026-11-08": { notes: "Back by 6am Monday" },
    d3: { notes: "legacy" },
  },
  "trip-bookings": [
    { id: 1, text: "Volvo seats", urgent: true, done: true, addedBy: "u-other", docId: "doc-1" },
    { id: 2, text: "Camp at Tosh", urgent: false, done: false },
  ],
  "trip-expenses": [{ id: 9, amount: 500 }],
  "trip-packing": [{ text: "socks" }],
};

describe("shiftTrip", () => {
  const { config: next, kv: nextKv } = shiftTrip(config, kv, "2026-11-13");

  it("moves the trip window and every day by the same offset", () => {
    expect(next.startDate).toBe("2026-11-13");
    expect(next.endDate).toBe("2026-11-15");
    expect(next.days.map((d) => d.date)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
  });

  it("keeps the plan, titles, legs and packing template", () => {
    expect(next.days.map((d) => [d.title, d.leg, d.plan])).toEqual(config.days.map((d) => [d.title, d.leg, d.plan]));
    expect(next.legs).toEqual(config.legs);
    expect(next.legOrder).toEqual(config.legOrder);
    expect(next.packingTemplate).toEqual(config.packingTemplate);
    expect(next.title).toBe("Kasol weekend");
  });

  it("re-keys shared day notes and drops legacy keys", () => {
    expect(nextKv["trip-itinerary"]).toEqual({
      "2026-11-13": { notes: "Pickup 9pm Majnu ka Tilla" },
      "2026-11-15": { notes: "Back by 6am Monday" },
    });
  });

  it("resets bookings to not done and drops links to people and documents", () => {
    expect(nextKv["trip-bookings"]).toEqual([
      { id: 1, text: "Volvo seats", urgent: true, done: false },
      { id: 2, text: "Camp at Tosh", urgent: false, done: false },
    ]);
  });

  it("copies nothing else", () => {
    expect(Object.keys(nextKv).sort()).toEqual(["trip-bookings", "trip-itinerary"]);
  });

  it("doesn't touch its inputs", () => {
    expect(config.startDate).toBe("2026-11-06");
    expect(kv["trip-bookings"][0].done).toBe(true);
  });

  it("moves any other ISO date in the config, including date keys", () => {
    const withExtras = { ...config, pickupDate: "2026-11-06", byDate: { "2026-11-07": "x" }, cover: { url: "https://x/2026-11-06.jpg" } };
    const out = shiftTrip(withExtras, {}, "2026-11-13").config;
    expect(out.pickupDate).toBe("2026-11-13");
    expect(out.byDate).toEqual({ "2026-11-14": "x" });
    expect(out.cover.url).toBe("https://x/2026-11-06.jpg");
  });

  it("handles month, year and backwards moves", () => {
    const nye = shiftTrip({ ...config, startDate: "2026-12-30", endDate: "2027-01-01", days: [{ date: "2026-12-30" }, { date: "2026-12-31" }, { date: "2027-01-01" }] }, {}, "2027-12-30").config;
    expect(nye.days.map((d) => d.date)).toEqual(["2027-12-30", "2027-12-31", "2028-01-01"]);
    expect(shiftTrip(config, {}, "2026-10-30").config.endDate).toBe("2026-11-01");
  });

  it("returns no kv keys when there is nothing to copy", () => {
    expect(shiftTrip(config, { "trip-bookings": null }, "2026-11-13").kv).toEqual({});
  });

  it("rejects a bad start date", () => {
    expect(() => shiftTrip(config, {}, "13/11/2026")).toThrow();
    expect(() => shiftTrip({ ...config, startDate: undefined }, {}, "2026-11-13")).toThrow();
  });
});
