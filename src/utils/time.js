export function parseClockToMinutes(clock) {
  // accepts "H:MM:SS" or "MM:SS"
  const parts = clock.split(":").map((p) => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseFloat(clock) || 0;
}

export function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function shortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear().toString().slice(2);
  return `${month} '${year}`;
}
