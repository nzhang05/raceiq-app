export function parseClockToMinutes(clock) {
  // accepts "H:MM:SS" or "MM:SS"
  const parts = clock.split(":").map((p) => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseFloat(clock) || 0;
}

// Date formatting follows the active locale — see src/i18n/format.js. Re-exported
// here so the many existing `from "../utils/time.js"` imports keep working.
export { fmtDate, shortDate, fmtTimeOfDay } from "../i18n/format.js";
