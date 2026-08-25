// Drop-bag suggestions.
//
// A drop-bag editor on its own is a notes app. What makes it RaceIQ is that the
// plan already knows what the leg *out* of each station demands — how long it
// is, how much carbohydrate it burns, and whether it runs in the dark — so it
// can say what belongs in the bag before the athlete has to think of it.
//
// Suggestions are proposals, never insertions: the UI offers them as one-tap
// chips. Each is emitted as a { key, values } pair rendered through the plan
// catalog, so no translatable text lives here.

import { fuelItem, tallyKit } from "./fuelKit.js";

const GEAR_KEYS = {
  headlamp: "dropBagGear.headlamp",
  socks: "dropBagGear.socks",
  jacket: "dropBagGear.jacket",
};

// Rough keyword match so an athlete who already typed "head torch" or "lampe
// frontale" isn't nagged. Deliberately loose — a false negative just means one
// extra dismissible chip.
function mentions(gear, words) {
  const hay = (gear ?? []).join(" ").toLowerCase();
  return words.some((w) => hay.includes(w));
}

/*
  Suggest contents for one station's bag.

    station      — sanitized station (carries the existing dropBag, if any)
    outboundLeg  — the carry-plan leg leaving this station (carbs, fluids, km)
    scheduleLeg  — the same leg from the schedule (darkness), or null
    arrivalMinutes — elapsed time at this station, for the long-race rules
*/
export function suggestBagContents({ station, outboundLeg, scheduleLeg, arrivalMinutes = 0 }) {
  const suggestions = [];
  const gear = station?.dropBag?.gear ?? [];
  const staged = tallyKit(station?.dropBag?.items ?? {}).totals;

  // 1. The leg out of here runs in the dark and there's no lamp in the bag.
  //    This is the single most consequential thing to forget on a 100-miler.
  if (scheduleLeg?.inDarkness && !mentions(gear, ["lamp", "torch", "light", "lampe", "frontale"])) {
    suggestions.push({ kind: "gear", key: GEAR_KEYS.headlamp, text: GEAR_KEYS.headlamp });
  }

  // 2. The outbound leg burns more carbohydrate than the bag currently stages.
  //    Suggest the gel count that closes the gap.
  if (outboundLeg?.carbsG > 0) {
    const shortfallG = outboundLeg.carbsG - staged.carbsG;
    const gel = fuelItem("gel");
    if (gel && shortfallG > gel.carbs) {
      suggestions.push({
        kind: "item",
        itemKey: "gel",
        qty: Math.ceil(shortfallG / gel.carbs),
        key: "dropBagHint.carbGap",
        values: { shortfallG: Math.round(shortfallG), legKm: outboundLeg.legKm },
      });
    }
  }

  // 3. Past eight hours, feet are a race-ending problem and dry socks are the
  //    cheapest insurance in the sport.
  if (arrivalMinutes >= 480 && !mentions(gear, ["sock", "shoe", "chausset", "chaussure"])) {
    suggestions.push({ kind: "gear", key: GEAR_KEYS.socks, text: GEAR_KEYS.socks });
  }

  // 4. Night legs get cold even in summer; pair the lamp suggestion with a layer.
  if (scheduleLeg?.inDarkness && !mentions(gear, ["jacket", "layer", "sleeve", "veste", "couche", "manches"])) {
    suggestions.push({ kind: "gear", key: GEAR_KEYS.jacket, text: GEAR_KEYS.jacket });
  }

  return suggestions;
}

/*
  Run the suggestion rules across every station, pairing each with its outbound
  leg. Returns a map keyed by station km so the editor can look them up without
  re-deriving the pairing.
*/
export function suggestAllBags({ stations, carryPlan, schedule }) {
  const out = new Map();
  (stations ?? []).forEach((station, i) => {
    // Leg i+1 leaves station i: leg 0 is start → first station.
    const outboundLeg = carryPlan?.legs?.[i + 1] ?? null;
    const scheduleLeg = schedule?.legs?.[i + 1] ?? null;
    const arrivalMinutes = schedule?.points?.[i + 1]?.arrivalMinutes ?? 0;
    const suggestions = suggestBagContents({ station, outboundLeg, scheduleLeg, arrivalMinutes });
    if (suggestions.length) out.set(station.km, suggestions);
  });
  return out;
}
