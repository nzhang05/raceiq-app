import { useTranslation } from "react-i18next";
import { T, FONT_BODY } from "../../constants.js";
import { fuelNoteText } from "../../i18n/render.js";
import { Field, TextInput, FormSectionTitle } from "../ui.jsx";

/*
  Section 5 — optional fueling overrides. A blank field means "use what RaceIQ
  derives", which is shown as the placeholder along with where it came from.
*/
export default function FuelingSection({ derivedFueling, fuelCarbs, setFuelCarbs, fuelSodium, setFuelSodium, fuelFluids, setFuelFluids, fuelCaffeine, setFuelCaffeine }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });

  function fuelHint(metric) {
    if (!derivedFueling) return P("form.fuelHint.needTarget");
    const src = derivedFueling.sources[metric];
    if (src === "history") return P("form.fuelHint.history", { count: derivedFueling.basedOnRaces });
    return P("form.fuelHint.generic");
  }

  return (
    <>
      <FormSectionTitle>{P("form.section.fueling")}</FormSectionTitle>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 14px", lineHeight: 1.5 }}>
        {P("form.fuelingIntro", {
          defaultsPart: derivedFueling?.basedOnRaces ? "" : P("form.fuelingIntroDefaults"),
        })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={P("form.carbs")} hint={fuelHint("carbs")}>
          <TextInput type="number" value={fuelCarbs} onChange={(e) => setFuelCarbs(e.target.value)} placeholder={derivedFueling?.carbsTargetNum != null ? String(derivedFueling.carbsTargetNum) : "—"} />
        </Field>
        <Field label={P("form.sodium")} hint={fuelHint("sodium")}>
          <TextInput type="number" value={fuelSodium} onChange={(e) => setFuelSodium(e.target.value)} placeholder={derivedFueling?.sodiumMgHr != null ? String(derivedFueling.sodiumMgHr) : "—"} />
        </Field>
        <Field label={P("form.fluids")} hint={fuelHint("fluids")}>
          <TextInput type="number" value={fuelFluids} onChange={(e) => setFuelFluids(e.target.value)} placeholder={derivedFueling?.fluidsMlHr != null ? String(derivedFueling.fluidsMlHr) : "—"} />
        </Field>
        <Field label={P("form.caffeine")} hint={fuelHint("caffeine")}>
          <TextInput type="number" value={fuelCaffeine} onChange={(e) => setFuelCaffeine(e.target.value)} placeholder={derivedFueling?.caffeineMg != null ? String(derivedFueling.caffeineMg) : "—"} />
        </Field>
      </div>

      {derivedFueling?.notes?.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {derivedFueling.notes.map((note, i) => (
            <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.brass, lineHeight: 1.45 }}>{fuelNoteText(t, note)}</div>
          ))}
        </div>
      )}
    </>
  );
}
