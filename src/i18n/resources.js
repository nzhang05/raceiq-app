/*
  The catalogs, shared by the browser instance (src/i18n/index.js) and the
  server instance (src/i18n/server.js).

  These are .js modules rather than .json so that both Vite and the Node
  function runtime under api/ import them without a loader or import
  assertions. Keep them to plain nested objects of strings — scripts/check-i18n.mjs
  walks them structurally.
*/
import enCommon from "./en/common.js";
import enDebrief from "./en/debrief.js";
import enPlan from "./en/plan.js";
import enCoach from "./en/coach.js";
import frCommon from "./fr/common.js";
import frDebrief from "./fr/debrief.js";
import frPlan from "./fr/plan.js";
import frCoach from "./fr/coach.js";

export const LOCALES = ["en", "fr"];
export const LOCALE_LABELS = { en: "EN", fr: "FR" };
export const LOCALE_STORAGE_KEY = "raceiq:locale";

export const resources = {
  en: { common: enCommon, debrief: enDebrief, plan: enPlan, coach: enCoach },
  fr: { common: frCommon, debrief: frDebrief, plan: frPlan, coach: frCoach },
};
