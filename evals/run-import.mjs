/* global process, console */
// Eval runner for the paste-your-itinerary import (api/itinerary-import.js).
//
// Runs every fixture in evals/fixtures/ through the same validation, Gemini
// call and repair code the endpoint uses, skipping only the auth and daily-cap
// guard, and checks each result:
//   - days:    one day per date, matching the fixture's expectedDays
//   - range:   every date is inside startDate..endDate, in order, no repeats
//   - cities:  every day has a city
//   - plans:   every day has a non-empty plan
//   - mention: each place in the fixture's mustMention shows up in some city or plan
// A fixture passes when all five hold. The target is 4 of 5 (8 of 10 once
// there are ten fixtures).
//
// Usage (needs GEMINI_API_KEY in the environment; Node 22 can load it from a
// dotenv file without printing it):
//   node --env-file=.env.local evals/run-import.mjs [fixture-id-substring]
// Results go to evals/results/<timestamp>.json, which is gitignored. They hold
// the model's output, so treat them like the fixtures: private.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { validateImportInput, extractItinerary, datesInRange } from "../api/itinerary-import.js";

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || "";

export function scoreImport(fixture, days) {
  const want = datesInRange(fixture.startDate, fixture.endDate) || [];
  const got = days.map((d) => d.date);
  const all = days.map((d) => `${d.city}\n${d.plan}`).join("\n").toLowerCase();
  const checks = {
    days: days.length === fixture.expectedDays && want.length === fixture.expectedDays,
    range: got.length === want.length && got.every((d, i) => d === want[i]),
    cities: days.every((d) => d.city?.trim()),
    plans: days.every((d) => d.plan?.trim()),
    mention: (fixture.mustMention || []).every((m) => all.includes(m.toLowerCase())),
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Run: node --env-file=.env.local evals/run-import.mjs");
    process.exit(2);
  }
  const dir = join(here, "fixtures");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f.includes(filter)).sort();
  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(await readFile(join(dir, file), "utf8"));
    const started = Date.now();
    let row;
    try {
      const input = validateImportInput(fixture);
      if (!input.ok) throw new Error(`rejected input: ${input.out.body.message}`);
      const { days, repairs } = await extractItinerary(input);
      row = { id: fixture.id, ...scoreImport(fixture, days), repairs, truncated: input.truncated, days };
    } catch (e) {
      row = { id: fixture.id, pass: false, error: String(e?.message || e) };
    }
    row.ms = Date.now() - started;
    results.push(row);
    const failed = row.checks ? Object.entries(row.checks).filter(([, ok]) => !ok).map(([k]) => k) : [];
    const note = row.error ? `error: ${row.error}` : failed.length ? `failed: ${failed.join(", ")}` : "";
    const fixes = row.repairs ? ` repairs ${JSON.stringify(row.repairs)}` : "";
    console.log(`${row.pass ? "PASS" : "FAIL"}  ${fixture.id}  (${row.ms} ms)${fixes} ${note}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed} of ${results.length} passed`);

  const outDir = join(here, "results");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(outDir, `import-${stamp}.json`);
  await writeFile(out, JSON.stringify({ model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest", passed, total: results.length, results }, null, 2));
  console.log(`Results: ${out}`);
}

// Only run when executed directly, so tests can import scoreImport.
// Lower-cased because Windows may report the drive letter either way.
const self = fileURLToPath(import.meta.url).toLowerCase();
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === self) main();
