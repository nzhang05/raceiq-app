import { useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, COMPARE_COLORS } from "../constants.js";
import { fmtDate, shortDate } from "../utils/time.js";
import { parseClockToMinutes } from "../utils/time.js";
import { verdictColor, verdictLabel } from "../utils/ratings.js";
import { heatPenalty, heatAdjustedTime } from "../utils/weather.js";
import PaceCompareStrip from "./PaceCompareStrip.jsx";

export default function CompareView({ races, onBack, onOpenDebrief, onAskCoach }) {
  const sorted = useMemo(
    () => [...races].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [races]
  );

  const distMin = Math.min(...sorted.map((r) => r.distanceKm));
  const distMax = Math.max(...sorted.map((r) => r.distanceKm));
  const distancesMismatched = (distMax - distMin) / distMin > 0.15;

  const refRace = sorted[0];
  const colCount = sorted.length;
  const hasDelta = colCount >= 2;
  const tableCols = `160px ${sorted.map(() => "1fr").join(" ")}${hasDelta ? " 100px" : ""}`;

  function timeDeltaDisplay(aTime, bTime) {
    const diff = parseClockToMinutes(bTime) - parseClockToMinutes(aTime);
    const sign = diff < 0 ? "−" : "+";
    const abs = Math.abs(diff);
    const m = Math.floor(abs);
    const s = Math.round((abs - m) * 60);
    return { label: `${sign}${m}:${String(s).padStart(2, "0")}`, color: diff < 0 ? T.green : T.ember };
  }

  function numDelta(a, b, higherIsBetter = true) {
    const d = b - a;
    if (d === 0) return { label: "—", color: T.inkDim };
    const good = higherIsBetter ? d > 0 : d < 0;
    const label = `${d > 0 ? "+" : ""}${Number.isInteger(d) ? d : d.toFixed(1)}`;
    return { label, color: good ? T.green : T.ember };
  }

  function pacingDrift(race) {
    const splits = race.splits;
    if (splits.length < 2) return null;
    const key = race.usesGap ? "gapPace" : "pace";
    return ((splits[splits.length - 1][key] - splits[0][key]) / splits[0][key] * 100);
  }

  const narrative = useMemo(() => {
    if (sorted.length < 2) return "";
    const a = sorted[0], b = sorted[sorted.length - 1];
    const pctDelta = b.percentile - a.percentile;
    const condDiff = b.tempC < a.tempC - 3 ? "cooler" : b.tempC > a.tempC + 3 ? "warmer" : "similar";
    const pctStr = `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}`;
    const driftA = pacingDrift(a);
    const driftB = pacingDrift(b);
    const parts = [];
    parts.push(`${b.name} (${shortDate(b.date)}) produced a ${pctStr} percentile ${pctDelta >= 0 ? "improvement" : "drop"} over ${a.name} (${shortDate(a.date)}), racing in ${condDiff} conditions (${a.tempC}°C → ${b.tempC}°C).`);
    if (driftA != null && driftB != null) {
      const driftBetter = driftB < driftA;
      parts.push(`Pace drift moved from ${driftA.toFixed(1)}% to ${driftB.toFixed(1)}% — ${driftBetter ? "tighter pacing discipline in the later race" : "more fade in the later race; pacing strategy is the clearest lever to pull"}.`);
    }
    const fuelDelta = b.fueling.carbsPerHr - a.fueling.carbsPerHr;
    if (Math.abs(fuelDelta) >= 10) {
      parts.push(`Fueling shifted by ${fuelDelta > 0 ? "+" : ""}${fuelDelta}g/hr carbohydrate — ${fuelDelta > 0 ? "higher intake in the later race likely supported the closing pace" : "lower intake in the later race; worth watching if late-race fade appears again"}.`);
    }
    const heatDiff = heatPenalty(a.tempC) - heatPenalty(b.tempC);
    if (heatDiff > 0.04) {
      parts.push(`Conditions explain part of the gap: the heat model estimates ${(heatDiff * 100).toFixed(0)}% of the time difference is attributable to ${shortDate(a.date)}'s warmer conditions, not fitness.`);
    }
    return parts.join(" ");
  }, [sorted]);

  const statRows = useMemo(() => {
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return [
      { label: "FINISH TIME", values: sorted.map((r) => r.finishTime), delta: hasDelta ? timeDeltaDisplay(first.finishTime, last.finishTime) : null },
      { label: "PERCENTILE", values: sorted.map((r) => `${r.percentile}th`), delta: hasDelta ? numDelta(first.percentile, last.percentile, true) : null },
      { label: "PLACEMENT", values: sorted.map((r) => `${r.placement}/${r.field}`), delta: null },
      { label: "RACEIQ SCORE", values: sorted.map((r) => r.rating), delta: hasDelta ? numDelta(first.rating, last.rating, true) : null },
      { label: "TEMP / HUMIDITY", values: sorted.map((r) => `${r.tempC}°C / ${r.humidity}%`), delta: null },
      { label: "VERDICT", values: sorted.map((r) => verdictLabel(r.verdict)), valueColors: sorted.map((r) => verdictColor(r.verdict)), delta: null },
    ];
  }, [sorted, hasDelta]);

  const fuelRows = [
    { label: "CARBS", key: "carbsPerHr", unit: "g/hr" },
    { label: "SODIUM", key: "sodiumPerHr", unit: "mg/hr" },
    { label: "FLUIDS", key: "fluidsPerHr", unit: "ml/hr" },
    { label: "CAFFEINE", key: "caffeine", unit: "mg" },
  ];

  const condRows = [
    { label: "TEMP", values: sorted.map((r) => `${r.tempC}°C`) },
    { label: "HUMIDITY", values: sorted.map((r) => `${r.humidity}%`) },
    { label: "WIND", values: sorted.map((r) => `${r.wind} km/h`) },
    { label: "EST. ADJ. TIME", values: sorted.map((r) => heatAdjustedTime(r.finishTime, r.tempC, refRace.tempC)), note: true },
  ];

  const labelCellStyle = { padding: "12px 16px 12px 0", fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.6, color: T.inkDim, borderRight: `1px solid ${T.line}` };
  const headerCellStyle = { padding: "10px 16px 10px 0", fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5 };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, marginBottom: 28 }}>
        ← BACK TO RACE RESUME
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>RACE COMPARISON</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 6px", color: T.paper, maxWidth: 780 }}>
        {sorted.map((r) => r.name).join(" vs. ")}
      </h1>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim, marginBottom: 28 }}>
        {sorted[0].sport} · {distMin === distMax ? `${distMin} km` : `${distMin}–${distMax} km`}
      </div>

      {distancesMismatched && (
        <div style={{ marginBottom: 24, padding: "10px 16px", background: "rgba(255,106,57,0.08)", border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          These races differ in distance by more than 15%. Finish times aren't directly comparable — the pace chart uses % of total distance on the X axis.
        </div>
      )}

      <div style={{ marginBottom: 44 }}>
        <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ ...headerCellStyle, color: T.inkDim }} />
          {sorted.map((r, i) => (
            <div key={r.id} style={{ ...headerCellStyle, color: COMPARE_COLORS[i] }}>
              <div>{r.name.toUpperCase()}</div>
              <div style={{ color: T.inkDim, fontSize: 9, marginTop: 2 }}>{fmtDate(r.date)}</div>
            </div>
          ))}
          {hasDelta && <div style={{ ...headerCellStyle, color: T.inkDim }}>Δ {shortDate(sorted[sorted.length - 1].date)} vs {shortDate(sorted[0].date)}</div>}
        </div>
        {statRows.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={labelCellStyle}>{row.label}</div>
            {sorted.map((r, i) => (
              <div key={r.id} style={{ padding: "14px 16px 14px 0", fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: row.valueColors ? row.valueColors[i] : COMPARE_COLORS[i] }}>
                {row.values[i]}
              </div>
            ))}
            {hasDelta && (
              <div style={{ padding: "14px 0", fontFamily: FONT_MONO, fontSize: 12, color: row.delta ? row.delta.color : T.inkDim, alignSelf: "center" }}>
                {row.delta ? row.delta.label : "—"}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>Pace overlay</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          {distancesMismatched
            ? "X axis shows % of total distance since races differ in length. Hover to compare effort at equivalent points in the race."
            : "Direct split overlay. Hover to compare pace at each checkpoint."}
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 12px 8px" }}>
          <PaceCompareStrip races={sorted} />
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>Conditions context</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          Est. adj. time shows what each finish time would have been in {refRace.name}'s conditions ({refRace.tempC}°C), using a 2%/°C heat penalty model above 20°C — isolating fitness from weather.
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>{shortDate(r.date)}</div>
            ))}
            {hasDelta && <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }}>Δ</div>}
          </div>
          {condRows.map((row, ri) => {
            const first = row.values[0];
            const last = row.values[row.values.length - 1];
            const isLast = ri === condRows.length - 1;
            return (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: isLast ? "none" : `1px solid ${T.line}` }}>
                <div style={{ ...labelCellStyle, padding: "12px 16px" }}>
                  {row.label}
                  {row.note && <div style={{ fontSize: 8.5, color: T.inkDim, opacity: 0.7, marginTop: 2 }}>normalized to {shortDate(refRace.date)} conditions</div>}
                </div>
                {sorted.map((r, i) => (
                  <div key={r.id} style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 13, color: row.note ? COMPARE_COLORS[i] : T.paper }}>{row.values[i]}</div>
                ))}
                {hasDelta && (
                  <div style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim }}>
                    {row.note ? timeDeltaDisplay(first, last).label : "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 16 }}>Fueling comparison</div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>{shortDate(r.date)}</div>
            ))}
            {hasDelta && <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }}>Δ</div>}
          </div>
          {fuelRows.map((row, ri) => {
            const vals = sorted.map((r) => r.fueling[row.key]);
            const delta = hasDelta ? vals[vals.length - 1] - vals[0] : 0;
            const deltaColor = delta > 0 ? T.green : delta < 0 ? T.ember : T.inkDim;
            const isLast = ri === fuelRows.length - 1;
            return (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: isLast ? "none" : `1px solid ${T.line}` }}>
                <div style={{ ...labelCellStyle, padding: "12px 16px" }}>{row.label}</div>
                {sorted.map((r, i) => (
                  <div key={r.id} style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 13, color: COMPARE_COLORS[i] }}>
                    {r.fueling[row.key]} {row.unit}
                  </div>
                ))}
                {hasDelta && (
                  <div style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 12, color: delta !== 0 ? deltaColor : T.inkDim }}>
                    {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta} ${row.unit}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 44, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1, color: T.brass, marginBottom: 10 }}>RACEIQ ANALYSIS</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.65, color: T.ink }}>{narrative}</div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 8 }}>
        <button onClick={onAskCoach} style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: `1px solid ${T.brass}`, background: "rgba(201,162,75,0.1)", color: T.brass, cursor: "pointer" }}>
          ASK RACEIQ ABOUT THIS COMPARISON
        </button>
        {sorted.map((r, i) => (
          <button key={r.id} onClick={() => onOpenDebrief(r.id)} style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: COMPARE_COLORS[i], cursor: "pointer" }}>
            {shortDate(r.date)} DEBRIEF →
          </button>
        ))}
      </div>
    </div>
  );
}
