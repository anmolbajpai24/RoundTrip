import { describe, it, expect } from "vitest";
import { listDates, generateDays, slugify, addDays, diffDays, toPackingDraft, fromPackingDraft, cleanTripInfo, safeMapUrl, telHref } from "../tripConfig.js";

describe("date helpers", () => {
  it("listDates is inclusive of both ends", () => {
    expect(listDates("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02",
    ]);
  });

  it("addDays / diffDays round-trip across a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(diffDays("2026-08-01", "2026-09-01")).toBe(31);
  });
});

describe("generateDays", () => {
  const legFor = () => "london";

  it("numbers fresh days and applies the leg", () => {
    const days = generateDays("2026-08-01", "2026-08-03", legFor);
    expect(days).toHaveLength(3);
    expect(days[1]).toEqual({ date: "2026-08-02", leg: "london", title: "Day 2", plan: "" });
  });

  it("preserves existing titles/plans when the range changes", () => {
    const existing = [{ date: "2026-08-02", leg: "york", title: "Minster day", plan: "Walls walk" }];
    const days = generateDays("2026-08-01", "2026-08-03", legFor, existing);
    expect(days[1].title).toBe("Minster day");
    expect(days[1].plan).toBe("Walls walk");
    expect(days[1].leg).toBe("london"); // legForDate wins over the stored leg
  });
});

describe("slugify", () => {
  it("normalizes accents and punctuation", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("  Lake District!  ")).toBe("lake-district");
  });
  it("never returns an empty key", () => {
    expect(slugify("!!!")).toBe("place");
  });
});

describe("packing template draft", () => {
  it("round-trips a template", () => {
    const tpl = [["Clothes", ["Jacket", "Socks"]], ["Docs", ["ID"]]];
    expect(fromPackingDraft(toPackingDraft(tpl))).toEqual(tpl);
  });

  it("trims items, drops blank lines and empty categories, names unnamed ones", () => {
    const draft = [
      { cat: " Clothes ", text: " Jacket \n\n Socks" },
      { cat: "", text: "" },
      { cat: "", text: "Torch" },
    ];
    expect(fromPackingDraft(draft)).toEqual([["Clothes", ["Jacket", "Socks"]], ["Other", ["Torch"]]]);
  });

  it("treats a missing template as empty", () => {
    expect(toPackingDraft(undefined)).toEqual([]);
  });
});

describe("trip info helpers", () => {
  it("cleanTripInfo keeps known non-empty fields, trimmed", () => {
    expect(cleanTripInfo({ pickupPoint: " Majnu ka Tilla ", leadName: "", junk: "x" })).toEqual({ pickupPoint: "Majnu ka Tilla" });
    expect(cleanTripInfo({ leadName: "  " })).toBeNull();
    expect(cleanTripInfo(undefined)).toBeNull();
  });

  it("safeMapUrl allows only http(s)", () => {
    expect(safeMapUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(safeMapUrl("javascript:alert(1)")).toBeNull();
    expect(safeMapUrl("not a url")).toBeNull();
  });

  it("telHref finds a phone number", () => {
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telHref("Rohan 98100-12345")).toBe("tel:9810012345");
    expect(telHref("Call the camp")).toBeNull();
    expect(telHref("Gate 2")).toBeNull();
  });
});
