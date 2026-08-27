/*
  A React-free, detector-free i18next instance for the serverless functions in
  api/. `api/_lib/prompts.js` needs the English catalog to render the rule
  engine's findings into the grounding block it sends Claude, and needs the
  athlete's locale for the canned fallback answers.

  Kept separate from src/i18n/index.js on purpose: that module installs the
  browser language detector and the react-i18next binding, both of which touch
  `document` / `localStorage` and have no business running in a Node function.

  The catalogs are .js modules rather than .json so that both Vite and the Node
  function runtime import them with no loader configuration or import
  assertions.
*/
import { createInstance } from "i18next";
import { resources, LOCALES } from "./resources.js";

const instance = createInstance();
instance.init({
  resources,
  supportedLngs: LOCALES,
  fallbackLng: "en",
  lng: "en",
  ns: Object.keys(resources.en),
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
  initImmediate: false,
});

export function normalizeLocale(locale) {
  const short = String(locale || "en").split("-")[0].toLowerCase();
  return LOCALES.includes(short) ? short : "en";
}

// A `t` bound to one locale. Safe to call concurrently — getFixedT does not
// mutate the shared instance's language.
export function tFor(locale) {
  return instance.getFixedT(normalizeLocale(locale));
}

// Language name as written in that language, for the prompt directive.
export const LOCALE_NAMES = { en: "English", fr: "French" };
