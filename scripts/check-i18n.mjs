#!/usr/bin/env node
/*
  Catalog parity check. Runs as part of `npm run build`.

  Two failure modes it catches, both of which ship silently otherwise:
    1. A key present in one locale and missing in the other — the missing side
       falls back to English at runtime and nobody notices.
    2. A key whose interpolation placeholders differ between locales — the
       translated sentence renders with a literal "{{fade}}" in it, or silently
       drops a number the sentence depends on.

  It deliberately does NOT diff Intl format options ("number(maximumFractionDigits: 1)"):
  digit grouping is a legitimate per-language choice.
*/
import { resources, LOCALES } from "../src/i18n/resources.js";

const BASE = "en";
let failures = 0;

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failures++;
}

// "a.b.c" → string, walking the nested catalog objects.
function flatten(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, String(v));
  }
  return out;
}

// {{name}} and {{name, number(...)}} both yield "name". $t(...) references are
// checked separately.
function placeholders(str) {
  return new Set([...str.matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => m[1]));
}

function nestedRefs(str) {
  return new Set([...str.matchAll(/\$t\(([^)]+)\)/g)].map((m) => m[1].trim()));
}

for (const ns of Object.keys(resources[BASE])) {
  const base = flatten(resources[BASE][ns]);

  for (const locale of LOCALES.filter((l) => l !== BASE)) {
    const other = flatten(resources[locale][ns]);

    for (const key of base.keys()) {
      if (!other.has(key)) fail(`${locale}/${ns}: missing key "${key}"`);
    }
    for (const key of other.keys()) {
      if (!base.has(key)) fail(`${locale}/${ns}: extra key "${key}" not in ${BASE}`);
    }

    for (const [key, baseText] of base) {
      const otherText = other.get(key);
      if (otherText == null) continue;

      const a = placeholders(baseText);
      const b = placeholders(otherText);
      for (const p of a) if (!b.has(p)) fail(`${locale}/${ns}:${key} — missing placeholder {{${p}}}`);
      for (const p of b) if (!a.has(p)) fail(`${locale}/${ns}:${key} — unexpected placeholder {{${p}}}`);

      const ra = nestedRefs(baseText);
      const rb = nestedRefs(otherText);
      for (const r of ra) if (!rb.has(r)) fail(`${locale}/${ns}:${key} — missing nested reference $t(${r})`);
      for (const r of rb) if (!ra.has(r)) fail(`${locale}/${ns}:${key} — unexpected nested reference $t(${r})`);
    }
  }
}

if (failures) {
  console.error(`\ni18n check failed: ${failures} problem${failures === 1 ? "" : "s"}.\n`);
  process.exit(1);
}
console.log(`i18n check passed — ${LOCALES.join(", ")} in sync across ${Object.keys(resources[BASE]).length} namespaces.`);
