/*
  Grounding check: does an AI answer cite only numbers that are in the data it
  was given?

  This is the testable form of RaceIQ's core rule — the engine computes every
  number, Claude only narrates. Given the DATA text a prompt carried and the
  text Claude returned, it lists every number in the answer that the data does
  not contain. An empty list means the answer is grounded.

  What counts as "the same number":
    - Values are compared, not spellings: "32.7", "+32.7%" and French "32,7 %"
      are one number; so are "1,850" (en) and "1 850" (fr) and "1850".
    - Clock values (paces, finish times) are compared as clocks, so "6:09/km"
      matches "6:09" and "0:38:42" matches "38:42". A clock's parts are never
      matched as separate numbers — "4:25" does not license "25".
    - Sign is ignored: "-6.3 pts" in the data grounds "6.3 points" in prose.
    - Re-rounding is NOT tolerated: data "32.7%" does not ground "33%". The
      narrative prompt forbids re-rounding; this check enforces it.
    - Digits glued to a preceding letter ("r1", "Opus 5") are identifiers, not
      quantities, and are skipped on both sides. Digits followed by a unit or an
      ordinal suffix ("52g", "98.6th", "9e") are quantities.

  Pure and dependency-free, so it runs in Vitest, in a script, or server-side.
*/

const CLOCK = /(?<![\p{L}\d])(\d{1,2})[:'](\d{2})(?:[:'](\d{2}))?(?!\d)/gu;
const NUMBER = /(?<![\p{L}\d.])\d+(?:\.\d+)?/gu;

function normalizeSeparators(text, locale) {
  let s = text.normalize("NFC");
  if (locale === "fr") {
    // French: space / no-break space / narrow no-break space group thousands,
    // and the comma is the decimal mark.
    s = s.replace(/(\d)[   ](?=\d{3}(?!\d))/g, "$1");
    s = s.replace(/(\d),(?=\d)/g, "$1.");
  } else {
    // English: "1,850" groups thousands. "14, 2025" (a date) is untouched
    // because a space follows the comma.
    s = s.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  }
  return s;
}

function canonicalClock(h, m, s) {
  if (s == null) return `${Number(h)}:${m}`;
  return Number(h) === 0 ? `${Number(m)}:${s}` : `${Number(h)}:${m}:${s}`;
}

/*
  Every number in `text`, as { raw, canon, index }. `canon` is the comparable
  form: "c:6:09" for clocks, "n:32.7" for plain numbers.
*/
export function extractNumbers(text, locale = "en") {
  const src = normalizeSeparators(String(text ?? ""), locale);
  const out = [];

  // Clocks first, then blank them out so their parts aren't re-read as numbers.
  let masked = src.replace(CLOCK, (match, h, m, s, index) => {
    out.push({ raw: match, canon: `c:${canonicalClock(h, m, s)}`, index });
    return " ".repeat(match.length);
  });

  for (const m of masked.matchAll(NUMBER)) {
    out.push({ raw: m[0], canon: `n:${Number(m[0])}`, index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

/*
  `data`   the text the model was given (string or array of strings), always
           English — the DATA block is never translated.
  `answer` the model's output: a string, or any JSON value (every string in it
           is checked, so evidence chips are held to the same rule as prose).
  Returns { ok, ungrounded: [{ raw, context }], cited: number }.
*/
export function checkGrounding({ data, answer, locale = "en", allow = [] }) {
  const allowed = new Set(allow.map((a) => `n:${Number(a)}`));
  for (const chunk of [].concat(data)) {
    for (const n of extractNumbers(chunk, "en")) allowed.add(n.canon);
  }

  const texts = [];
  (function collect(v) {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  })(answer);

  const ungrounded = [];
  let cited = 0;
  for (const text of texts) {
    for (const n of extractNumbers(text, locale)) {
      cited++;
      if (!allowed.has(n.canon)) {
        const at = Math.max(0, n.index - 30);
        ungrounded.push({ raw: n.raw, context: `…${text.slice(at, n.index + n.raw.length + 30)}…` });
      }
    }
  }
  return { ok: ungrounded.length === 0, ungrounded, cited };
}

/*
  The parts of a system prompt that carry athlete data — the ATHLETE line, the
  profile line and the race index — without the rule list, whose "1." … "8."
  and "2–4 sentences" would otherwise let small integers through unchecked.
*/
export function dataLinesFromSystem(system) {
  const lines = String(system ?? "").split("\n");
  const keep = [];
  let inIndex = false;
  for (const line of lines) {
    if (/^RACE INDEX/.test(line)) { inIndex = true; continue; }
    if (inIndex) {
      if (!line.trim()) { inIndex = false; continue; }
      keep.push(line);
      continue;
    }
    if (/^ATHLETE( PROFILE)?:/.test(line)) keep.push(line);
  }
  return keep.join("\n");
}
