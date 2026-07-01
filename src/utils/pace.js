// Minetti-derived polynomial, normalized so cost(0) = 1.
// Running: energy cost of locomotion curve from Minetti 2002.
// Cycling: power penalty approximated from grade.
export function runningCostMultiplier(gradePct) {
  const g = Math.max(-30, Math.min(30, gradePct)) / 100;
  const cost =
    155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
  const flatCost = 3.6;
  return Math.max(0.45, cost / flatCost);
}

export function cyclingCostMultiplier(gradePct) {
  const g = Math.max(-20, Math.min(20, gradePct));
  if (g >= 0) return 1 + g * 0.11;
  return Math.max(0.55, 1 + g * 0.045);
}

export function gradePercent(split, prevSplit) {
  if (!prevSplit || split.elevM == null || prevSplit.elevM == null) return 0;
  const distM = (split.km - prevSplit.km) * 1000;
  if (distM <= 0) return 0;
  return ((split.elevM - prevSplit.elevM) / distM) * 100;
}

export function gapPaceForSplit(split, prevSplit, sport) {
  const grade = gradePercent(split, prevSplit);
  const isRun = sport === "Road Running" || sport === "Trail Running";
  const mult = isRun ? runningCostMultiplier(grade) : cyclingCostMultiplier(grade);
  return { gradePct: Math.round(grade * 10) / 10, gapPace: split.pace / mult };
}

export function withGap(splits, sport) {
  return splits.map((s, i) => {
    const { gradePct, gapPace } = gapPaceForSplit(s, splits[i - 1], sport);
    return { ...s, gradePct, gapPace };
  });
}

export function hasElevationData(splits) {
  return splits.some((s) => s.elevM != null && s.elevM !== "");
}

export function sportUsesGap(sport) {
  return sport === "Trail Running" || sport === "Gravel Cycling" || sport === "Road Cycling";
}

export function fmtPace(minPerKm) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function paceDriftPct(splits) {
  if (!splits || splits.length < 2) return 0;
  const key = splits[0].gapPace != null ? "gapPace" : "pace";
  return Math.round(((splits[splits.length - 1][key] - splits[0][key]) / splits[0][key]) * 100);
}
