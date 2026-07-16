import { describe, it, expect } from "vitest";
import buildTripConfig from "../buildTripConfig.js";

const base = {
  title: "  Test Trip  ",
  startDate: "2026-08-01",
  endDate: "2026-08-05",
  currency: "GBP",
  homeOn: true,
  homeCurrency: "INR",
  homeRate: "120",
  budget: "1000",
};

const dest = (name, arrival, color = "#123456") =>
  ({ name, country: "GB", lat: 1, lon: 2, color, arrival });

describe("buildTripConfig — typed destinations", () => {
  it("assigns days to legs by arrival date and trims/parses fields", () => {
    const cfg = buildTripConfig({
      ...base,
      dests: [dest("London", "2026-08-01"), dest("Bath", "2026-08-03")],
    });
    expect(cfg.title).toBe("Test Trip");
    expect(cfg.homeRate).toBe(120);
    expect(cfg.budget).toBe(1000);
    expect(cfg.legOrder).toEqual(["london", "bath"]);
    expect(cfg.days).toHaveLength(5);
    expect(cfg.days.map((d) => d.leg)).toEqual(["london", "london", "bath", "bath", "bath"]);
    expect(cfg.days[0].title).toBe("Day 1 · London");
    expect(cfg.days[2].title).toBe("Day 3 · Bath");
    expect(cfg.days.every((d) => d.plan === "")).toBe(true);
  });

  it("suffixes duplicate slugs so both legs survive", () => {
    const cfg = buildTripConfig({
      ...base,
      dests: [dest("York", "2026-08-01"), dest("York", "2026-08-03")],
    });
    expect(cfg.legOrder).toEqual(["york", "york2"]);
    expect(cfg.legs.york2.name).toBe("York");
  });

  it("nulls home currency when the toggle is off and budget when not positive", () => {
    const cfg = buildTripConfig({ ...base, homeOn: false, budget: "", dests: [dest("London", "2026-08-01")] });
    expect(cfg.homeCurrency).toBeNull();
    expect(cfg.homeRate).toBeNull();
    expect(cfg.budget).toBeNull();
  });
});

describe("buildTripConfig — accepted AI plan", () => {
  const ai = {
    days: [
      { date: "2026-08-01", city: "London", plan: "Arrive." },
      { date: "2026-08-02", city: "London", plan: "Museums." },
      { date: "2026-08-03", city: "Bath", plan: "Roman Baths." },
    ],
    legs: {
      legs: {
        london: { name: "London", color: "#111111", soft: "#eee", lat: 51.5, lon: -0.1, norm: null },
        bath: { name: "Bath", color: "#222222", soft: "#eee", lat: 51.4, lon: -2.4, norm: null },
      },
      legOrder: ["london", "bath"],
      dateKey: { "2026-08-01": "london", "2026-08-02": "london", "2026-08-03": "bath" },
    },
  };

  it("uses AI cities as legs and copies plans onto the days", () => {
    const cfg = buildTripConfig({ ...base, endDate: "2026-08-03", dests: [], ai });
    expect(cfg.legOrder).toEqual(["london", "bath"]);
    expect(cfg.days.map((d) => d.leg)).toEqual(["london", "london", "bath"]);
    expect(cfg.days[2].plan).toBe("Roman Baths.");
    expect(cfg.days[0].title).toBe("Day 1 · London");
  });

  it("falls back to the first AI leg for dates the AI left unmapped", () => {
    const sparse = { ...ai, legs: { ...ai.legs, dateKey: { "2026-08-03": "bath" } } };
    const cfg = buildTripConfig({ ...base, endDate: "2026-08-03", dests: [], ai: sparse });
    expect(cfg.days[0].leg).toBe("london");
  });

  it("ignores an AI object with no legs (falls back to typed destinations)", () => {
    const cfg = buildTripConfig({
      ...base,
      dests: [dest("Paris", "2026-08-01")],
      ai: { days: [], legs: { legs: {}, legOrder: [], dateKey: {} } },
    });
    expect(cfg.legOrder).toEqual(["paris"]);
  });
});
