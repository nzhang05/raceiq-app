/*
  Minutes → clock text, in one place.

  Every formatter here rounds to whole seconds *before* splitting into fields.
  Splitting first and rounding the seconds field on its own is how "4:60/km"
  and "59:60" happen: 4.999 min has 59.94 s left over, which rounds to 60.
  No imports, so any module (weather.js, gpx.js) can use it without a cycle.
*/

// 4.5 → "4:30". For paces (min/km) and short durations.
export function fmtMinSec(minutes) {
  const total = Math.round(Math.abs(minutes) * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// 205.85 → "3:25:51"; 38.7 → "38:42". For finish times.
export function fmtClock(minutes) {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
