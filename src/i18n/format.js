/*
  Locale-aware formatting.

  These helpers are imported by pure utility modules (time.js, pace.js) that must
  not depend on React or on i18next's react bindings, so the active locale lives
  in a module-level variable that `src/i18n/index.js` keeps in sync with
  i18next's language. Read it through `currentLocale()` — never cache the
  formatters across a language change.
*/

let locale = "en";

export function setFormatLocale(next) {
  locale = next === "fr" ? "fr" : "en";
}

export function currentLocale() {
  return locale;
}

// "Apr 19, 2026" / "19 avr. 2026"
export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

// "Apr '26" / "avr. '26" — the tick-year form is compact enough to work in both.
export function shortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleDateString(locale, { month: "short" });
  const year = d.getFullYear().toString().slice(2);
  return `${month} '${year}`;
}

export function fmtTimeOfDay(ts) {
  return new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/* Numbers. French uses a comma decimal separator and a narrow no-break space for
   thousands, so any decimal that reaches the UI has to route through here rather
   than through `.toFixed()`. Clock times and paces are deliberately NOT number-
   formatted — "3:24:51" and "4:42/km" are colon-separated in both locales. */
export function fmtNumber(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

// Signed value, for deltas like "+64" / "−38".
export function fmtSigned(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function fmtList(items) {
  const arr = (items || []).filter(Boolean).map(String);
  if (!arr.length) return "";
  if (typeof Intl.ListFormat !== "function") return arr.join(", ");
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(arr);
}
