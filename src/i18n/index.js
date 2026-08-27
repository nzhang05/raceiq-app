/*
  i18next setup for the browser. Two locales, English and French.

  Detection order is localStorage → navigator → 'en'. For signed-in athletes the
  profile's `locale` column wins and is applied once the profile loads (see
  src/context/AuthContext.jsx); localStorage is the anonymous store and the
  pre-profile default.

  `load: 'languageOnly'` collapses fr-CA / fr-FR / fr-BE onto 'fr'.
*/
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { resources, LOCALES, LOCALE_LABELS, LOCALE_STORAGE_KEY } from "./resources.js";
import { setFormatLocale } from "./format.js";

export { LOCALES, LOCALE_LABELS, LOCALE_STORAGE_KEY };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: LOCALES,
    fallbackLng: "en",
    load: "languageOnly",
    ns: ["common", "debrief", "plan", "coach"],
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: {
      // React escapes for us.
      escapeValue: false,
    },
    returnNull: false,
  });

// Keep the non-React formatters and the document language in step with i18next.
function syncLocale(lng) {
  const short = (lng || "en").split("-")[0];
  setFormatLocale(short);
  if (typeof document !== "undefined") document.documentElement.lang = short;
}

syncLocale(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", syncLocale);

export function changeLocale(next) {
  if (!LOCALES.includes(next) || next === activeLocale()) return;
  i18n.changeLanguage(next);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* private browsing — in-memory only */
  }
}

export function activeLocale() {
  return (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
}

export default i18n;
