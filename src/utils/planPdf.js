// Print/export the race plan as a clean, light-theme document. Rather than pull in
// a PDF library, we render a self-contained HTML document into a hidden iframe and
// trigger the browser's print dialog — every platform's print dialog offers
// "Save as PDF", including mobile Safari and Chrome. Keeps the prototype dep-free.

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

export function buildPlanHtml(plan, kit) {
  const { course, targetClock, pacing, pacingSections, nutrition, carryPlan, recommendations, referenceRace, weather, raceDate } = plan;

  const summaryRows = [
    ["Target time", targetClock],
    ["Distance", `${course.distanceKm} km`],
    ["Elevation", `+${course.elevationM ?? 0} m`],
    ["Est. conditions", weather?.tempC != null ? `${weather.tempC}°C${weather.wind != null ? `, ${weather.wind} km/h wind` : ""}` : "—"],
    ["Based on", referenceRace ? `${referenceRace.name} (${referenceRace.finishTime} / ${referenceRace.distanceKm} km)` : "Generic pace"],
  ];

  const pacingBySection = pacingSections?.length;
  const pacingHead = pacingBySection
    ? "<tr><th>Section</th><th>Dist</th><th>Grade</th><th>Target pace</th><th>Time</th></tr>"
    : "<tr><th>KM</th><th>Elev (m)</th><th>Grade</th><th>Target pace</th><th>Segment</th></tr>";
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
          <td>${esc(s.label)}</td>
        </tr>`).join("");

  const srcTag = (s) => (s === "manual" ? " (your input)" : s === "history" ? " (from your history)" : "");
  const nutritionRows = [
    ["Carbs / hr", nutrition.carbsPerHr, nutrition.sources?.carbs],
    ["Sodium / hr", `${nutrition.sodiumMgHr} mg`, nutrition.sources?.sodium],
    ["Fluids / hr", `${nutrition.fluidsMlHr} ml`, nutrition.sources?.fluids],
    ...(nutrition.caffeineMg ? [["Caffeine", `${nutrition.caffeineMg} mg`, nutrition.sources?.caffeine]] : []),
  ].map(([k, v, s]) => `<tr><td>${esc(k)}</td><td>${esc(v)}<span class="muted">${esc(srcTag(s))}</span></td></tr>`).join("");

  const carrySection = carryPlan?.legs?.length ? `
    <h2>Fuel &amp; Carry Plan</h2>
    <table>
      <thead><tr><th>Leg</th><th>Dist</th><th>Time</th><th>Carbs</th><th>Fluid</th><th>Sodium</th></tr></thead>
      <tbody>
        ${carryPlan.legs.map((l) => `
          <tr>
            <td>${esc(l.fromName)} → ${esc(l.toName)}<br><span class="muted">km ${esc(l.fromKm)}–${esc(l.toKm)}</span></td>
            <td>${esc(l.legKm)} km</td>
            <td>${fmtDuration(l.minutes)}</td>
            <td>${esc(l.carbsG)} g${l.gels > 0 ? `<br><span class="muted">${esc(l.gels)} gel${l.gels === 1 ? "" : "s"}</span>` : ""}</td>
            <td${l.overCapacity ? ' class="warn"' : ""}>${esc(l.fluidsMl)} ml</td>
            <td>${esc(l.sodiumMg)} mg</td>
          </tr>`).join("")}
        <tr class="total">
          <td>Race total</td><td></td><td></td>
          <td>${esc(carryPlan.totals.carbsG)} g</td>
          <td>${esc(carryPlan.totals.fluidsMl)} ml</td>
          <td>${esc(carryPlan.totals.sodiumMg)} mg</td>
        </tr>
      </tbody>
    </table>` : "";

  const kitSection = kit?.items?.length ? `
    <h2>My Fuel Kit</h2>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Carbs</th><th>Sodium</th><th>Fluid</th></tr></thead>
      <tbody>
        ${kit.items.map((it) => `
          <tr>
            <td>${esc(it.label)}</td>
            <td>${esc(it.qty)}×</td>
            <td>${esc(it.carbs * it.qty)} g</td>
            <td>${esc(it.sodiumMg * it.qty)} mg</td>
            <td>${esc(it.fluidMl * it.qty)} ml</td>
          </tr>`).join("")}
        <tr class="total">
          <td>Kit total</td><td>${esc(kit.totals.count)}</td>
          <td>${esc(kit.totals.carbsG)} g</td>
          <td>${esc(kit.totals.sodiumMg)} mg</td>
          <td>${esc(kit.totals.fluidsMl)} ml</td>
        </tr>
      </tbody>
    </table>` : "";

  const recsSection = (recommendations || []).length ? `
    <h2>Tactical Recommendations</h2>
    <ol class="recs">
      ${recommendations.map((r) => `<li><strong>${esc(r.action)}</strong><br><span class="muted">${esc(r.why)}</span></li>`).join("")}
    </ol>` : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.name)} — Race Plan</title>
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
  <div class="sub">RACE PLAN${raceDate ? ` · ${esc(raceDate)}` : ""}</div>
  <h1>${esc(course.name)}</h1>
  <div class="sub">${esc(course.distanceKm)} km · +${esc(course.elevationM ?? 0)} m</div>

  <h2>Summary</h2>
  <div class="grid">
    ${summaryRows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}
  </div>

  <h2>Pacing Plan</h2>
  <table>
    <thead>${pacingHead}</thead>
    <tbody>${pacingRows}</tbody>
  </table>

  <h2>Nutrition Targets</h2>
  <table><tbody>${nutritionRows}</tbody></table>
  ${nutrition.rationale ? `<div class="rationale">${esc(nutrition.rationale)}</div>` : ""}
  ${nutrition.basedOnRaces > 0 ? `<div class="rationale">Personalised from ${esc(nutrition.basedOnRaces)} of your race${nutrition.basedOnRaces === 1 ? "" : "s"}.</div>` : ""}
  ${(nutrition.notes || []).map((n) => `<div class="rationale">${esc(n)}</div>`).join("")}

  ${carrySection}
  ${kitSection}
  ${recsSection}
</body>
</html>`;
}

export function printPlan(plan, kit) {
  const html = buildPlanHtml(plan, kit);
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
