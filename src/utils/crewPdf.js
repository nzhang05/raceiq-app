/*
  The crew sheet.

  Deliberately a *second* document rather than a section of the athlete's race
  plan. Different reader, different information, different physical use: this one
  gets printed, folded, and carried around in a car by someone who needs to know
  where to be and what to hand over — not what grade the climb at km 61 is.

  Design principles, in priority order:
    1. Arrival is a window, never a promise. A crew that plans against a point
       estimate stands in the cold.
    2. Everything a crew member does at a station fits on one screenful: arrive,
       cutoff, hand over, take back, notes.
    3. It works with no signal, because that is where ultras happen. Hence paper.
*/

import { activeLocale } from "../i18n/index.js";
import { esc, fmtDuration, printDocument, PRINT_CSS } from "./printDoc.js";
import { tallyDropBags } from "./fuelKit.js";

const CREW_CSS = `
  .station { break-inside: avoid; border: 1.5px solid #d8cfa8; border-radius: 4px; padding: 14px 16px; margin-bottom: 14px; }
  .station h3 { font-family: Arial, sans-serif; font-size: 15px; margin: 0 0 2px; display: flex; justify-content: space-between; gap: 12px; }
  .station .km { font-family: 'Courier New', monospace; font-size: 12px; color: #666; font-weight: normal; }
  .crewtag { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 0.5px; background: #8a6d20; color: #fff; padding: 2px 6px; border-radius: 2px; vertical-align: middle; }
  .rows { margin: 10px 0 0; }
  .row { display: grid; grid-template-columns: 92px 1fr; gap: 10px; font-size: 12.5px; padding: 3px 0; }
  .row .k { font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; color: #888; padding-top: 2px; }
  .big { font-family: 'Courier New', monospace; font-size: 17px; font-weight: bold; }
  .window { font-family: 'Courier New', monospace; font-size: 12px; color: #444; }
  .handover { list-style: none; padding: 0; margin: 0; }
  .handover li { padding: 1px 0; font-size: 12.5px; }
  .notes { font-style: italic; color: #444; }
  .lede { font-size: 13px; line-height: 1.55; margin: 0 0 6px; }
`;

