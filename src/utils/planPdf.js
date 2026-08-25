// The athlete's race plan as a clean, light-theme printable document. The
// iframe/print mechanics and the shared stylesheet live in ./printDoc.js, which
// the crew sheet (./crewPdf.js) also uses so the two documents match.

import { recText, fuelNoteText } from "../i18n/render.js";
import { activeLocale } from "../i18n/index.js";
import { esc, fmtPace, fmtDuration, printDocument, PRINT_CSS } from "./printDoc.js";

// `t` is the caller's translation function and `lang` the active locale — the
// export is a finished document rather than a render tree, so injecting `t`
// beats returning structured data here. `lang` lands on <html> so the print
// engine hyphenates correctly.
export function buildPlanHtml(plan, kit, t, lang = "en") {
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const { course, targetClock, pacing, pacingSections, nutrition, carryPlan, recommendations, referenceRace, weather, raceDate,
          schedule, stopMinutes, movingClock } = plan;

  const summaryRows = [
    [P("pdf.summary.targetTime"), targetClock],
    // Only shown once there is a split worth showing — a road plan looks exactly
    // as it did before.
    ...(stopMinutes > 0 ? [[P("pdf.summary.moving"), P("pdf.summary.movingValue", { moving: movingClock, stopped: Math.round(stopMinutes) })]] : []),
    ...(schedule ? [[P("pdf.summary.startFinish"), `${schedule.startClock} → ${schedule.finishClock}${schedule.finishDayOffset > 0 ? ` (+${schedule.finishDayOffset}d)` : ""}`]] : []),
    [P("pdf.summary.distance"), `${course.distanceKm} km`],
    [P("pdf.summary.elevation"), `+${course.elevationM ?? 0} m`],
    [P("pdf.summary.conditions"), weather?.tempC != null
      ? P("pdf.summary.conditionsValue", {
          tempC: weather.tempC,
          windPart: weather.wind != null ? P("pdf.summary.windPart", { wind: weather.wind }) : "",
        })
      : "—"],
    [P("pdf.summary.basedOn"), referenceRace
      ? P("pdf.summary.basedOnValue", { name: referenceRace.name, finishTime: referenceRace.finishTime, distanceKm: referenceRace.distanceKm })
      : P("pdf.summary.genericPace")],
  ];

  const pacingBySection = pacingSections?.length;
  const th = (key) => `<th>${esc(P(key))}</th>`;
  const pacingHead = pacingBySection
    ? `<tr>${th("view.pacing.colSection")}${th("view.pacing.colDist")}${th("view.pacing.colGrade")}${th("view.pacing.colTargetPace")}${th("view.pacing.colTime")}${schedule ? th("view.schedule.colArrive") : ""}</tr>`
    : `<tr>${th("view.pacing.colKm")}${th("view.pacing.colElev")}${th("view.pacing.colGrade")}${th("view.pacing.colTargetPace")}${th("view.pacing.colSegment")}</tr>`;
  const pacingRows = pacingBySection
    ? pacingSections.map((s, i) => `
        <tr>
          <td>${esc(s.fromName)} → ${esc(s.toName)}<br><span class="muted">km ${esc(s.fromKm)}–${esc(s.toKm)}${s.elevGainM > 0 ? ` · +${esc(s.elevGainM)}m` : ""}</span></td>
          <td>${esc(s.distanceKm)} km</td>
          <td>${s.gradePct > 0 ? "+" : ""}${esc(s.gradePct)}%</td>
          <td>${fmtPace(s.suggestedPace)}</td>
          <td>${fmtDuration(s.minutes)}</td>
          ${schedule ? `<td>${esc(schedule.points[i + 1]?.arrivalClock ?? "—")}${schedule.legs[i]?.inDarkness ? ` <span class="muted">${esc(P("view.schedule.darkShort"))}</span>` : ""}</td>` : ""}
        </tr>`).join("")
    : (pacing || []).map((s) => `
        <tr>
          <td>${esc(s.km)}</td>
          <td>${s.elevM != null ? esc(s.elevM) : "—"}</td>
          <td>${s.gradePct > 0 ? "+" : ""}${esc(s.gradePct)}%</td>
          <td>${fmtPace(s.suggestedPace)}</td>
          <td>${esc(P(`segment.${s.label}`))}</td>
        </tr>`).join("");

  const srcTag = (s) => (s === "manual" ? P("source.manualTag") : s === "history" ? P("source.historyTag") : "");
  const nutritionRows = [
    [P("pdf.carbsPerHr"), nutrition.carbsPerHr, nutrition.sources?.carbs],
    [P("pdf.sodiumPerHr"), `${nutrition.sodiumMgHr} mg`, nutrition.sources?.sodium],
    [P("pdf.fluidsPerHr"), `${nutrition.fluidsMlHr} ml`, nutrition.sources?.fluids],
    ...(nutrition.caffeineMg ? [[P("pdf.caffeine"), `${nutrition.caffeineMg} mg`, nutrition.sources?.caffeine]] : []),
  ].map(([k, v, s]) => `<tr><td>${esc(k)}</td><td>${esc(v)}<span class="muted">${esc(srcTag(s))}</span></td></tr>`).join("");

  const carrySection = carryPlan?.legs?.length ? `
    <h2>${esc(P("view.carry.title"))}</h2>
    <table>
      <thead><tr>${th("view.carry.colLeg")}${th("view.carry.colDist")}${th("view.carry.colTime")}${th("view.nutrition.carbsPerHr")}${th("view.kit.fluids")}${th("view.kit.sodium")}</tr></thead>
      <tbody>
        ${carryPlan.legs.map((l) => `
          <tr>
            <td>${esc(l.fromName)} → ${esc(l.toName)}<br><span class="muted">km ${esc(l.fromKm)}–${esc(l.toKm)}</span></td>
            <td>${esc(l.legKm)} km</td>
            <td>${fmtDuration(l.minutes)}</td>
            <td>${esc(l.carbsG)} g${l.gels > 0 ? `<br><span class="muted">${esc(P("view.carry.gels", { count: l.gels }))}</span>` : ""}</td>
            <td${l.overCapacity ? ' class="warn"' : ""}>${esc(l.fluidsMl)} ml</td>
            <td>${esc(l.sodiumMg)} mg</td>
          </tr>`).join("")}
        <tr class="total">
          <td>${esc(P("view.carry.raceTotal"))}</td><td></td><td></td>
          <td>${esc(carryPlan.totals.carbsG)} g</td>
          <td>${esc(carryPlan.totals.fluidsMl)} ml</td>
          <td>${esc(carryPlan.totals.sodiumMg)} mg</td>
        </tr>
      </tbody>
    </table>` : "";

  const kitSection = kit?.items?.length ? `
    <h2>${esc(P("pdf.kit"))}</h2>
    <table>
      <thead><tr>${th("pdf.kitItem")}${th("pdf.kitQty")}${th("view.nutrition.carbsPerHr")}${th("view.kit.sodium")}${th("view.kit.fluids")}</tr></thead>
      <tbody>
        ${kit.items.map((it) => `
          <tr>
            <td>${esc(P(`fuelItem.${it.key}`))}</td>
            <td>${esc(it.qty)}×</td>
            <td>${esc(it.carbs * it.qty)} g</td>
            <td>${esc(it.sodiumMg * it.qty)} mg</td>
            <td>${esc(it.fluidMl * it.qty)} ml</td>
          </tr>`).join("")}
        <tr class="total">
          <td>${esc(P("pdf.kitTotal"))}</td><td>${esc(kit.totals.count)}</td>
          <td>${esc(kit.totals.carbsG)} g</td>
          <td>${esc(kit.totals.sodiumMg)} mg</td>
          <td>${esc(kit.totals.fluidsMl)} ml</td>
        </tr>
      </tbody>
    </table>` : "";

  const scheduleSection = schedule ? `
    <h2>${esc(P("view.schedule.title"))}</h2>
    <table>
      <thead><tr>${th("view.schedule.colPoint")}${th("view.schedule.colKm")}${th("view.schedule.colArrive")}${th("view.schedule.colStop")}${th("view.schedule.colDepart")}${th("view.schedule.colCutoff")}</tr></thead>
      <tbody>
        ${schedule.points.map((pt) => `
          <tr>
            <td>${esc(pt.name)}${pt.crewAccess ? `<br><span class="muted">${esc(P("view.schedule.crew"))}</span>` : ""}</td>
            <td>${esc(pt.km)}</td>
            <td>${esc(pt.arrivalClock)}${pt.dayOffset > 0 ? ` (+${pt.dayOffset}d)` : ""}${pt.window ? `<br><span class="muted">${esc(pt.window.earlyClock)}–${esc(pt.window.lateClock)}</span>` : ""}</td>
            <td>${pt.stopMinutes > 0 ? esc(P("view.schedule.minutes", { minutes: pt.stopMinutes })) : "—"}</td>
            <td>${esc(pt.departClock ?? "—")}</td>
            <td${pt.atCutoffRisk ? ' class="warn"' : ""}>${esc(pt.cutoff ?? "—")}</td>
          </tr>`).join("")}
      </tbody>
    </table>` : "";

  const recsSection = (recommendations || []).length ? `
    <h2>${esc(P("view.recommendations.title"))}</h2>
    <ol class="recs">
      ${recommendations.map((r) => {
        const { action, why } = recText(t, r, "plan");
        return `<li><strong>${esc(action)}</strong><br><span class="muted">${esc(why)}</span></li>`;
      }).join("")}
    </ol>` : "";

  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P("pdf.title", { course: course.name }))}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
  <div class="sub">${esc(P("view.eyebrow"))}${raceDate ? ` · ${esc(raceDate)}` : ""}</div>
  <h1>${esc(course.name)}</h1>
  <div class="sub">${esc(course.distanceKm)} km · +${esc(course.elevationM ?? 0)} m</div>

  <h2>${esc(P("pdf.summaryHeading"))}</h2>
  <div class="grid">
    ${summaryRows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}
  </div>

  <h2>${esc(P("view.pacing.title"))}</h2>
  <table>
    <thead>${pacingHead}</thead>
    <tbody>${pacingRows}</tbody>
  </table>

  <h2>${esc(P("view.nutrition.title"))}</h2>
  <table><tbody>${nutritionRows}</tbody></table>
  ${nutrition.rationaleKey ? `<div class="rationale">${esc(P(nutrition.rationaleKey))}</div>` : ""}
  ${nutrition.basedOnRaces > 0 ? `<div class="rationale">${esc(P("view.nutrition.personalised", { count: nutrition.basedOnRaces }))}</div>` : ""}
  ${(nutrition.notes || []).map((n) => `<div class="rationale">${esc(fuelNoteText(t, n))}</div>`).join("")}

  ${scheduleSection}
  ${carrySection}
  ${kitSection}
  ${recsSection}
</body>
</html>`;
}

export function printPlan(plan, kit, t) {
  printDocument(buildPlanHtml(plan, kit, t, activeLocale()));
}
