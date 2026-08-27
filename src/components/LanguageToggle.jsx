import { useTranslation } from "react-i18next";
import { T, R, FONT_BODY } from "../constants.js";
import { LOCALES, LOCALE_LABELS, changeLocale, activeLocale } from "../i18n/index.js";
import { useAuth } from "../context/AuthContext.jsx";

/*
  EN / FR segmented control.

  Switching is instant — i18next re-renders every subscriber, so there is no
  reload. For a signed-in athlete the choice is also persisted to
  `profiles.locale`; for everyone it lands in localStorage, which is what the
  language detector reads first on the next visit.
*/
export default function LanguageToggle() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const current = activeLocale();

  function pick(locale) {
    if (locale === current) return;
    changeLocale(locale);
    if (user && profile && profile.locale !== locale) {
      // Fire and forget: the UI has already switched, and a failed write just
      // means the browser-local preference is the one that survives.
      updateProfile({ locale });
    }
  }

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      style={{
        display: "inline-flex",
        border: `1px solid ${T.line}`,
        borderRadius: R.pill,
        overflow: "hidden",
      }}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            onClick={() => pick(locale)}
            aria-pressed={active}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
              padding: "6px 11px",
              border: "none",
              background: active ? `${T.brass}1A` : "transparent",
              color: active ? T.brass : T.inkDim,
              cursor: active ? "default" : "pointer",
              transition: "all 140ms ease",
            }}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
