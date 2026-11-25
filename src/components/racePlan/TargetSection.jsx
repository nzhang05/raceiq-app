import { useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../../constants.js";
import { Field, TextInput, FormSectionTitle } from "../ui.jsx";

/* Section 4 — the suggested finish time, and the athlete's own target. */
export default function TargetSection({ derivedClock, derivedNote, estimateSource, targetClock, setTargetClock }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });

  return (
    <>
      <FormSectionTitle>{P("form.section.targetTime")}</FormSectionTitle>

      {(derivedClock || estimateSource === "loading") && (
        <div style={{ background: T.bg2, border: `1px solid ${estimateSource === "ai" ? T.brassDim : T.line}`, borderRadius: 4, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim }}>{P("form.estimate")}</span>
            {estimateSource === "ai" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.brass, background: `${T.brass}1F`, border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "1px 6px" }}>{P("form.estimateAi")}</span>
            )}
            {estimateSource === "loading" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim }}>{P("form.estimateThinking")}</span>
            )}
          </div>
          {estimateSource === "loading"
            ? <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, color: T.inkDim }}>—</div>
            : <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, color: T.brass }}>{derivedClock}</div>
          }
          {derivedNote && estimateSource !== "loading" && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, marginTop: 6, lineHeight: 1.5 }}>{derivedNote}</div>
          )}
        </div>
      )}

      <Field label={P("form.targetLabel")} hint={P("form.targetHint")}>
        <TextInput
          value={targetClock}
          onChange={(e) => setTargetClock(e.target.value)}
          placeholder={P("form.targetPlaceholder")}
        />
      </Field>
    </>
  );
}
