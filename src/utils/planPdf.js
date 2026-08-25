// Print/export the race plan as a clean, light-theme document. Rather than pull in
// a PDF library, we render a self-contained HTML document into a hidden iframe and
// trigger the browser's print dialog — every platform's print dialog offers
// "Save as PDF", including mobile Safari and Chrome. Keeps the prototype dep-free.

import { recText, fuelNoteText } from "../i18n/render.js";
import { activeLocale } from "../i18n/index.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fmtPace(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return "—";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function fmtDuration(min) {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

// `t` is the caller's translation function and `lang` the active locale — the
// export is a finished document rather than a render tree, so injecting `t`
// beats returning structured data here. `lang` lands on <html> so the print
// engine hyphenates correctly.
export function buildPlanHtml(plan, kit, t, lang = "en") {
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const { course, targetClock, pacing, pacingSections, nutrition, carryPlan, recommendations, referenceRace, weather, raceDate } = plan;

  const summaryRows = [
    [P("pdf.summary.targetTime"), targetClock],
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
    ? `<tr>${th("view.pacing.colSection")}${th("view.pacing.colDist")}${th("view.pacing.colGrade")}${th("view.pacing.colTargetPace")}${th("view.pacing.colTime")}</tr>`
    : `<tr>${th("view.pacing.colKm")}${th("view.pacing.colElev")}${th("view.pacing.colGrade")}${th("view.pacing.colTargetPace")}${th("view.pacing.colSegment")}</tr>`;
  const pacingRows = pacingBySection
    ? pacingSections.map((s) => `
        <tr>
          <td>${esc(s.fromName)} → ${esc(s.toName)}<br><span class="muted">km ${esc(s.fromKm)}–${esc(s.toKm)}${s.elevGainM > 0 ? ` · +${esc(s.elevGainM)}m` : ""}</span></td>
          <td>${esc(s.distanceKm)} km</td>
          <td>${s.gradePct > 0 ? "+" : ""}${esc(s.gradePct)}%</td>
          <td>${fmtPace(s.suggestedPace)}</td>
          <td>${fmtDuration(s.minutes)}</td>
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
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 28px 26px; }
  h1 { font-family: Arial, sans-serif; font-size: 24px; margin: 0 0 2px; }
  h2 { font-family: Arial, sans-serif; font-size: 15px; letter-spacing: 0.4px; text-transform: uppercase; color: #8a6d20; border-bottom: 1.5px solid #d8cfa8; padding-bottom: 5px; margin: 26px 0 10px; }
  .sub { font-family: 'Courier New', monospace; font-size: 12px; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-family: Arial, sans-serif; text-align: left; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr.total td { font-family: Arial, sans-serif; font-weight: bold; border-top: 1.5px solid #ccc; border-bottom: none; }
  .muted { color: #999; font-size: 11px; }
  .warn { color: #c0392b; font-weight: bold; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .grid div { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 5px 0; font-size: 12.5px; }
  .grid div span:first-child { color: #888; font-family: Arial, sans-serif; font-size: 11px; }
  .recs { padding-left: 18px; }
  .recs li { margin-bottom: 10px; font-size: 13px; }
  .rationale { font-size: 12.5px; color: #444; margin-top: 8px; line-height: 1.5; }
  @media print { body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
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

  ${carrySection}
  ${kitSection}
  ${recsSection}
</body>
</html>`;
}

export function printPlan(plan, kit, t) {
  const html = buildPlanHtml(plan, kit, t, activeLocale());
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
  // Give the iframe a tick to lay out before printing; clean up after the dialog.
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.onafterprint = cleanup;
    iframe.contentWindow.print();
    setTimeout(cleanup, 60000); // fallback cleanup if onafterprint never fires
  }, 300);
}
