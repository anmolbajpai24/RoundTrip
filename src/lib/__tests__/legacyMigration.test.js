import { describe, it, expect, vi } from "vitest";
import { legacyRowWritable, rewriteDayMap } from "../legacyMigration.js";

// legacyMigration.js imports the session and storage layers, which pull in
// the Supabase client and IndexedDB. The pure helpers under test need
// neither, so stub them out (vi.mock is hoisted above the import).
vi.mock("../session.js", () => ({ getSession: () => null, canEditShared: () => false, myId: () => null }));
vi.mock("../storage.js", () => ({}));
vi.mock("../tripConfig.js", () => ({ CONFIG_KEY: "trip-config" }));


const SHARED = "__shared__";
const ME = "user-me";
const OTHER = "user-other";

describe("legacyRowWritable", () => {
  it("allows shared rows only when this person can edit shared data", () => {
    expect(legacyRowWritable(SHARED, { canEdit: true, me: ME })).toBe(true);
    expect(legacyRowWritable(SHARED, { canEdit: false, me: ME })).toBe(false);
  });

  it("allows your own personal row whatever the shared setting", () => {
    expect(legacyRowWritable(ME, { canEdit: false, me: ME })).toBe(true);
    expect(legacyRowWritable(ME, { canEdit: true, me: ME })).toBe(true);
  });

  it("never allows another member's personal row, even for an organiser", () => {
    expect(legacyRowWritable(OTHER, { canEdit: true, me: ME })).toBe(false);
    expect(legacyRowWritable(OTHER, { canEdit: false, me: ME })).toBe(false);
  });

  it("allows nothing without a session", () => {
    expect(legacyRowWritable(SHARED, { canEdit: false, me: null })).toBe(false);
    expect(legacyRowWritable(OTHER, { canEdit: false, me: null })).toBe(false);
    expect(legacyRowWritable(undefined, { canEdit: false, me: null })).toBe(false);
  });
});

describe("rewriteDayMap", () => {
  it("copies dN keys to ISO dates and keeps the originals", () => {
    expect(rewriteDayMap({ d7: "a" })).toEqual({ d7: "a", "2026-08-07": "a" });
  });

  it("lets an existing ISO entry win", () => {
    expect(rewriteDayMap({ d7: "old", "2026-08-07": "new" })).toBeNull();
  });

  it("returns null when there is nothing to rewrite", () => {
    expect(rewriteDayMap({})).toBeNull();
    expect(rewriteDayMap(null)).toBeNull();
  });
});
