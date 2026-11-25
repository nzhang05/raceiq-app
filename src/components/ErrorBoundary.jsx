import { Component } from "react";
import i18n from "../i18n/index.js";
import { T, R, FONT_DISPLAY, FONT_BODY } from "../constants.js";
import { isDemo, resetDemoData } from "../lib/demo.js";
import { isSupabaseConfigured } from "../lib/supabase.js";

/*
  Last line of defence: a render error anywhere below shows a calm page with a
  way out, instead of a blank screen. Uses the i18n instance directly because
  a class component can't call useTranslation.

  A corrupt race saved in localStorage is the likeliest way to get here in
  local or demo mode, so those modes also offer to clear stored data.
*/
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[RaceIQ] render error", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = (k) => i18n.t(k, { ns: "common" });
    const btn = { fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, padding: "10px 18px", borderRadius: R.pill, cursor: "pointer" };
    return (
      <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: T.paper, margin: "0 0 10px" }}>{t("errorPage.title")}</h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.ink, lineHeight: 1.6, margin: "0 0 22px" }}>{t("errorPage.body")}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => window.location.reload()} style={{ ...btn, border: "none", background: T.brass, color: "#fff" }}>
              {t("errorPage.reload")}
            </button>
            {(isDemo || !isSupabaseConfigured) && (
              <button
                type="button"
                onClick={() => { resetDemoData(); window.location.reload(); }}
                style={{ ...btn, border: `1px solid ${T.line}`, background: T.surface, color: T.paper }}
              >
                {t("errorPage.reset")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
