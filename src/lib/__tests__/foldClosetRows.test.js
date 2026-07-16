import { describe, it, expect } from "vitest";
import { foldClosetRows } from "../storage.js";

const OWNER = "11111111-1111-1111-1111-111111111111";

describe("foldClosetRows", () => {
  it("assembles new-model rows into items + days", () => {
    const closets = foldClosetRows([
      { owner: OWNER, key: "outfit-item:a", value: { photoPath: "t/1.jpg", desc: "tee", visibility: "trip" } },
      { owner: OWNER, key: "outfit-days", value: { "2026-08-01": "a" } },
    ]);
    expect(closets[OWNER].items.a.desc).toBe("tee");
    expect(closets[OWNER].days["2026-08-01"]).toBe("a");
    expect(closets[OWNER].legacy).toBeUndefined();
  });

  it("drops tombstoned items but still treats the owner as new-model", () => {
    const closets = foldClosetRows([
      { owner: OWNER, key: "outfit-item:gone", value: null },
      { owner: OWNER, key: "outfit:2026-08-01", value: { photo: "data:image/jpeg;base64,x", desc: "old" } },
    ]);
    // tombstone marks new-model → legacy rows are ignored, no items remain
    expect(closets[OWNER]).toEqual({ items: {}, days: {} });
  });

  it("synthesizes a legacy closet from pre-closet outfit:<date> rows", () => {
    const closets = foldClosetRows([
      { owner: OWNER, key: "outfit:2026-08-02", value: { photo: "data:image/jpeg;base64,x", desc: "jacket" } },
    ]);
    expect(closets[OWNER].legacy).toBe(true);
    expect(closets[OWNER].days["2026-08-02"]).toBe("legacy:2026-08-02");
    expect(closets[OWNER].items["legacy:2026-08-02"].desc).toBe("jacket");
  });

  it("ignores pre-ISO legacy day keys (outfit:d7) and empty values", () => {
    const closets = foldClosetRows([
      { owner: OWNER, key: "outfit:d7", value: { photo: "x" } },
      { owner: OWNER, key: "outfit:2026-08-03", value: { photo: null, desc: "" } },
    ]);
    expect(closets[OWNER]).toBeUndefined();
  });

  it("keeps owners separate", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    const closets = foldClosetRows([
      { owner: OWNER, key: "outfit-item:a", value: { desc: "mine" } },
      { owner: OWNER, key: "outfit-days", value: {} },
      { owner: other, key: "outfit-item:b", value: { desc: "theirs" } },
      { owner: other, key: "outfit-days", value: {} },
    ]);
    expect(closets[OWNER].items.a.desc).toBe("mine");
    expect(closets[other].items.b.desc).toBe("theirs");
  });
});
