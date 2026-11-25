import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Built from a string path, not `new URL(...)`: under jsdom the global URL is
// jsdom's, which node:url's fileURLToPath rejects.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../__fixtures__/gpx/");

// The parser only needs `name` and `text()` from a File, so a plain object
// stands in for one — no Blob implementation required.
export function fixtureFile(name) {
  const text = readFileSync(FIXTURES + name, "utf8");
  return { name, text: async () => text };
}

export function fixtureText(name) {
  return readFileSync(FIXTURES + name, "utf8");
}

// A split series from paces alone (min/km), one split per km.
export function splitsFromPaces(paces, extra = () => ({})) {
  return paces.map((pace, i) => ({ km: i + 1, pace, ...extra(i) }));
}
