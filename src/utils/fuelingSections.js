// Section-based fuelling: roll a race's per-section intake up into the four
// whole-race scalars every existing consumer reads (fueling.carbsPerHr etc.), so
// section input is purely additive. Section time is derived from the same splits
// the rest of the app uses, so fuel and pace share a coordinate system.

const num = (v) => (v === "" || v == null ? 0 : parseFloat(v) || 0);
const round1 = (n) => Math.round(n * 10) / 10;

// Elapsed minutes over [fromKm, toKm], summing each split segment's pace clipped
// to the range so a section that starts/ends mid-segment is counted proportionally.
export function sectionTimeFromSplits(splits, fromKm, toKm) {
  if (!splits || splits.length === 0) return 0;
  let minutes = 0;
  let prevKm = 0;
  for (const s of splits) {
    const startKm = prevKm;
    prevKm = s.km;
    if (s.pace == null) continue;
    const lo = Math.max(fromKm, startKm);
    const hi = Math.min(toKm, s.km);
    const overlap = hi - lo;
    if (overlap > 0) minutes += overlap * s.pace;
  }
  return minutes;
}

// Convert a total amount consumed in a section to a per-hour rate using the
// section's elapsed time. Used by the "total amount" entry mode.
export function amountToRate(amount, minutes) {
  if (!minutes || minutes <= 0) return 0;
  return num(amount) / (minutes / 60);
}

// Duration-weighted roll-up. Rates weight by the time actually spent in each
// section (a slow closing section counts for the hours it took); caffeine is a
// dosed total, so it sums. Falls back to a plain average if section times can't
// be derived (e.g. no splits yet).
export function rollUpSections(sections, splits) {
  let totalMin = 0;
  let carbsW = 0, sodiumW = 0, fluidsW = 0, caffeine = 0;

  for (const sec of sections) {
    const minutes = sectionTimeFromSplits(splits, sec.fromKm, sec.toKm);
    totalMin += minutes;
    carbsW += num(sec.carbsPerHr) * minutes;
    sodiumW += num(sec.sodiumPerHr) * minutes;
    fluidsW += num(sec.fluidsPerHr) * minutes;
    caffeine += num(sec.caffeineMg);
  }

  if (totalMin <= 0) {
    const n = sections.length || 1;
    const avg = (key) => Math.round(sections.reduce((a, s) => a + num(s[key]), 0) / n);
    return { carbsPerHr: avg("carbsPerHr"), sodiumPerHr: avg("sodiumPerHr"), fluidsPerHr: avg("fluidsPerHr"), caffeine };
  }

  return {
    carbsPerHr: Math.round(carbsW / totalMin),
    sodiumPerHr: Math.round(sodiumW / totalMin),
    fluidsPerHr: Math.round(fluidsW / totalMin),
    caffeine,
  };
}

// Normalize the editor's raw section rows into rate-based sections for storage /
// roll-up. In "amount" mode the carbs/sodium/fluids inputs are section totals and
// are converted to per-hour rates via the section's elapsed time.
export function sectionsToRates(sections, splits, entryMode) {
  return sections.map((sec) => {
    const base = { fromKm: round1(num(sec.fromKm)), toKm: round1(num(sec.toKm)), caffeineMg: num(sec.caffeine) };
    if (entryMode === "amount") {
      const minutes = sectionTimeFromSplits(splits, num(sec.fromKm), num(sec.toKm));
      return {
        ...base,
        carbsPerHr: Math.round(amountToRate(sec.carbs, minutes)),
        sodiumPerHr: Math.round(amountToRate(sec.sodium, minutes)),
        fluidsPerHr: Math.round(amountToRate(sec.fluids, minutes)),
      };
    }
    return {
      ...base,
      carbsPerHr: Math.round(num(sec.carbs)),
      sodiumPerHr: Math.round(num(sec.sodium)),
      fluidsPerHr: Math.round(num(sec.fluids)),
    };
  });
}

// Seed a fresh section editor: thirds of the race, each pre-filled with the
// athlete's current overall rates, so they start from the average and edit only
// the sections that differed.
export function seedThirdsSections(distanceKm, overall) {
  const d = round1(distanceKm);
  const b1 = round1(d / 3);
  const b2 = round1((2 * d) / 3);
  const ranges = [[0, b1], [b1, b2], [b2, d]];
  return ranges.map(([fromKm, toKm], i) => ({
    id: `fs-${Date.now()}-${i}`,
    fromKm,
    toKm,
    carbs: overall.carbs ?? "",
    sodium: overall.sodium ?? "",
    fluids: overall.fluids ?? "",
    caffeine: "",
  }));
}