export function buildCrewHtml(plan, t, lang = "en") {
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const { course, targetClock, raceDate, schedule, stations, carryPlan } = plan;
  const dropBags = tallyDropBags(stations ?? []);

  // Overview: every point in one scannable table, so the crew can see the whole
  // day before reading any single station block.
  const overviewRows = (schedule?.points ?? []).map((pt) => `
    <tr>
      <td>${esc(pt.name)}</td>
      <td>${esc(pt.km)}</td>
      <td>${esc(pt.arrivalClock)}${pt.dayOffset > 0 ? ` (+${pt.dayOffset}d)` : ""}
        ${pt.window ? `<br><span class="muted">${esc(pt.window.earlyClock)}–${esc(pt.window.lateClock)}</span>` : ""}</td>
      <td>${pt.crewAccess ? esc(P("crew.yes")) : "—"}</td>
      <td>${pt.dropBag ? esc(P("crew.yes")) : "—"}</td>
      <td${pt.atCutoffRisk ? ' class="warn"' : ""}>${esc(pt.cutoff ?? "—")}</td>
    </tr>`).join("");

  /*
    One block per station worth stopping at — anywhere the crew can reach the
    athlete, or where a bag is waiting. A station with neither is already covered
    by the overview table and would only pad the document.
  */
  const relevant = (schedule?.points ?? []).filter((pt) => pt.crewAccess || pt.dropBag);

  const stationBlocks = relevant.map((pt, i) => {
    const bag = dropBags.bags.find((b) => b.km === pt.km);
    // The leg leaving this point: what the athlete has to survive on next.
    const legIndex = schedule.points.indexOf(pt);
    const outLeg = schedule.legs[legIndex] ?? null;
    const carryLeg = carryPlan?.legs?.[legIndex] ?? null;

    const handover = [
      ...(bag?.items ?? []).map((it) => `${it.qty}× ${P(`fuelItem.${it.key}`)}`),
      ...(bag?.gear ?? []),
    ];

    const row = (label, value, cls = "") =>
      value ? `<div class="row"><div class="k">${esc(label)}</div><div class="${cls}">${value}</div></div>` : "";

    return `
      <div class="station">
        <h3>
          <span>${esc(pt.name)} ${pt.crewAccess ? `<span class="crewtag">${esc(P("crew.crewAccess"))}</span>` : ""}</span>
          <span class="km">km ${esc(pt.km)}</span>
        </h3>
        <div class="rows">
          ${row(P("crew.arrive"), `<span class="big">${esc(pt.arrivalClock)}</span>${pt.dayOffset > 0 ? ` (+${pt.dayOffset}d)` : ""}
            ${pt.window ? `<div class="window">${esc(P("crew.windowLine", { early: pt.window.earlyClock, late: pt.window.lateClock }))}</div>` : ""}`)}
          ${pt.cutoff ? row(P("crew.cutoff"), `${esc(pt.cutoff)} <span class="${pt.atCutoffRisk ? "warn" : "muted"}">${esc(
            P(pt.atCutoffRisk ? "crew.cutoffRisk" : "crew.cutoffMargin", { margin: fmtDuration(Math.abs(pt.cutoffMarginMinutes)) })
          )}</span>`) : ""}
          ${pt.stopMinutes > 0 ? row(P("crew.stop"), esc(P("crew.stopValue", {
            minutes: pt.stopMinutes,
            sleepPart: pt.sleepMinutes > 0 ? P("crew.sleepPart", { minutes: pt.sleepMinutes }) : "",
          }))) : ""}
          ${pt.departClock ? row(P("crew.depart"), `${esc(pt.departClock)}${outLeg ? ` <span class="muted">${esc(P("crew.nextLeg", {
            km: Math.round((outLeg.toKm - outLeg.fromKm) * 10) / 10,
            duration: fmtDuration(outLeg.minutes),
            toName: outLeg.toName,
          }))}${outLeg.inDarkness ? ` · ${esc(P("crew.dark"))}` : ""}</span>` : ""}`) : ""}
          ${handover.length ? row(P("crew.handOver"), `<ul class="handover">${handover.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`) : ""}
          ${carryLeg ? row(P("crew.carrying"), esc(P("crew.carryingValue", {
            carbsG: carryLeg.carbsG,
            fluidsMl: carryLeg.fluidsMl,
          }))) : ""}
          ${bag?.notes ? row(P("crew.notes"), esc(bag.notes), "notes") : ""}
        </div>
      </div>`;
  }).join("");

  const noStations = relevant.length === 0
    ? `<p class="lede">${esc(P("crew.noStations"))}</p>`
    : "";

  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P("crew.title", { course: course.name }))}</title>
<style>${PRINT_CSS}${CREW_CSS}</style>
</head>
<body>
  <div class="sub">${esc(P("crew.eyebrow"))}${raceDate ? ` · ${esc(raceDate)}` : ""}</div>
  <h1>${esc(course.name)}</h1>
  <div class="sub">
    ${esc(course.distanceKm)} km · ${esc(P("crew.targetLine", { target: targetClock }))}${schedule ? ` · ${esc(P("crew.startLine", { start: schedule.startClock }))}` : ""}
  </div>

  <p class="lede">${esc(P("crew.lede"))}</p>

  ${schedule ? `
    <h2>${esc(P("crew.overview"))}</h2>
    <table>
      <thead><tr>
        <th>${esc(P("view.schedule.colPoint"))}</th>
        <th>${esc(P("view.schedule.colKm"))}</th>
        <th>${esc(P("view.schedule.colArrive"))}</th>
        <th>${esc(P("crew.colCrew"))}</th>
        <th>${esc(P("crew.colBag"))}</th>
        <th>${esc(P("view.schedule.colCutoff"))}</th>
      </tr></thead>
      <tbody>${overviewRows}</tbody>
    </table>` : ""}

  <h2>${esc(P("crew.stations"))}</h2>
  ${noStations}
  ${stationBlocks}
</body>
</html>`;
}

export function printCrewSheet(plan, t) {
  printDocument(buildCrewHtml(plan, t, activeLocale()));
}
