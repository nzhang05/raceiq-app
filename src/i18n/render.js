/*
  Turns engine output into displayable text.

  Two kinds of finding flow through the debrief and plan views:

    { key, values, context }   the deterministic rule engine (src/utils/*)
    { title, body, evidence }  Claude's narrative (api/_lib/prompts.js), already
                               written in the athlete's language by the server

  Both render through here so no component has to know which it got. A finding
  that already carries prose is passed through untouched.

  `t` is whatever the caller has — the React `t` from useTranslation, or the
  fixed-locale `t` from src/i18n/server.js on the server.
*/

const NS = "debrief";

/*
  A value of the shape { $key: "ns:key" } is a deferred reference to another
  catalog entry, resolved just before interpolation. The debrief's fuelling
  sentences use it to pull in the duration-banded rationale from the `plan`
  catalog without src/utils/analysis.js ever holding translatable text.

  This is done here rather than with i18next's `$t()` nesting because nesting
  inside an *interpolated value* depends on interpolation.skipOnVariables, which
  is off by default and does not apply on the fixed-locale server instance.
*/
function resolveValues(t, values) {
  if (!values) return values;
  let out = values;
  for (const [k, v] of Object.entries(values)) {
    if (v && typeof v === "object" && typeof v.$key === "string") {
      if (out === values) out = { ...values };
      out[k] = t(v.$key);
    }
  }
  return out;
}

export function findingText(t, f, ns = NS) {
  if (!f?.key) return { title: f?.title ?? "", body: f?.body ?? "", evidence: f?.evidence };
  const opts = { ...resolveValues(t, f.values), context: f.context, ns };
  return {
    title: t(`${f.key}.title`, opts),
    body: t(`${f.key}.body`, opts),
    evidence: f.evidence,
  };
}

// `ns` is "debrief" for findings from buildDebrief() and "plan" for the
// forward-looking recommendations from buildRacePlan().
export function recText(t, r, ns = NS) {
  if (!r?.key) return { action: r?.action ?? "", why: r?.why ?? "", evidence: r?.evidence };
  const opts = { ...resolveValues(t, r.values), context: r.context, ns };
  return {
    action: t(`${r.key}.action`, opts),
    why: t(`${r.key}.why`, opts),
    evidence: r.evidence,
  };
}

// Carry-plan leg note: a base sentence plus an optional over-capacity warning.
// See buildCarryPlan() in src/utils/aidStations.js.
export function legNoteText(t, leg) {
  if (!leg?.noteKey) return leg?.note ?? "";
  const base = t(leg.noteKey, { ...leg.noteValues, ns: "plan" });
  if (!leg.overCapacity) return base;
  return `${base} ${t("leg.overCapacity", { ...leg.noteValues, ns: "plan" })}`;
}

// personalizeFueling() emits its notes as { key, values } too.
export function fuelNoteText(t, note) {
  if (!note?.key) return typeof note === "string" ? note : "";
  return t(note.key, { ...note.values, ns: "plan" });
}

/*
  Race headline. `headlineKey` is set by enrichRace(); `headline` is the legacy
  literal on races saved before this change (and on rows already in Supabase),
  which we show as-is rather than dropping the line. See docs/design-i18n.md §3.7.
*/
export function headlineText(t, race) {
  if (race?.headlineKey) return t(race.headlineKey, { ns: NS });
  return race?.headline ?? "";
}

/*
  ParseError (src/utils/gpx.js) and WeatherError (src/utils/weather.js) carry a
  catalog key instead of a sentence. Anything else — a network failure, a
  Supabase error — already has a human message, so pass it through.
*/
export function errorText(t, err, fallbackKey) {
  if (err?.key) return t(err.key, { ...err.values, ns: "plan" });
  if (err?.message) return err.message;
  return fallbackKey ? t(fallbackKey) : "";
}
