import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The guard talks to Supabase; stub the client so tests control auth and the
// daily-cap RPC without a network.
const auth = { user: { id: "u1" }, used: 1, rpcError: null };
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => (auth.user ? { data: { user: auth.user }, error: null } : { data: {}, error: { message: "bad jwt" } }) },
    rpc: async () => ({ data: auth.used, error: auth.rpcError }),
  }),
}));

const {
  datesInRange, validateImportInput, normaliseImportDays, buildImportPrompt, runItineraryImport, MAX_TEXT, MAX_PLAN,
} = await import("../itinerary-import.js");
const { runTryOn } = await import("../tryon.js");

const TEXT = "Day 0: Leave Delhi by overnight Volvo at 9pm.\nDay 1: Reach Kasol, check in, walk the market.\nDay 2: Trek to Kheerganga.";
const DATES = ["2026-11-13", "2026-11-14", "2026-11-15"];

function geminiReturns(items, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status === 200,
    status,
    text: async () => "upstream error",
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  delete process.env.AI_DAILY_CAP;
  Object.assign(auth, { user: { id: "u1" }, used: 1, rpcError: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("datesInRange", () => {
  it("lists every date inclusive, across a month end", () => {
    expect(datesInRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("rejects impossible or reversed dates", () => {
    expect(datesInRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(datesInRange("2026-11-15", "2026-11-13")).toBeNull();
    expect(datesInRange("15/11/2026", "2026-11-16")).toBeNull();
  });
});

describe("validateImportInput", () => {
  it("needs some text", () => {
    expect(validateImportInput({ text: "  ", startDate: DATES[0], endDate: DATES[2] }).out.body.error).toBe("bad-input");
    expect(validateImportInput({ startDate: DATES[0], endDate: DATES[2] }).ok).toBe(false);
  });
  it("needs valid dates and caps the trip length", () => {
    expect(validateImportInput({ text: TEXT, startDate: "2026-11-13" }).ok).toBe(false);
    expect(validateImportInput({ text: TEXT, startDate: "2026-01-01", endDate: "2026-12-31" }).out.status).toBe(400);
  });
  it("cuts text at the cap and says so", () => {
    const v = validateImportInput({ text: "x".repeat(MAX_TEXT + 500), startDate: DATES[0], endDate: DATES[2] });
    expect(v.ok).toBe(true);
    expect(v.text.length).toBe(MAX_TEXT);
    expect(v.truncated).toBe(true);
    expect(v.dates).toEqual(DATES);
  });
});

describe("normaliseImportDays", () => {
  it("maps day numbers onto dates", () => {
    const { days, repairs } = normaliseImportDays(
      [{ day: 1, city: "Delhi", plan: "Bus at 9pm" }, { day: 2, city: "Kasol", plan: "Market" }, { day: 3, city: "Kheerganga", plan: "Trek" }],
      DATES,
    );
    expect(days).toEqual([
      { date: "2026-11-13", city: "Delhi", plan: "Bus at 9pm" },
      { date: "2026-11-14", city: "Kasol", plan: "Market" },
      { date: "2026-11-15", city: "Kheerganga", plan: "Trek" },
    ]);
    expect(repairs).toEqual({ folded: 0, unplaced: 0, filled: 0 });
  });

  it("folds days outside the range into the first and last day", () => {
    const { days, repairs } = normaliseImportDays(
      [
        { day: 0, city: "Delhi", plan: "Overnight bus" },
        { day: 1, city: "Kasol", plan: "Check in" },
        { day: 2, city: "Kasol", plan: "Trek" },
        { day: 3, city: "Kasol", plan: "Leave at 4pm" },
        { day: 4, city: "Delhi", plan: "Reach Delhi 6am" },
      ],
      DATES,
    );
    expect(days.map((d) => d.date)).toEqual(DATES);
    expect(days[0]).toEqual({ date: DATES[0], city: "Delhi", plan: "Overnight bus\nCheck in" });
    expect(days[2].plan).toBe("Leave at 4pm\nReach Delhi 6am");
    expect(repairs.folded).toBe(2);
  });

  it("sorts, merges duplicates, and uses a date when the day number is missing", () => {
    const { days, repairs } = normaliseImportDays(
      [
        { day: 3, city: "Kasol", plan: "Return" },
        { date: "2026-11-14", city: "Kasol", plan: "Market" },
        { day: 1, city: "Delhi", plan: "Depart" },
        { day: 1, city: "Delhi", plan: "Dinner on the way" },
      ],
      DATES,
    );
    expect(days.map((d) => d.plan)).toEqual(["Depart\nDinner on the way", "Market", "Return"]);
    expect(repairs.folded + repairs.unplaced).toBe(0);
  });

  it("puts undated items in the first empty day and fills gaps with the neighbour's city", () => {
    const { days, repairs } = normaliseImportDays(
      [{ day: 2, city: "Kasol", plan: "Market" }, { city: "Tosh", plan: "Day hike", day: null }],
      ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"],
    );
    expect(days[0]).toEqual({ date: "2026-11-13", city: "Tosh", plan: "Day hike" });
    expect(days[2]).toEqual({ date: "2026-11-15", city: "Kasol", plan: "" });
    expect(days[3].city).toBe("Kasol");
    expect(repairs).toEqual({ folded: 0, unplaced: 1, filled: 2 });
  });

  it("clamps plan and city lengths and strips day prefixes and markdown", () => {
    const { days } = normaliseImportDays(
      [{ day: 1, city: "K".repeat(200), plan: "Day 1: **Arrive** early\n- Walk the market\n" + "y".repeat(3000) }],
      ["2026-11-13"],
    );
    expect(days[0].city.length).toBe(60);
    expect(days[0].plan.startsWith("Arrive early\nWalk the market\n")).toBe(true);
    expect(days[0].plan.length).toBeLessThanOrEqual(MAX_PLAN);
  });

  it("survives junk from the model", () => {
    const { days } = normaliseImportDays([null, "x", { day: "two" }, { day: 1, city: 5, plan: 7 }], DATES);
    expect(days).toHaveLength(3);
    expect(days.every((d) => d.plan === "" && d.city === "")).toBe(true);
    expect(normaliseImportDays("not an array", DATES).days).toHaveLength(3);
  });
});

describe("buildImportPrompt", () => {
  it("lists each date with its day number and fences the pasted text", () => {
    const p = buildImportPrompt({ text: TEXT, dates: DATES });
    expect(p).toContain("exactly 3 days");
    expect(p).toContain("Day 1 = 2026-11-13 (Fri)");
    expect(p).toContain(`<<<ITINERARY\n${TEXT}\nITINERARY>>>`);
  });
});

describe("runItineraryImport", () => {
  const body = { text: TEXT, startDate: DATES[0], endDate: DATES[2] };

  it("returns one day per date", async () => {
    const fetchMock = geminiReturns([
      { day: 1, city: "Delhi", plan: "Overnight Volvo at 9pm" },
      { day: 2, city: "Kasol", plan: "Check in, market walk" },
      { day: 3, city: "Kheerganga", plan: "Trek up" },
    ]);
    const out = await runItineraryImport(body, "Bearer jwt");
    expect(out.status).toBe(200);
    expect(out.body.days.map((d) => d.date)).toEqual(DATES);
    expect(out.body.days[1].city).toBe("Kasol");
    expect(out.body.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses before spending anything when signed out or input is bad", async () => {
    const fetchMock = geminiReturns([]);
    expect((await runItineraryImport(body, "")).body.error).toBe("unauthorized");
    auth.user = null;
    expect((await runItineraryImport(body, "Bearer bad")).status).toBe(401);
    expect((await runItineraryImport({ ...body, text: "" }, "Bearer jwt")).body.error).toBe("bad-input");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the daily cap and fails closed when the RPC errors", async () => {
    geminiReturns([]);
    auth.used = 11;
    expect((await runItineraryImport(body, "Bearer jwt")).body.error).toBe("quota");
    auth.used = 1;
    auth.rpcError = { message: "boom" };
    expect((await runItineraryImport(body, "Bearer jwt")).status).toBe(503);
  });

  it("fails closed without config", async () => {
    delete process.env.GEMINI_API_KEY;
    expect((await runItineraryImport(body, "Bearer jwt")).body.error).toBe("disabled");
    process.env.GEMINI_API_KEY = "k";
    delete process.env.VITE_SUPABASE_URL;
    expect((await runItineraryImport(body, "Bearer jwt")).status).toBe(503);
  });

  it("maps upstream failures to error codes without logging the text", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    geminiReturns([], 429);
    expect((await runItineraryImport(body, "Bearer jwt")).body.error).toBe("quota");
    geminiReturns([], 503);
    expect((await runItineraryImport(body, "Bearer jwt")).body.error).toBe("busy");
    geminiReturns([], 500);
    expect((await runItineraryImport(body, "Bearer jwt")).body.error).toBe("unavailable");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("Kasol");
    logged.mockRestore();
  });

  it("says bad-input when nothing in the text reads as a plan", async () => {
    geminiReturns([{ day: 1, city: "", plan: "" }]);
    const out = await runItineraryImport(body, "Bearer jwt");
    expect(out.status).toBe(422);
    expect(out.body.error).toBe("bad-input");
  });
});

describe("runTryOn", () => {
  it("is gone", async () => {
    expect(await runTryOn({ person: "data:image/png;base64,x" }, "Bearer jwt")).toEqual({
      status: 410,
      body: { error: "gone", message: "Try-on has been removed." },
    });
  });
});
