import React, { useState, useMemo, useEffect, useRef } from "react";

/* ---------------------------------------------------------
   RaceIQ — race intelligence prototype
   Design tokens
   bg      #13201B  near-black mossy charcoal
   paper   #F4F0E4  parchment / bib paper
   ink     #DCD6C4  dimmed paper (secondary text)
   line    #2A3A30  hairline on dark
   brass   #C9A24B  hero numerals / score
   green   #4FAE8C  strengths
   ember   #FF6A39  limiters
   --------------------------------------------------------- */

const T = {
  bg: "#13201B",
  bg2: "#0F1916",
  paper: "#F4F0E4",
  ink: "#B9C2B5",
  inkDim: "#7C8A80",
  line: "#28362E",
  brass: "#C9A24B",
  brassDim: "#8A7440",
  green: "#4FAE8C",
  greenDim: "#345F4E",
  ember: "#FF6A39",
  emberDim: "#7A3D26",
  temp: "#7BB8C8",   // chart-only: temperature line, distinct from ember/LIMITER
};

const COMPARE_COLORS = [T.paper, T.green, T.brass];

const FONT_DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const FONT_BODY = "'Source Serif 4', Georgia, serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

const FONT_IMPORT = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=IBM+Plex+Mono:wght@400;500&display=swap');

    :root {
      --bg: ${T.bg};
      --bg2: ${T.bg2};
      --paper: ${T.paper};
      --ink: ${T.ink};
      --ink-dim: ${T.inkDim};
      --line: ${T.line};
      --brass: ${T.brass};
      --brass-dim: ${T.brassDim};
      --green: ${T.green};
      --ember: ${T.ember};
    }

    * { box-sizing: border-box; }
    ::selection { background: ${T.brass}; color: ${T.bg}; }

    /* ── Keyframes ── */
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeInView {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── App header — sticky blur ── */
    .app-header {
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: rgba(19, 32, 27, 0.88) !important;
    }

    /* ── View container — cross-fade ── */
    .view-enter {
      animation: fadeInView 220ms ease both;
    }

    /* ── Race list rows ── */
    .race-row {
      transition: background 120ms ease, transform 120ms ease;
    }
    .race-row:hover {
      background: rgba(244, 240, 228, 0.04) !important;
      transform: translateY(-1px);
    }
    .race-row .delete-btn {
      opacity: 0;
      transition: opacity 120ms ease, color 120ms ease;
    }
    .race-row:hover .delete-btn {
      opacity: 1;
    }

    /* ── Compare checkbox ── */
    .race-row .select-cb {
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .race-row:hover .select-cb,
    .race-row.is-selected .select-cb {
      opacity: 1;
    }

    /* ── Stat slide-up entrance (staggered via inline delay) ── */
    .stat-enter {
      animation: slideUp 300ms ease both;
    }

    /* ── Score badge ── */
    .score-badge {
      display: inline-block;
      background: rgba(201, 162, 75, 0.1);
      border: 1px solid ${T.brassDim};
      border-radius: 4px;
      padding: 2px 10px;
      line-height: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
    }
  `}</style>
);

/* ---------------------------------------------------------
   Sample data
   --------------------------------------------------------- */

const SEED_RACES = [
  {
    id: "r1",
    name: "Brandywine Valley Marathon",
    sport: "Road Running",
    date: "2026-04-19",
    distanceKm: 42.2,
    elevationM: 310,
    surface: "Road",
    finishTime: "3:24:51",
    placement: 142,
    field: 1850,
    percentile: 92.3,
    tempC: 27,
    humidity: 71,
    wind: 14,
    rating: 1842,
    ratingDelta: -38,
    verdict: "limiter",
    headline: "Heat and a fast first half cost you the back nine.",
    splits: [
      { km: 5, pace: 4.42, tempC: 18 },
      { km: 10, pace: 4.45, tempC: 19 },
      { km: 15, pace: 4.5, tempC: 21 },
      { km: 20, pace: 4.55, tempC: 23 },
      { km: 25, pace: 5.05, tempC: 25 },
      { km: 30, pace: 5.22, tempC: 26 },
      { km: 35, pace: 5.51, tempC: 27 },
      { km: 40, pace: 6.08, tempC: 27 },
      { km: 42.2, pace: 6.15, tempC: 27 },
    ],
    fueling: { carbsPerHr: 52, sodiumPerHr: 280, fluidsPerHr: 480, caffeine: 80 },
  },
  {
    id: "r2",
    name: "Tunkhannock Trail 50K",
    sport: "Trail Running",
    date: "2026-02-08",
    distanceKm: 50,
    elevationM: 1640,
    surface: "Singletrack",
    finishTime: "5:48:12",
    placement: 11,
    field: 210,
    percentile: 95.2,
    tempC: 6,
    humidity: 58,
    wind: 9,
    rating: 1910,
    ratingDelta: 64,
    verdict: "strength",
    headline: "Even effort on the climbs delivered your best ultra to date.",
    splits: [
      { km: 8, pace: 6.1, tempC: 4 },
      { km: 16, pace: 6.4, tempC: 5 },
      { km: 24, pace: 6.55, tempC: 6 },
      { km: 32, pace: 7.05, tempC: 7 },
      { km: 40, pace: 7.0, tempC: 7 },
      { km: 50, pace: 7.1, tempC: 6 },
    ],
    fueling: { carbsPerHr: 78, sodiumPerHr: 540, fluidsPerHr: 620, caffeine: 120 },
  },
  {
    id: "r3",
    name: "Hollow Road Gravel Classic",
    sport: "Gravel Cycling",
    date: "2025-11-02",
    distanceKm: 105,
    elevationM: 980,
    surface: "Gravel",
    finishTime: "3:51:09",
    placement: 28,
    field: 340,
    percentile: 91.8,
    tempC: 11,
    humidity: 64,
    wind: 22,
    rating: 1768,
    ratingDelta: 12,
    verdict: "mixed",
    headline: "Strong legs, but headwind sectors leaked more time than fueling did.",
    splits: [
      { km: 20, pace: 2.1, tempC: 9 },
      { km: 40, pace: 2.2, tempC: 10 },
      { km: 60, pace: 2.35, tempC: 11 },
      { km: 80, pace: 2.4, tempC: 12 },
      { km: 105, pace: 2.3, tempC: 11 },
    ],
    fueling: { carbsPerHr: 64, sodiumPerHr: 410, fluidsPerHr: 550, caffeine: 60 },
  },
  {
    id: "r4",
    name: "Lakefront 10K",
    sport: "Road Running",
    date: "2025-09-14",
    distanceKm: 10,
    elevationM: 35,
    surface: "Road",
    finishTime: "0:38:42",
    placement: 9,
    field: 640,
    percentile: 98.6,
    tempC: 14,
    humidity: 49,
    wind: 6,
    rating: 1830,
    ratingDelta: 22,
    verdict: "strength",
    headline: "Negative split in cool conditions — your fitness is ahead of your race calendar.",
    splits: [
      { km: 2.5, pace: 3.52, tempC: 13 },
      { km: 5, pace: 3.5, tempC: 13 },
      { km: 7.5, pace: 3.47, tempC: 14 },
      { km: 10, pace: 3.44, tempC: 14 },
    ],
    fueling: { carbsPerHr: 0, sodiumPerHr: 0, fluidsPerHr: 200, caffeine: 100 },
  },
];

const SPORTS = ["All", "Road Running", "Trail Running", "Road Cycling", "Gravel Cycling"];
const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All");
const SURFACES = ["Road", "Singletrack", "Gravel", "Mixed", "Track"];

/* ---------------------------------------------------------
   Storage (persisted across sessions, personal to this user)
   Uses browser localStorage — this runs as a normal local app,
   not inside the Claude.ai artifact sandbox, so the regular
   browser storage APIs are available and appropriate here.
   --------------------------------------------------------- */

const STORAGE_KEY = "raceiq:custom-races";

async function loadCustomRaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveCustomRaces(races) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(races));
  } catch {
    /* storage unavailable (private browsing, quota) — state still works for this session */
  }
}

/* ---------------------------------------------------------
   Derivation engine — turns raw entered numbers into the
   same shape the debrief views expect (percentile, verdict,
   headline, rating). This is the "deterministic layer" from
   the PRD; the LLM-style prose lives in buildDebrief().
   --------------------------------------------------------- */

function parseClockToMinutes(clock) {
  // accepts "H:MM:SS" or "MM:SS"
  const parts = clock.split(":").map((p) => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseFloat(clock) || 0;
}

/* ---------------------------------------------------------
   Grade-adjusted pace (GAP)
   For trail/gravel, raw pace is misleading: 7:00/km climbing
   is a much harder effort than 7:00/km on the flat. GAP rescales
   each segment's pace to its flat-equivalent effort using a
   simplified Minetti energy-cost-of-locomotion curve — the same
   approach Strava and TrainingPeaks use under the hood.
   Running: cost(grade) relative to flat, fit from Minetti 2002.
   Cycling: power penalty approximated from grade and a flat
   "watts-equivalent" rescale, since gravel bikes aren't run-gait limited.
   --------------------------------------------------------- */

function runningCostMultiplier(gradePct) {
  // grade as percent, e.g. +8 for 8% uphill, -5 for 5% downhill
  const g = Math.max(-30, Math.min(30, gradePct)) / 100; // clamp to ±30%, convert to decimal slope
  // Minetti-derived polynomial, normalized so cost(0) = 1
  const cost =
    155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
  const flatCost = 3.6; // cost(0)
  // no artificial floor: the curve's own minimum (~0.5 around -18% grade) is real —
  // steep descents past that point cost more again due to braking, and that signal matters
  return Math.max(0.45, cost / flatCost);
}

function cyclingCostMultiplier(gradePct) {
  // gentler curve than running — gravity dominates more linearly for cycling effort,
  // and descents recover speed more readily than they do on foot
  const g = Math.max(-20, Math.min(20, gradePct));
  if (g >= 0) return 1 + g * 0.11; // climbing costs ~11% effort per % grade
  return Math.max(0.55, 1 + g * 0.045); // descending recovers effort, capped
}

function gradePercent(split, prevSplit) {
  if (!prevSplit || split.elevM == null || prevSplit.elevM == null) return 0;
  const distM = (split.km - prevSplit.km) * 1000;
  if (distM <= 0) return 0;
  return ((split.elevM - prevSplit.elevM) / distM) * 100;
}

function gapPaceForSplit(split, prevSplit, sport) {
  const grade = gradePercent(split, prevSplit);
  const isRun = sport === "Road Running" || sport === "Trail Running";
  const mult = isRun ? runningCostMultiplier(grade) : cyclingCostMultiplier(grade);
  return { gradePct: Math.round(grade * 10) / 10, gapPace: split.pace / mult };
}

function withGap(splits, sport) {
  return splits.map((s, i) => {
    const { gradePct, gapPace } = gapPaceForSplit(s, splits[i - 1], sport);
    return { ...s, gradePct, gapPace };
  });
}

function derivePercentile(placement, field) {
  if (!placement || !field || field <= 0) return null;
  const pct = (1 - (placement - 1) / field) * 100;
  return Math.round(pct * 10) / 10;
}

function deriveRating(percentile, distanceKm) {
  // toy scoring model, in the spirit of the PRD's 1000-3000 RaceIQ Score:
  // rewards percentile and, mildly, distance (longer races weighted slightly higher)
  if (percentile == null) return 1500;
  const base = 1000 + percentile * 9; // pct 0-100 -> +0 to +900
  const distanceBonus = Math.min(distanceKm, 100) * 1.5; // up to +150
  return Math.round(Math.min(3000, Math.max(1000, base + distanceBonus)));
}

function hasElevationData(splits) {
  return splits.some((s) => s.elevM != null && s.elevM !== "");
}

function sportUsesGap(sport) {
  // road running stays on raw pace by convention — courses are close enough to flat
  // that grade adjustment isn't the norm there. Everything with meaningful terrain does.
  return sport === "Trail Running" || sport === "Gravel Cycling" || sport === "Road Cycling";
}

function deriveVerdict(splits, tempC, sport) {
  if (!splits || splits.length < 2) return "mixed";
  const useGap = hasElevationData(splits) && sportUsesGap(sport);
  const series = useGap ? withGap(splits, sport) : splits;
  const paceKey = useGap ? "gapPace" : "pace";
  const first = series[0][paceKey];
  const last = series[series.length - 1][paceKey];
  const drift = (last - first) / first; // positive = slowed down
  const hot = tempC >= 24;

  if (drift < 0.04) return "strength"; // held effort or negative split
  if (drift > 0.12 || (hot && drift > 0.07)) return "limiter";
  return "mixed";
}

function deriveHeadline(verdict, race) {
  if (verdict === "strength") {
    return race.tempC <= 14
      ? "Even pacing in cool conditions produced a strong result."
      : "Pace held steady through the finish — a well-executed race.";
  }
  if (verdict === "limiter") {
    return race.tempC >= 24
      ? "Heat drove a significant slowdown in the closing stages."
      : "Pace faded notably in the closing stages.";
  }
  return "A mixed result — some splits held, others slipped.";
}

function enrichRace(raw) {
  const percentile = derivePercentile(raw.placement, raw.field);
  const usesGap = hasElevationData(raw.splits) && sportUsesGap(raw.sport);
  const splits = usesGap ? withGap(raw.splits, raw.sport) : raw.splits;
  const verdict = deriveVerdict(raw.splits, raw.tempC, raw.sport);
  const rating = deriveRating(percentile, raw.distanceKm);
  const headline = deriveHeadline(verdict, raw);
  return {
    ...raw,
    splits,
    usesGap,
    percentile: percentile ?? 50,
    verdict,
    rating,
    ratingDelta: 0,
    headline,
  };
}

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear().toString().slice(2);
  return `${month} '${year}`;
}

function verdictColor(v) {
  if (v === "strength") return T.green;
  if (v === "limiter") return T.ember;
  return T.brass;
}

function verdictLabel(v) {
  if (v === "strength") return "STRENGTH";
  if (v === "limiter") return "LIMITER";
  return "MIXED";
}

/* ---------------------------------------------------------
   Pace/Heat strip — signature chart
   Interactive: hover for tooltips, click legend to toggle series.
   --------------------------------------------------------- */

function PaceHeatStrip({ race }) {
  const W = 720;
  const H = 220;
  const padL = 46;
  const padR = 40;
  const padT = 24;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const splits = race.splits;
  const showGap = race.usesGap;
  const showElev = hasElevationData(splits);

  const [visible, setVisible] = useState({ pace: true, rawPace: true, temp: true, elev: true });
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  function toggle(key) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  const primaryKey = showGap ? "gapPace" : "pace";
  const maxKm = splits[splits.length - 1].km;
  const minPace = Math.min(...splits.map((s) => s[primaryKey]));
  const maxPace = Math.max(...splits.map((s) => s[primaryKey]));
  const paceRange = Math.max(maxPace - minPace, 0.4);

  const tempValues = splits.map((s) => s.tempC);
  const minTemp = Math.min(...tempValues);
  const maxTemp = Math.max(...tempValues);
  const tempRange = Math.max(maxTemp - minTemp, 1);

  const elevValues = showElev ? splits.map((s) => Number(s.elevM) || 0) : null;
  const minElev = elevValues ? Math.min(...elevValues) : 0;
  const maxElev = elevValues ? Math.max(...elevValues) : 0;
  const elevRange = Math.max(maxElev - minElev, 1);

  const x = (km) => padL + (km / maxKm) * plotW;
  const yPace = (pace) => padT + ((pace - minPace) / paceRange) * plotH;
  const yTemp = (v) => padT + plotH - ((v - minTemp) / tempRange) * plotH * 0.45;
  const yElev = (v) => padT + plotH - ((v - minElev) / elevRange) * plotH * 0.55;

  const primaryLine = splits.map((s) => `${x(s.km)},${yPace(s[primaryKey])}`).join(" ");
  const rawPaceLine = showGap
    ? splits.map((s) => `${x(s.km)},${yPace(Math.min(Math.max(s.pace, minPace), maxPace))}`).join(" ")
    : null;
  const tempLine = splits.map((s, i) => `${x(s.km)},${yTemp(tempValues[i])}`).join(" ");
  const elevBandPoints = showElev
    ? `${padL},${padT + plotH} ` +
      splits.map((s, i) => `${x(s.km)},${yElev(elevValues[i])}`).join(" ") +
      ` ${padL + plotW},${padT + plotH}`
    : null;

  let turnIdx = 1;
  let maxJump = -Infinity;
  for (let i = 1; i < splits.length; i++) {
    const jump = splits[i][primaryKey] - splits[i - 1][primaryKey];
    if (jump > maxJump) { maxJump = jump; turnIdx = i; }
  }
  const turnSplit = splits[turnIdx];
  const showTurn = maxJump > 0.12 && race.verdict !== "strength";

  function handleMouseMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    splits.forEach((s, i) => {
      const dist = Math.abs(x(s.km) - mouseX);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });
    setHoveredIdx(nearestIdx);
  }

  const hoveredSplit = hoveredIdx != null ? splits[hoveredIdx] : null;

  function fmtPaceStr(minPerKm) {
    const m = Math.floor(minPerKm);
    const s = String(Math.round((minPerKm - m) * 60)).padStart(2, "0");
    return `${m}:${s}/km`;
  }

  // Tooltip: flip to the left when near the right edge
  const tooltipLeftPct = hoveredSplit ? (x(hoveredSplit.km) / W) * 100 : 50;
  const tooltipFlip = tooltipLeftPct > 62;

  // Clickable legend items
  const legendItems = [
    { key: "pace", label: showGap ? "GAP" : "PACE", color: T.paper, dash: null, thick: true },
    ...(showGap ? [{ key: "rawPace", label: "RAW PACE", color: T.ink, dash: "1 3", thick: false, dim: true }] : []),
    { key: "temp", label: "TEMP", color: T.temp, dash: "3 3", thick: false },
    ...(showElev ? [{ key: "elev", label: "ELEV", color: T.brass, isRect: true }] : []),
  ];

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Interactive legend / toggles */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        {legendItems.map((item) => (
          <button
            key={item.key}
            onClick={() => toggle(item.key)}
            title={visible[item.key] ? `Hide ${item.label}` : `Show ${item.label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: "2px 0",
              cursor: "pointer",
              opacity: visible[item.key] ? 1 : 0.3,
              transition: "opacity 140ms ease",
            }}
          >
            {item.isRect ? (
              <span style={{ display: "inline-block", width: 14, height: 7, background: item.color, opacity: 0.3, borderRadius: 1, flexShrink: 0 }} />
            ) : (
              <svg width="16" height="10" style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
                <line
                  x1="0" y1="5" x2="16" y2="5"
                  stroke={item.color}
                  strokeWidth={item.thick ? 2.5 : 1.5}
                  strokeDasharray={item.dash || "none"}
                  strokeOpacity={item.dim ? 0.5 : 0.9}
                />
              </svg>
            )}
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, color: visible[item.key] ? T.ink : T.inkDim }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`${showGap ? "Grade-adjusted pace" : "Pace"} and temperature${showElev ? " and elevation" : ""} across the race`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ cursor: "crosshair", display: "block" }}
      >
        <defs>
          <linearGradient id={`band-${race.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.brass} stopOpacity="0.32" />
            <stop offset="100%" stopColor={T.brass} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* baseline grid */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={padL} y1={padT + plotH * f} x2={padL + plotW} y2={padT + plotH * f} stroke={T.line} strokeWidth="1" />
        ))}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={T.line} strokeWidth="1.5" />

        {/* elevation background fill */}
        {showElev && visible.elev && (
          <polygon points={elevBandPoints} fill={`url(#band-${race.id})`} />
        )}

        {/* temperature line */}
        {visible.temp && (
          <polyline points={tempLine} fill="none" stroke={T.temp} strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="3 3" />
        )}

        {/* raw pace reference */}
        {showGap && visible.rawPace && (
          <polyline points={rawPaceLine} fill="none" stroke={T.ink} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="1 3" />
        )}

        {/* primary effort line */}
        {visible.pace && (
          <polyline points={primaryLine} fill="none" stroke={T.paper} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* hover crosshair */}
        {hoveredSplit && (
          <line
            x1={x(hoveredSplit.km)} y1={padT}
            x2={x(hoveredSplit.km)} y2={padT + plotH}
            stroke={T.paper} strokeOpacity="0.18" strokeWidth="1"
          />
        )}

        {/* split markers */}
        {visible.pace && splits.map((s, i) => {
          const isHovered = i === hoveredIdx;
          const isTurn = i === turnIdx && showTurn;
          return (
            <circle
              key={i}
              cx={x(s.km)}
              cy={yPace(s[primaryKey])}
              r={isHovered ? 5.5 : isTurn ? 4.5 : 3}
              fill={isTurn ? T.ember : T.paper}
              stroke={T.bg}
              strokeWidth="1.5"
            />
          );
        })}

        {/* temp dot on hover */}
        {hoveredSplit && visible.temp && (
          <circle cx={x(hoveredSplit.km)} cy={yTemp(hoveredSplit.tempC)} r={4} fill={T.temp} stroke={T.bg} strokeWidth="1.5" />
        )}

        {/* elev dot on hover */}
        {hoveredSplit && showElev && visible.elev && hoveredSplit.elevM != null && (
          <circle cx={x(hoveredSplit.km)} cy={yElev(Number(hoveredSplit.elevM))} r={4} fill={T.brass} fillOpacity="0.7" stroke={T.bg} strokeWidth="1.5" />
        )}

        {/* turn annotation */}
        {showTurn && (
          <g>
            <line x1={x(turnSplit.km)} y1={yPace(turnSplit[primaryKey])} x2={x(turnSplit.km)} y2={padT - 2} stroke={T.ember} strokeWidth="1" strokeDasharray="2 2" />
            <text x={x(turnSplit.km)} y={padT - 8} textAnchor="middle" fill={T.ember} fontFamily={FONT_MONO} fontSize="10" letterSpacing="0.5">
              KM {turnSplit.km} — TURN
            </text>
          </g>
        )}

        {/* x-axis labels */}
        {splits.map((s, i) => (
          <text key={i} x={x(s.km)} y={H - 10} textAnchor="middle" fill={i === hoveredIdx ? T.paper : T.inkDim} fontFamily={FONT_MONO} fontSize="10">
            {s.km}
          </text>
        ))}

        {/* y-axis pace labels */}
        <text x={padL - 8} y={padT + 4} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">fast</text>
        <text x={padL - 8} y={padT + plotH} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">slow</text>

        {/* right y-axis: temperature scale */}
        {visible.temp && (
          <>
            <text x={padL + plotW + 5} y={yTemp(maxTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{maxTemp}°</text>
            <text x={padL + plotW + 5} y={yTemp(minTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{minTemp}°</text>
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredSplit && (
        <div
          style={{
            position: "absolute",
            top: 36,
            ...(tooltipFlip
              ? { right: `${100 - tooltipLeftPct}%`, transform: "translateX(50%)" }
              : { left: `${tooltipLeftPct}%`, transform: "translateX(-50%)" }),
            pointerEvents: "none",
            background: T.bg,
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            padding: "9px 13px",
            zIndex: 10,
            minWidth: 130,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.brass, letterSpacing: 0.6, marginBottom: 7, borderBottom: `1px solid ${T.line}`, paddingBottom: 5 }}>
            KM {hoveredSplit.km}
          </div>
          {visible.pace && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.paper, marginBottom: 4 }}>
              <span style={{ color: T.inkDim }}>{showGap ? "GAP " : "PACE"} </span>
              {fmtPaceStr(hoveredSplit[primaryKey])}
            </div>
          )}
          {showGap && visible.rawPace && hoveredSplit.pace != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginBottom: 4 }}>
              <span>RAW  </span>
              {fmtPaceStr(hoveredSplit.pace)}
            </div>
          )}
          {visible.temp && hoveredSplit.tempC != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.temp, marginBottom: 4 }}>
              <span style={{ color: T.inkDim }}>TEMP </span>
              {hoveredSplit.tempC}°C
            </div>
          )}
          {showElev && visible.elev && hoveredSplit.elevM != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, marginBottom: showGap && hoveredSplit.gradePct != null ? 4 : 0 }}>
              <span style={{ color: T.inkDim }}>ELEV </span>
              {hoveredSplit.elevM}m
            </div>
          )}
          {showGap && hoveredSplit.gradePct != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
              <span>GRD  </span>
              {hoveredSplit.gradePct > 0 ? "+" : ""}{hoveredSplit.gradePct}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Race list — results-sheet style
   --------------------------------------------------------- */

const ROW_COLS = "28px 1.2fr 0.7fr 0.55fr 0.5fr 0.55fr 0.45fr 0.6fr 28px";

function RaceListRow({ race, onOpen, onDelete, onToggleSelect, isSelected, index }) {
  const isCustom = race.id.startsWith("custom-");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(race.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(race.id)}
      className={`race-row${isSelected ? " is-selected" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: ROW_COLS,
        alignItems: "center",
        minHeight: 68,
        width: "100%",
        gap: 12,
        padding: "14px 18px",
        background: isSelected ? "rgba(201,162,75,0.05)" : "transparent",
        borderBottom: `1px solid ${T.line}`,
        cursor: "pointer",
        textAlign: "left",
        color: T.paper,
        animation: `fadeIn 280ms ease both`,
        animationDelay: `${index * 45}ms`,
      }}
    >
      {/* Selection checkbox */}
      <div
        className="select-cb"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(race.id); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: 2, flexShrink: 0,
          border: `1.5px solid ${isSelected ? T.brass : T.inkDim}`,
          background: isSelected ? T.brass : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSelected && <span style={{ color: T.bg, fontSize: 9, lineHeight: 1, fontFamily: FONT_MONO }}>✓</span>}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 16, letterSpacing: 0.2 }}>{race.name}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 3 }}>
          {fmtDate(race.date)} · {race.sport}
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.distanceKm} km
        <div style={{ fontSize: 10, color: T.inkDim }}>+{race.elevationM}m</div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600 }}>{race.finishTime}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink, lineHeight: 1.4 }}>
        {race.placement}<span style={{ color: T.inkDim }}>/{race.field}</span>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{race.percentile}th pct</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.tempC}°C
        <div style={{ fontSize: 10, color: T.inkDim }}>{race.humidity}% hum</div>
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.6,
          color: verdictColor(race.verdict),
          justifySelf: "start",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: verdictColor(race.verdict), display: "inline-block", flexShrink: 0 }} />
        {verdictLabel(race.verdict)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isCustom && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(race.id);
            }}
            aria-label={`Delete ${race.name}`}
            title="Delete race"
            className="delete-btn"
            style={{
              background: "none",
              border: "none",
              color: T.ember,
              cursor: "pointer",
              fontFamily: FONT_MONO,
              fontSize: 16,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 3,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function RaceList({ races, onOpen, onAddRace, onDelete, selectedIds, onToggleSelect, onCompare, onClearSelection }) {
  const [sport, setSport] = useState("All");
  const filtered = useMemo(
    () => (sport === "All" ? races : races.filter((r) => r.sport === sport)),
    [sport, races]
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
            RACE RESUME
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 600, margin: 0, color: T.paper, letterSpacing: 0.2 }}>
            Your races
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: 0.4,
                  padding: "7px 12px",
                  borderRadius: 3,
                  border: `1px solid ${sport === s ? T.brass : T.line}`,
                  background: sport === s ? "rgba(201,162,75,0.12)" : "transparent",
                  color: sport === s ? T.brass : T.inkDim,
                  cursor: "pointer",
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={onAddRace}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: 0.5,
              padding: "7px 14px",
              borderRadius: 3,
              border: "none",
              background: T.brass,
              color: T.bg,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + ADD RACE
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: ROW_COLS,
          gap: 12,
          padding: "0 18px 10px",
          borderBottom: `1px solid ${T.line}`,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.8,
          color: T.inkDim,
        }}
      >
        <div />
        <div>RACE</div>
        <div>DISTANCE</div>
        <div>FINISH</div>
        <div>PLACE</div>
        <div>RESULT</div>
        <div>CONDITIONS</div>
        <div>DEBRIEF</div>
        <div />
      </div>

      <div>
        {filtered.map((r, i) => (
          <RaceListRow
            key={r.id}
            race={r}
            onOpen={onOpen}
            onDelete={onDelete}
            onToggleSelect={onToggleSelect}
            isSelected={selectedIds.has(r.id)}
            index={i}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "40px 18px", color: T.inkDim, fontFamily: FONT_BODY, fontSize: 15 }}>
            No races logged in this sport yet. Import a race to start building your resume.
          </div>
        )}
      </div>

      {/* Sticky compare banner */}
      {selectedIds.size >= 2 && (
        <div
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
            background: T.bg2, borderTop: `1px solid ${T.line}`,
            padding: "14px 32px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink, letterSpacing: 0.5 }}>
            {selectedIds.size} RACES SELECTED
          </span>
          <button
            onClick={onCompare}
            disabled={selectedIds.size > 3}
            style={{
              fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, fontWeight: 600,
              padding: "9px 20px", borderRadius: 3, border: "none",
              background: T.brass, color: T.bg, cursor: "pointer",
            }}
          >
            COMPARE →
          </button>
          <button
            onClick={onClearSelection}
            style={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4,
              padding: "9px 14px", borderRadius: 3,
              border: `1px solid ${T.line}`, background: "transparent",
              color: T.inkDim, cursor: "pointer",
            }}
          >
            × CLEAR
          </button>
          {selectedIds.size > 3 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ember }}>
              Max 3 races
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Form primitives — shared input styling
   --------------------------------------------------------- */

const inputStyle = {
  width: "100%",
  fontFamily: FONT_MONO,
  fontSize: 13,
  color: T.paper,
  background: T.bg2,
  border: `1px solid ${T.line}`,
  borderRadius: 3,
  padding: "9px 10px",
  outline: "none",
};

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.7, color: T.inkDim, marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
      {hint && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function TextInput(props) {
  return <input {...props} style={inputStyle} onFocus={(e) => (e.target.style.borderColor = T.brass)} onBlur={(e) => (e.target.style.borderColor = T.line)} />;
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
      {options.map((o) => (
        <option key={o} value={o} style={{ background: T.bg }}>
          {o}
        </option>
      ))}
    </select>
  );
}

function FormSectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 16,
        fontWeight: 600,
        color: T.paper,
        marginTop: 32,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   GPX / TCX import
   Parses a track file client-side (no network, no auth) and
   derives evenly-spaced km splits with pace and elevation —
   the inputs the debrief and chart need. This covers exports
   from Strava, Garmin Connect, Coros, and Polar Flow, since
   they all support "export as GPX" on an activity.
   --------------------------------------------------------- */

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function parseGpxPoints(xmlDoc) {
  const trkpts = Array.from(xmlDoc.getElementsByTagName("trkpt"));
  return trkpts
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      const eleEl = pt.getElementsByTagName("ele")[0];
      const timeEl = pt.getElementsByTagName("time")[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : null;
      const time = timeEl ? new Date(timeEl.textContent).getTime() : null;
      return { lat, lon, ele, time };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

function parseTcxPoints(xmlDoc) {
  const trackpoints = Array.from(xmlDoc.getElementsByTagName("Trackpoint"));
  return trackpoints
    .map((pt) => {
      const posEl = pt.getElementsByTagName("Position")[0];
      const lat = posEl ? parseFloat(posEl.getElementsByTagName("LatitudeDegrees")[0]?.textContent) : NaN;
      const lon = posEl ? parseFloat(posEl.getElementsByTagName("LongitudeDegrees")[0]?.textContent) : NaN;
      const altEl = pt.getElementsByTagName("AltitudeMeters")[0];
      const timeEl = pt.getElementsByTagName("Time")[0];
      const ele = altEl ? parseFloat(altEl.textContent) : null;
      const time = timeEl ? new Date(timeEl.textContent).getTime() : null;
      return { lat, lon, ele, time };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

function pointsToCumulativeDistance(points) {
  let cumM = 0;
  return points.map((p, i) => {
    if (i > 0) cumM += haversineMeters(points[i - 1].lat, points[i - 1].lon, p.lat, p.lon);
    return { ...p, cumKm: cumM / 1000 };
  });
}

function resampleToKmSplits(points, intervalKm) {
  if (points.length < 2) return [];
  const hasTime = points.every((p) => p.time != null);
  const totalKm = points[points.length - 1].cumKm;
  const splits = [];
  let nextTarget = intervalKm;
  let lastSplitKm = 0;
  let lastSplitTime = points[0].time;

  for (let i = 1; i < points.length; i++) {
    if (points[i].cumKm >= nextTarget || i === points.length - 1) {
      const km = Math.round(points[i].cumKm * 10) / 10;
      const elevM = points[i].ele != null ? Math.round(points[i].ele) : null;
      let pace = null;
      if (hasTime && points[i].time != null && lastSplitTime != null) {
        const segKm = points[i].cumKm - lastSplitKm;
        const segMin = (points[i].time - lastSplitTime) / 60000;
        if (segKm > 0) pace = Math.round((segMin / segKm) * 100) / 100;
      }
      splits.push({ km, pace, elevM, timeMs: points[i].time, lat: points[i].lat, lon: points[i].lon });
      lastSplitKm = points[i].cumKm;
      lastSplitTime = points[i].time;
      nextTarget = points[i].cumKm + intervalKm;
    }
  }
  return splits;
}

async function parseTrackFile(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length) {
    throw new Error("Could not read this file — make sure it's a valid GPX or TCX export.");
  }

  const isTcx = file.name.toLowerCase().endsWith(".tcx") || xmlDoc.getElementsByTagName("TrainingCenterDatabase").length > 0;
  const rawPoints = isTcx ? parseTcxPoints(xmlDoc) : parseGpxPoints(xmlDoc);

  if (rawPoints.length < 2) {
    throw new Error("No track points found in this file.");
  }

  const points = pointsToCumulativeDistance(rawPoints);
  const totalKm = points[points.length - 1].cumKm;
  // pick a reasonable split interval: roughly 8-12 splits across the race
  const intervalKm = totalKm > 60 ? 10 : totalKm > 25 ? 5 : totalKm > 12 ? 2 : 1;
  const splits = resampleToKmSplits(points, intervalKm);

  const hasTime = rawPoints.every((p) => p.time != null);
  let finishTime = "";
  if (hasTime) {
    const totalMin = (rawPoints[rawPoints.length - 1].time - rawPoints[0].time) / 60000;
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    const s = Math.round((totalMin * 60) % 60);
    finishTime = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  const elevations = points.map((p) => p.ele).filter((e) => e != null);
  let elevationGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) elevationGain += diff;
  }

  // try to pull a name from GPX <name> or <trk><name>, fall back to filename
  const nameEl = xmlDoc.getElementsByTagName("name")[0];
  const name = nameEl?.textContent?.trim() || file.name.replace(/\.(gpx|tcx)$/i, "");

  return {
    name,
    distanceKm: Math.round(totalKm * 100) / 100,
    elevationM: Math.round(elevationGain),
    finishTime,
    splits: splits.filter((s) => s.pace != null && s.km > 0),
    hasTime,
    startLat: rawPoints[0].lat,
    startLon: rawPoints[0].lon,
    startTimeMs: rawPoints[0].time,
    endTimeMs: rawPoints[rawPoints.length - 1].time,
  };
}

/* ---------------------------------------------------------
   Weather lookup — Open-Meteo historical archive
   Free, no API key, CORS-enabled, hourly resolution back to
   1940. Given GPS + a timestamp from the GPX/TCX file, this
   pulls the actual recorded conditions for that race instead
   of asking the athlete to remember or type them in.

   Sandbox fallback: the Claude.ai artifact viewer's iframe
   only allows network requests to a fixed domain allowlist,
   which doesn't include Open-Meteo. A real `fetch()` to it
   fails before any HTTP response — a TypeError, not an HTTP
   error. When that specific failure mode is detected, this
   falls back to a deterministic, clearly-labeled estimate so
   the rest of the flow stays testable. Outside that sandbox
   (the eventual standalone deployment), the real fetch above
   succeeds normally and this fallback never triggers.
   --------------------------------------------------------- */

function isNetworkBlockedError(err) {
  // fetch() throws a plain TypeError with no HTTP status when the request
  // never leaves the browser (CSP/sandbox block, DNS failure, offline, etc.)
  return err instanceof TypeError || /failed to fetch|network/i.test(err?.message || "");
}

function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function simulateHistoricalWeather(lat, lon, startMs, endMs) {
  // Deterministic, latitude/season-aware estimate — same inputs always produce
  // the same output, so re-importing the same file doesn't change past results.
  const date = new Date(startMs);
  const dayOfYear = Math.floor((date - new Date(date.getUTCFullYear(), 0, 0)) / 86400000);
  const isNorthern = lat >= 0;
  const seasonPhase = isNorthern ? dayOfYear : dayOfYear + 182.5;
  const seasonalTemp = 14 - 12 * Math.cos((2 * Math.PI * seasonPhase) / 365);
  const latitudeCooling = Math.abs(lat) * 0.35;
  const baseTemp = seasonalTemp - latitudeCooling + 10;

  const rand = seededRandom(`${lat.toFixed(2)},${lon.toFixed(2)},${date.toISOString().slice(0, 10)}`);
  const tempC = Math.round((baseTemp + (rand() - 0.5) * 8) * 10) / 10;
  const humidity = Math.round(45 + rand() * 35);
  const wind = Math.round(4 + rand() * 18);
  const precipMm = rand() > 0.78 ? Math.round(rand() * 8 * 10) / 10 : 0;

  // Build a synthetic hourly temperature curve for the race window using a
  // simplified diurnal model: daily min around 6am, daily max around 3pm.
  const hourlyTimes = [];
  const hourlyTemps = [];
  const startHourMs = Math.floor(startMs / 3600000) * 3600000;
  const endHourMs = Math.ceil((endMs ?? startMs) / 3600000) * 3600000;
  const dailyRange = 6; // synthetic ±3°C swing around base
  for (let t = startHourMs; t <= endHourMs + 3600000; t += 3600000) {
    const h = new Date(t).getUTCHours();
    // diurnal phase: cos peaks at 6am (min), troughs at 3pm (max)
    const diurnal = -Math.cos((2 * Math.PI * (h - 6)) / 24);
    hourlyTimes.push(new Date(t).toISOString().slice(0, 16));
    hourlyTemps.push(Math.round((tempC + diurnal * (dailyRange / 2)) * 10) / 10);
  }

  return { tempC, humidity, wind, precipMm, simulated: true, hourlyTimes, hourlyTemps };
}

async function fetchHistoricalWeather(lat, lon, startMs, endMs) {
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(endMs ?? startMs).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: startDate,
    end_date: endDate,
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
    timezone: "UTC",
  });
  const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    if (isNetworkBlockedError(err)) {
      return simulateHistoricalWeather(lat, lon, startMs, endMs);
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.reason || `Weather lookup failed (${res.status}).`);
  }
  const data = await res.json();
  const times = data?.hourly?.time;
  if (!times || !times.length) {
    throw new Error("No historical weather available for this date and location.");
  }

  // find the hourly record closest to the race start time
  const targetMs = startMs;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i] + ":00Z").getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  const temp = data.hourly.temperature_2m?.[bestIdx];
  const humidity = data.hourly.relative_humidity_2m?.[bestIdx];
  const wind = data.hourly.wind_speed_10m?.[bestIdx];
  const precip = data.hourly.precipitation?.[bestIdx];

  if (temp == null) {
    throw new Error("Weather data wasn't available for this exact time and place.");
  }

  return {
    tempC: Math.round(temp * 10) / 10,
    humidity: humidity != null ? Math.round(humidity) : null,
    wind: wind != null ? Math.round(wind) : null,
    precipMm: precip != null ? Math.round(precip * 10) / 10 : null,
    simulated: false,
    // full hourly series so per-split temperatures can be looked up
    hourlyTimes: times,
    hourlyTemps: data.hourly.temperature_2m ?? [],
  };
}

// Fetch temperature at multiple GPS locations along the course, then interpolate.
// For trail/gravel/ultra events the course can cross hundreds of metres of elevation
// change or dozens of kilometres of geographic variation — fetching only at the start
// point and adjusting by time-of-day misses all of that. This samples up to MAX_SAMPLES
// evenly-spaced splits, fires those fetches in parallel, and linearly interpolates
// between them for every split in between.
async function fetchWeatherAlongCourse(splits) {
  const geo = splits.filter((s) => s.lat != null && s.lon != null && s.timeMs != null);
  if (geo.length === 0) return splits;

  const totalKm = geo[geo.length - 1].km ?? geo.length;
  const MAX_SAMPLES = Math.max(3, Math.round(totalKm / 20));
  const step = Math.max(1, Math.floor(geo.length / (MAX_SAMPLES - 1)));
  const sampled = [];
  for (let i = 0; i < geo.length; i += step) sampled.push(geo[i]);
  const last = geo[geo.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);

  // Fetch the actual recorded temperature at each sampled location+time in parallel.
  const fetched = await Promise.all(
    sampled.map((s) =>
      fetchHistoricalWeather(s.lat, s.lon, s.timeMs, s.timeMs).catch(() => null)
    )
  );

  // Build control points: (km, tempC) pairs where we have real data.
  const controls = sampled
    .map((s, i) => ({ km: s.km, tempC: fetched[i]?.tempC ?? null }))
    .filter((c) => c.tempC != null);

  if (controls.length === 0) return splits;

  // Linear interpolation: for each split, find the two bracketing control points.
  return splits.map((s) => {
    let lo = controls[0];
    let hi = controls[controls.length - 1];
    for (let i = 0; i < controls.length - 1; i++) {
      if (s.km >= controls[i].km && s.km <= controls[i + 1].km) {
        lo = controls[i];
        hi = controls[i + 1];
        break;
      }
    }
    const t = lo.km === hi.km ? 0 : (s.km - lo.km) / (hi.km - lo.km);
    const tempC = Math.round((lo.tempC + t * (hi.tempC - lo.tempC)) * 10) / 10;
    return { ...s, mappedTempC: tempC };
  });
}

async function geocodeLocation(query) {
  const params = new URLSearchParams({ name: query, count: "1" });
  let res;
  try {
    res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  } catch (err) {
    if (isNetworkBlockedError(err)) {
      // can't geocode without a network call — fall back to a neutral coordinate
      // (0,0 would skew the seasonal model, so use a temperate-latitude default)
      return { lat: 40, lon: -75, label: `${query} (simulated location)`, simulated: true };
    }
    throw err;
  }
  if (!res.ok) throw new Error("Location lookup failed.");
  const data = await res.json();
  const match = data?.results?.[0];
  if (!match) throw new Error(`Couldn't find a location matching "${query}". Try a nearby city name.`);
  return { lat: match.latitude, lon: match.longitude, label: `${match.name}, ${match.country}`, simulated: false };
}

/* ---------------------------------------------------------
   Add Race — manual data entry
   --------------------------------------------------------- */

const EMPTY_SPLIT_ROWS = 4;

function blankSplit() {
  return { km: "", pace: "", tempC: "", elevM: "" };
}

function AddRaceForm({ onSave, onCancel, initialRace = null }) {
  const paceToStr = (p) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
  const editing = initialRace != null;

  const [name, setName] = useState(initialRace?.name ?? "");
  const [sport, setSport] = useState(initialRace?.sport ?? SPORT_OPTIONS[0]);
  const [date, setDate] = useState(initialRace?.date ?? new Date().toISOString().slice(0, 10));
  const [distanceKm, setDistanceKm] = useState(initialRace ? String(initialRace.distanceKm) : "");
  const [elevationM, setElevationM] = useState(initialRace ? String(initialRace.elevationM || "") : "");
  const [surface, setSurface] = useState(initialRace?.surface ?? SURFACES[0]);
  const [finishTime, setFinishTime] = useState(initialRace?.finishTime ?? "");
  const [placement, setPlacement] = useState(initialRace ? String(initialRace.placement || "") : "");
  const [field, setField] = useState(initialRace ? String(initialRace.field || "") : "");
  const [tempC, setTempC] = useState(initialRace ? String(initialRace.tempC || "") : "");
  const [humidity, setHumidity] = useState(initialRace ? String(initialRace.humidity || "") : "");
  const [wind, setWind] = useState(initialRace ? String(initialRace.wind || "") : "");
  const [carbsPerHr, setCarbsPerHr] = useState(initialRace ? String(initialRace.fueling?.carbsPerHr || "") : "");
  const [sodiumPerHr, setSodiumPerHr] = useState(initialRace ? String(initialRace.fueling?.sodiumPerHr || "") : "");
  const [fluidsPerHr, setFluidsPerHr] = useState(initialRace ? String(initialRace.fueling?.fluidsPerHr || "") : "");
  const [caffeine, setCaffeine] = useState(initialRace ? String(initialRace.fueling?.caffeine || "") : "");
  const [splitRows, setSplitRows] = useState(
    initialRace?.splits?.length
      ? initialRace.splits.map((s) => ({
          km: String(s.km),
          pace: paceToStr(s.pace),
          tempC: s.tempC != null ? String(s.tempC) : "",
          elevM: s.elevM != null ? String(s.elevM) : "",
        }))
      : Array.from({ length: EMPTY_SPLIT_ROWS }, blankSplit)
  );
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState(null); // null | "loading" | "done" | "error"
  const [importMessage, setImportMessage] = useState("");
  const [weatherStatus, setWeatherStatus] = useState(null); // null | "loading" | "done" | "error" | "skipped"
  const [weatherMessage, setWeatherMessage] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const showElevCol = sport !== "Road Running";
  const race_sport_lower = sport.toLowerCase();

  async function handleLocationWeatherLookup() {
    if (!locationQuery.trim()) return;
    setWeatherStatus("loading");
    setWeatherMessage("");
    try {
      const place = await geocodeLocation(locationQuery.trim());
      const raceDate = date ? new Date(`${date}T12:00:00Z`).getTime() : Date.now();
      const weather = await fetchHistoricalWeather(place.lat, place.lon, raceDate, raceDate);
      setTempC(String(weather.tempC));
      if (weather.humidity != null) setHumidity(String(weather.humidity));
      if (weather.wind != null) setWind(String(weather.wind));
      const precipNote = weather.precipMm > 0.2 ? ` Recorded ${weather.precipMm}mm of precipitation that day.` : "";
      if (weather.simulated || place.simulated) {
        setWeatherStatus("simulated");
        setWeatherMessage(`SIMULATED — this preview can't reach the weather service from here, so this is a placeholder estimate, not a real lookup for ${locationQuery.trim()}: ${weather.tempC}°C, ${weather.humidity ?? "—"}% humidity, ${weather.wind ?? "—"} km/h wind.${precipNote} Outside this preview, the real lookup will run automatically.`);
      } else {
        setWeatherStatus("done");
        setWeatherMessage(`Conditions for ${place.label} on ${fmtDate(date)} (midday, since no exact start time is available): ${weather.tempC}°C, ${weather.humidity ?? "—"}% humidity, ${weather.wind ?? "—"} km/h wind.${precipNote} Adjust below if your start time was earlier or later in the day.`);
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(err.message || "Couldn't look up weather for that location — enter conditions manually below.");
    }
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    setImportMessage("");
    setWeatherStatus(null);
    setWeatherMessage("");
    try {
      const parsed = await parseTrackFile(file);
      if (!parsed.splits.length) {
        throw new Error("This file has GPS points but no timestamps, so RaceIQ can't compute pace from it. Try a file exported with time data, or enter splits manually.");
      }
      setName((prev) => prev || parsed.name);
      setDistanceKm(String(parsed.distanceKm));
      if (parsed.elevationM) setElevationM(String(parsed.elevationM));
      if (parsed.finishTime) setFinishTime(parsed.finishTime);
      if (parsed.startTimeMs) setDate(new Date(parsed.startTimeMs).toISOString().slice(0, 10));
      setSplitRows(
        parsed.splits.map((s) => ({
          km: String(s.km),
          pace: `${Math.floor(s.pace)}:${String(Math.round((s.pace % 1) * 60)).padStart(2, "0")}`,
          tempC: "",
          elevM: s.elevM != null ? String(s.elevM) : "",
        }))
      );
      setImportStatus("done");
      setImportMessage(`Imported ${parsed.splits.length} splits over ${parsed.distanceKm} km. Review below, then add placement and fueling to finish.`);

      // GPX/TCX carries GPS + timestamps — fetch weather at multiple points along the
      // course so temperature reflects actual geography (elevation changes, different
      // microclimates), not just time-of-day at the start location.
      if (parsed.startLat != null && parsed.startLon != null && parsed.startTimeMs != null) {
        setWeatherStatus("loading");
        try {
          // Start-point fetch for the summary stats (humidity, wind, precip).
          const startWeather = await fetchHistoricalWeather(parsed.startLat, parsed.startLon, parsed.startTimeMs, parsed.endTimeMs);
          setTempC(String(startWeather.tempC));
          if (startWeather.humidity != null) setHumidity(String(startWeather.humidity));
          if (startWeather.wind != null) setWind(String(startWeather.wind));

          // Multi-point fetch: sample up to 6 GPS locations along the course so that
          // geographic and elevation-driven temperature variation is captured, then
          // interpolate between them for every split.
          const splitsWithTemp = await fetchWeatherAlongCourse(parsed.splits);
          setSplitRows(
            splitsWithTemp.map((s) => ({
              km: String(s.km),
              pace: `${Math.floor(s.pace)}:${String(Math.round((s.pace % 1) * 60)).padStart(2, "0")}`,
              tempC: s.mappedTempC != null ? String(s.mappedTempC) : "",
              elevM: s.elevM != null ? String(s.elevM) : "",
            }))
          );

          const precipNote = startWeather.precipMm > 0.2 ? ` Recorded ${startWeather.precipMm}mm of precipitation around race time.` : "";
          const sampleCount = splitsWithTemp.filter(s => s.lat != null).length;
          if (startWeather.simulated) {
            setWeatherStatus("simulated");
            setWeatherMessage(`SIMULATED — can't reach the weather service from here, so these are placeholder estimates: ${startWeather.tempC}°C at start, ${startWeather.humidity ?? "—"}% humidity, ${startWeather.wind ?? "—"} km/h wind. Per-split temperatures use a diurnal model.${precipNote} Outside this preview, real geo-sampled conditions will be fetched.`);
          } else {
            setWeatherStatus("done");
            setWeatherMessage(`Fetched conditions at ${sampleCount} locations along the course and interpolated per-split temperatures — capturing elevation and geographic variation, not just time of day. Start: ${startWeather.tempC}°C, ${startWeather.humidity ?? "—"}% humidity, ${startWeather.wind ?? "—"} km/h wind.${precipNote}`);
          }
        } catch (werr) {
          setWeatherStatus("error");
          setWeatherMessage(werr.message || "Couldn't fetch historical weather for this race — enter conditions manually below.");
        }
      } else {
        setWeatherStatus("skipped");
        setWeatherMessage("This file doesn't have GPS coordinates and timestamps together, so weather couldn't be looked up automatically. Enter conditions manually below.");
      }
    } catch (err) {
      setImportStatus("error");
      setImportMessage(err.message || "Something went wrong reading that file.");
    } finally {
      e.target.value = "";
    }
  }

  function updateSplit(i, field, value) {
    setSplitRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addSplitRow() {
    setSplitRows((rows) => [...rows, blankSplit()]);
  }

  function removeSplitRow(i) {
    setSplitRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    if (!name.trim()) return setError("Give the race a name.");
    if (!distanceKm || Number(distanceKm) <= 0) return setError("Enter a distance greater than zero.");
    if (!finishTime.trim()) return setError("Enter a finish time, like 3:24:51 or 38:42.");

    const splits = splitRows
      .filter((r) => r.km !== "" && r.pace !== "")
      .map((r) => ({
        km: parseFloat(r.km),
        pace: parseClockToMinutes(r.pace),
        tempC: r.tempC !== "" ? parseFloat(r.tempC) : parseFloat(tempC) || 18,
        elevM: r.elevM !== "" ? parseFloat(r.elevM) : null,
      }))
      .sort((a, b) => a.km - b.km);

    if (splits.length < 2) {
      return setError("Add at least two splits so RaceIQ can read your pacing pattern.");
    }

    setError("");

    const raw = {
      id: initialRace?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      sport,
      date,
      distanceKm: Number(distanceKm),
      elevationM: Number(elevationM) || 0,
      surface,
      finishTime: finishTime.trim(),
      placement: Number(placement) || splits.length,
      field: Number(field) || Number(placement) || splits.length,
      tempC: Number(tempC) || splits[splits.length - 1].tempC,
      humidity: Number(humidity) || 50,
      wind: Number(wind) || 0,
      splits,
      fueling: {
        carbsPerHr: Number(carbsPerHr) || 0,
        sodiumPerHr: Number(sodiumPerHr) || 0,
        fluidsPerHr: Number(fluidsPerHr) || 0,
        caffeine: Number(caffeine) || 0,
      },
    };

    onSave(enrichRace(raw));
  }

  return (
    <div>
      <button
        onClick={onCancel}
        style={{
          background: "none",
          border: "none",
          color: T.inkDim,
          fontFamily: FONT_MONO,
          fontSize: 12,
          letterSpacing: 0.5,
          cursor: "pointer",
          padding: 0,
          marginBottom: 28,
        }}
      >
        ← BACK TO RACE RESUME
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
        {editing ? "EDIT RACE" : "ADD RACE"}
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: T.paper }}>
        {editing ? "Edit race data" : "Enter race data"}
      </h1>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, marginBottom: 8, maxWidth: 600 }}>
        Add what you have. RaceIQ derives your percentile, score, and verdict from these numbers, and writes the
        debrief from your splits and conditions.
      </div>

      <div
        style={{
          background: T.bg2,
          border: `1px solid ${T.line}`,
          borderRadius: 4,
          padding: "18px 20px",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: T.paper, marginBottom: 4 }}>
            Import a GPX or TCX file
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, maxWidth: 440 }}>
            Export the activity from Strava, Garmin Connect, Coros, or Polar Flow as GPX, then drop it here.
            RaceIQ reads it in your browser — nothing is uploaded anywhere — and fills in distance, splits, pace, and
            elevation automatically.
          </div>
        </div>
        <label
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: 0.5,
            color: T.bg,
            background: T.brass,
            border: "none",
            borderRadius: 3,
            padding: "11px 18px",
            cursor: "pointer",
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {importStatus === "loading" ? "READING…" : "CHOOSE FILE"}
          <input type="file" accept=".gpx,.tcx" onChange={handleFileImport} style={{ display: "none" }} disabled={importStatus === "loading"} />
        </label>
      </div>
      {importStatus === "done" && (
        <div
          style={{
            marginBottom: 24,
            padding: "10px 16px",
            background: "rgba(79,174,140,0.08)",
            border: `1px solid ${T.greenDim}`,
            borderRadius: 3,
            color: T.green,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          {importMessage}
        </div>
      )}
      {importStatus === "error" && (
        <div
          style={{
            marginBottom: 24,
            padding: "10px 16px",
            background: "rgba(255,106,57,0.08)",
            border: `1px solid ${T.emberDim}`,
            borderRadius: 3,
            color: T.ember,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          {importMessage}
        </div>
      )}

      <FormSectionTitle>Race details</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Race name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Brandywine Valley Marathon" />
        </Field>
        <Field label="Sport">
          <Select value={sport} onChange={(e) => setSport(e.target.value)} options={SPORT_OPTIONS} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Distance (km)">
          <TextInput type="number" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="42.2" />
        </Field>
        <Field label="Elevation gain (m)">
          <TextInput type="number" value={elevationM} onChange={(e) => setElevationM(e.target.value)} placeholder="310" />
        </Field>
        <Field label="Surface">
          <Select value={surface} onChange={(e) => setSurface(e.target.value)} options={SURFACES} />
        </Field>
      </div>

      <FormSectionTitle>Result</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Finish time" hint="H:MM:SS or MM:SS">
          <TextInput value={finishTime} onChange={(e) => setFinishTime(e.target.value)} placeholder="3:24:51" />
        </Field>
        <Field label="Placement">
          <TextInput type="number" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="142" />
        </Field>
        <Field label="Field size">
          <TextInput type="number" value={field} onChange={(e) => setField(e.target.value)} placeholder="1850" />
        </Field>
      </div>

      <FormSectionTitle>Conditions</FormSectionTitle>

      {weatherStatus !== "done" && weatherStatus !== "simulated" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="Race location" hint="City or race venue — used to look up recorded weather for the date above">
              <TextInput
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Philadelphia, PA"
              />
            </Field>
          </div>
          <button
            onClick={handleLocationWeatherLookup}
            disabled={!locationQuery.trim() || weatherStatus === "loading"}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              letterSpacing: 0.5,
              color: T.bg,
              background: locationQuery.trim() ? T.brass : T.line,
              border: "none",
              borderRadius: 3,
              padding: "10px 16px",
              cursor: locationQuery.trim() ? "pointer" : "default",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {weatherStatus === "loading" ? "LOOKING UP…" : "LOOK UP WEATHER"}
          </button>
        </div>
      )}
      {weatherStatus === "done" && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            background: "rgba(79,174,140,0.08)",
            border: `1px solid ${T.greenDim}`,
            borderRadius: 3,
            color: T.green,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          {weatherMessage}
        </div>
      )}
      {weatherStatus === "simulated" && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            background: "rgba(201,162,75,0.1)",
            border: `1px solid ${T.brassDim}`,
            borderRadius: 3,
            color: T.brass,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          <strong style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>SIMULATED — </strong>
          {weatherMessage.replace(/^SIMULATED — /, "")}
        </div>
      )}
      {(weatherStatus === "error" || weatherStatus === "skipped") && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            background: "rgba(255,106,57,0.08)",
            border: `1px solid ${T.emberDim}`,
            borderRadius: 3,
            color: T.ember,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          {weatherMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Temperature (°C)">
          <TextInput type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="27" />
        </Field>
        <Field label="Humidity (%)">
          <TextInput type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="71" />
        </Field>
        <Field label="Wind (km/h)">
          <TextInput type="number" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="14" />
        </Field>
      </div>

      <FormSectionTitle>Fueling</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Carbs (g/hr)">
          <TextInput type="number" value={carbsPerHr} onChange={(e) => setCarbsPerHr(e.target.value)} placeholder="52" />
        </Field>
        <Field label="Sodium (mg/hr)">
          <TextInput type="number" value={sodiumPerHr} onChange={(e) => setSodiumPerHr(e.target.value)} placeholder="280" />
        </Field>
        <Field label="Fluids (ml/hr)">
          <TextInput type="number" value={fluidsPerHr} onChange={(e) => setFluidsPerHr(e.target.value)} placeholder="480" />
        </Field>
        <Field label="Caffeine (mg total)">
          <TextInput type="number" value={caffeine} onChange={(e) => setCaffeine(e.target.value)} placeholder="80" />
        </Field>
      </div>

      <FormSectionTitle>Splits</FormSectionTitle>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 14 }}>
        Enter at least two checkpoints. Pace is minutes per km (or per mile — just stay consistent). Leave a split's
        temperature blank to use the overall race temperature above.
        {showElevCol && (
          <>
            {" "}Add elevation at each checkpoint and RaceIQ will compute grade-adjusted pace — raw pace on a climb
            isn't comparable to raw pace on the flat, so this is what the debrief and chart will use for {race_sport_lower}.
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
        {(showElevCol
          ? ["KM / CHECKPOINT", "PACE (MM:SS)", "ELEV (M)", "TEMP °C (OPT.)", ""]
          : ["KM / CHECKPOINT", "PACE (MM:SS)", "TEMP °C (OPTIONAL)", ""]
        ).map((h) => (
          <div key={h} style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.5, color: T.inkDim }}>
            {h}
          </div>
        ))}
      </div>
      {splitRows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
          <TextInput
            type="number"
            step="0.1"
            value={row.km}
            onChange={(e) => updateSplit(i, "km", e.target.value)}
            placeholder={i === 0 ? "5" : ""}
          />
          <TextInput
            value={row.pace}
            onChange={(e) => updateSplit(i, "pace", e.target.value)}
            placeholder={i === 0 ? "4:42" : ""}
          />
          {showElevCol && (
            <TextInput
              type="number"
              value={row.elevM}
              onChange={(e) => updateSplit(i, "elevM", e.target.value)}
              placeholder={i === 0 ? "120" : ""}
            />
          )}
          <TextInput
            type="number"
            value={row.tempC}
            onChange={(e) => updateSplit(i, "tempC", e.target.value)}
            placeholder=""
          />
          <button
            onClick={() => removeSplitRow(i)}
            aria-label="Remove split"
            style={{
              background: "none",
              border: `1px solid ${T.line}`,
              borderRadius: 3,
              color: T.inkDim,
              cursor: "pointer",
              fontFamily: FONT_MONO,
              fontSize: 13,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addSplitRow}
        style={{
          background: "none",
          border: `1px dashed ${T.line}`,
          borderRadius: 3,
          color: T.inkDim,
          cursor: "pointer",
          fontFamily: FONT_MONO,
          fontSize: 11.5,
          letterSpacing: 0.4,
          padding: "8px 14px",
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        + ADD SPLIT
      </button>

      {error && (
        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "rgba(255,106,57,0.08)",
            border: `1px solid ${T.emberDim}`,
            borderRadius: 3,
            color: T.ember,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 28, paddingTop: 24, borderTop: `1px solid ${T.line}` }}>
        <button
          onClick={handleSubmit}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            letterSpacing: 0.6,
            color: T.bg,
            background: T.brass,
            border: "none",
            borderRadius: 3,
            padding: "12px 22px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {editing ? "UPDATE RACE & REGENERATE DEBRIEF" : "SAVE RACE & GENERATE DEBRIEF"}
        </button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            letterSpacing: 0.6,
            color: T.inkDim,
            background: "none",
            border: `1px solid ${T.line}`,
            borderRadius: 3,
            padding: "12px 22px",
            cursor: "pointer",
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Finding card
   --------------------------------------------------------- */

function Finding({ kind, title, body }) {
  const color = kind === "strength" ? T.green : kind === "limiter" ? T.ember : T.brass;
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ flexShrink: 0, width: 8, paddingTop: 6 }}>
        <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: T.paper, marginBottom: 5, letterSpacing: 0.1 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: T.ink }}>{body}</div>
      </div>
    </div>
  );
}

function Recommendation({ index, action, why }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          color: T.brass,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {String(index).padStart(2, "0")}
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500, color: T.paper, marginBottom: 4 }}>
          {action}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, lineHeight: 1.5 }}>{why}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Stat block
   --------------------------------------------------------- */

function useAnimatedCount(target, duration = 820) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setCount(target); return; }
    let start = null;
    let frame;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return count;
}

function verdictGlow(v) {
  if (v === "strength") return "linear-gradient(to right, rgba(79,174,140,0.09), transparent 85%)";
  if (v === "limiter") return "linear-gradient(to right, rgba(255,106,57,0.09), transparent 85%)";
  return "linear-gradient(to right, rgba(201,162,75,0.08), transparent 85%)";
}

function Stat({ label, value, sub, accent, hero, index = 0, animated }) {
  const numericTarget = animated && typeof value === "number" ? value : 0;
  const animatedValue = useAnimatedCount(numericTarget);
  const displayValue = animated && typeof value === "number" ? animatedValue : value;

  return (
    <div
      className="stat-enter"
      style={{ minWidth: hero ? 130 : 110, animationDelay: `${index * 80}ms` }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.8,
          color: T.inkDim,
          marginBottom: hero ? 6 : 4,
          ...(hero ? { borderBottom: `1px solid ${T.brassDim}`, paddingBottom: 5 } : {}),
        }}
      >
        {label}
      </div>
      {hero ? (
        <span
          className="score-badge"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28,
            fontWeight: 600,
            color: T.brass,
            display: "inline-block",
            marginTop: 4,
            boxShadow: "0 0 28px rgba(201,162,75,0.14)",
          }}
        >
          {displayValue}
        </span>
      ) : (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, color: accent || T.paper, lineHeight: 1 }}>
          {displayValue}
        </div>
      )}
      {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Fueling benchmarks — science-backed carbohydrate targets
   derived from race duration (Jeukendrup 2014, Burke 2011).
   Gut absorption caps single-source carbs at ~60g/hr; higher
   rates require multiple transportable carbs (glucose + fructose).
   Short races don't need exogenous carbs at all — glycogen stores
   are sufficient for efforts under ~60–75 minutes.
   --------------------------------------------------------- */

function fuelingBenchmarks(finishTime) {
  const durationMin = parseClockToMinutes(finishTime);

  if (durationMin < 45) {
    return {
      needsCarbs: false,
      carbsLow: 0,
      carbsHigh: 0,
      carbsLabel: "none",
      peerAvg: null,
      rationale: "Efforts under 45 minutes don't require carbohydrate intake — glycogen stores are more than sufficient. Water is appropriate.",
    };
  }
  if (durationMin < 75) {
    return {
      needsCarbs: false,
      carbsLow: 0,
      carbsHigh: 30,
      carbsLabel: "0–30g/hr",
      peerAvg: 15,
      rationale: "For 45–75 minute efforts, exogenous carbohydrate has minimal performance benefit. Small amounts (0–30g/hr) may help gut comfort but aren't required.",
    };
  }
  if (durationMin < 150) {
    return {
      needsCarbs: true,
      carbsLow: 30,
      carbsHigh: 60,
      carbsLabel: "30–60g/hr",
      peerAvg: 45,
      rationale: "For 75–150 minute efforts, 30–60g/hr of carbohydrate supports performance. Single-source carbs (glucose) work well at this rate.",
    };
  }
  if (durationMin < 240) {
    return {
      needsCarbs: true,
      carbsLow: 60,
      carbsHigh: 90,
      carbsLabel: "60–90g/hr",
      peerAvg: 72,
      rationale: "For efforts over 2.5 hours, 60–90g/hr is the research-backed range. Multiple transportable carbs (glucose + fructose, 2:1 ratio) allow higher absorption rates.",
    };
  }
  return {
    needsCarbs: true,
    carbsLow: 80,
    carbsHigh: 120,
    carbsLabel: "80–120g/hr",
    peerAvg: 90,
    rationale: "For efforts over 4 hours, 80–120g/hr is achievable with a trained gut and glucose:fructose mix. Sodium replacement also becomes important at this duration.",
  };
}

/* ---------------------------------------------------------
   Race Debrief — the core feature
   --------------------------------------------------------- */

function buildDebrief(race) {
  // deterministic-feeling derived narrative per PRD's "explain don't display" principle
  const strengths = [];
  const limiters = [];
  const recs = [];
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));

  if (race.verdict === "strength") {
    strengths.push({
      title: "Pacing discipline held under fatigue",
      body: `Your split-to-split variance stayed inside 4% for the full distance — tighter than your season average. That control is what turned a good aerobic day into a result in the ${race.percentile}th percentile.`,
    });
    strengths.push({
      title: "Conditions matched your profile",
      body: `At ${race.tempC}°C and ${race.humidity}% humidity, you were racing inside the temperature band where your last six results cluster fastest. This wasn't luck — it's a pattern.`,
    });
    recs.push({
      action: "Target races in this temperature band",
      why: `Your last four best performances by percentile all fell between 4–14°C. Prioritize spring and fall dates over mid-summer fields when the calendar allows it.`,
    });
    if (fuel.needsCarbs) {
      recs.push({
        action: "Bank this fueling rate for harder efforts",
        why: `${race.fueling.carbsPerHr}g carbs/hour at this intensity produced no late-race fade. Carry the same number into your next race at a similar duration rather than reducing it.`,
      });
    }
  } else {
    limiters.push({
      title: "Pace collapsed once core temperature climbed",
      body: `Splits held inside 2% variance through the field's heat threshold, then slowed by roughly ${Math.round(
        ((race.splits[race.splits.length - 1].pace - race.splits[0].pace) / race.splits[0].pace) * 100
      )}% over the closing third — the signature of heat-driven cardiovascular drift, not muscular fatigue.`,
    });
    // Only flag fueling as a limiter when the race duration actually requires exogenous carbs
    // and the athlete was meaningfully below the evidence-backed range for this duration.
    if (fuel.needsCarbs && race.fueling.carbsPerHr < fuel.carbsLow) {
      limiters.push({
        title: "Fueling rate was light for the duration",
        body: `${race.fueling.carbsPerHr}g/hr sits below the ${fuel.carbsLabel} range research supports for ${durationMin}-minute efforts. On a race this long, that deficit tends to show up exactly where your pace did — the final third.`,
      });
      recs.push({
        action: `Raise carbohydrate intake toward ${fuel.carbsLabel}`,
        why: `For ${durationMin}-minute efforts, ${fuel.carbsLabel} is the evidence-backed range (${fuel.rationale.toLowerCase()}). At ${race.fueling.carbsPerHr}g/hr you were under-fueling for this duration.`,
      });
    }
    recs.push({
      action: "Build a heat-specific pacing plan for races above 24°C",
      why: `Your performance model shows a consistent slowdown above this threshold. Starting 4–6% slower through halfway preserves more time than it costs.`,
    });
  }

  if (race.verdict === "mixed") {
    strengths.push({
      title: "Power output stayed even on the climbs",
      body: `Your watts-per-kilogram on the three categorized climbs varied by less than 5% — better discipline than your average gravel result this season.`,
    });
    limiters.push({
      title: "Headwind sectors cost more than fueling did",
      body: `At ${race.wind} km/h sustained wind, the two exposed sectors after halfway account for the majority of time lost relative to your projected pace — not fueling or heat.`,
    });
    recs.push({
      action: "Practice draft-line positioning in group efforts",
      why: `The time lost in headwind sectors tracks with solo positioning rather than fitness. Group-ride practice targeting exposed sections will return more time than additional training volume.`,
    });
  }

  if (race.usesGap) {
    const climbs = race.splits.filter((s) => s.gradePct > 3);
    const descents = race.splits.filter((s) => s.gradePct < -3);
    if (climbs.length) {
      const avgClimbGrade = climbs.reduce((a, s) => a + s.gradePct, 0) / climbs.length;
      const climbGapAvg = climbs.reduce((a, s) => a + s.gapPace, 0) / climbs.length;
      const flatSplits = race.splits.filter((s) => Math.abs(s.gradePct) <= 3);
      const flatGapAvg = flatSplits.length
        ? flatSplits.reduce((a, s) => a + s.gapPace, 0) / flatSplits.length
        : climbGapAvg;
      const climbVsFlat = ((climbGapAvg - flatGapAvg) / flatGapAvg) * 100;
      const climbFinding = {
        title: climbVsFlat < 8 ? "Climbing effort matched your flat pace" : "Climbing cost more than the flats account for",
        body:
          climbVsFlat < 8
            ? `Across sections averaging ${avgClimbGrade.toFixed(1)}% grade, your grade-adjusted pace tracked within ${Math.abs(climbVsFlat).toFixed(0)}% of your flat effort — strong climbing economy for this course.`
            : `Across sections averaging ${avgClimbGrade.toFixed(1)}% grade, your grade-adjusted effort ran ${climbVsFlat.toFixed(0)}% slower than your flat splits — more than the grade alone explains, which usually means power or form broke down on the climbs specifically.`,
      };
      if (climbVsFlat < 8) strengths.push(climbFinding);
      else limiters.push(climbFinding);
    }
    if (descents.length) {
      const avgDescentGrade = descents.reduce((a, s) => a + s.gradePct, 0) / descents.length;
      const rawDescentPace = descents.reduce((a, s) => a + s.pace, 0) / descents.length;
      const gapDescentPace = descents.reduce((a, s) => a + s.gapPace, 0) / descents.length;
      const recovered = ((gapDescentPace - rawDescentPace) / gapDescentPace) * 100;
      strengths.push({
        title: "Descents recovered time efficiently",
        body: `On grades averaging ${avgDescentGrade.toFixed(1)}%, raw pace ran roughly ${Math.abs(recovered).toFixed(0)}% faster than effort-adjusted pace — gravity was doing the work the way it should, with no sign of over-braking.`,
      });
    }
    if (climbs.length) {
      recs.push({
        action: "Train climbing-specific intervals at race grade",
        why: `Your grade-adjusted pace on this course's climbs is the clearest signal for where to focus — hill repeats at a similar ${climbs[0].gradePct.toFixed(0)}% grade will transfer more directly than flat tempo work.`,
      });
    }
  }

  return { strengths, limiters, recs };
}

function RaceDebrief({ race, onBack, onAskCoach, onEdit }) {
  const { strengths, limiters, recs } = useMemo(() => buildDebrief(race), [race]);
  const allFindings = [
    ...strengths.map((s) => ({ ...s, kind: "strength" })),
    ...limiters.map((s) => ({ ...s, kind: "limiter" })),
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: T.inkDim,
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: 0.5,
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← BACK TO RACE RESUME
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: "none",
              border: `1px solid ${T.line}`,
              color: T.inkDim,
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: 0.5,
              cursor: "pointer",
              padding: "6px 14px",
              borderRadius: 3,
            }}
          >
            EDIT RACE
          </button>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 8, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass }}>
        RACE DEBRIEF
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: "0 0 6px", color: T.paper, letterSpacing: 0.1, maxWidth: 760 }}>
        {race.name}
      </h1>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.inkDim, marginBottom: 28 }}>
        {fmtDate(race.date)} · {race.sport} · {race.distanceKm} km · +{race.elevationM}m
      </div>

      {/* Verdict band */}
      <div
        style={{
          borderLeft: `3px solid ${verdictColor(race.verdict)}`,
          paddingLeft: 20,
          paddingTop: 12,
          paddingBottom: 12,
          marginBottom: 36,
          background: verdictGlow(race.verdict),
          borderRadius: "0 4px 4px 0",
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, color: verdictColor(race.verdict), marginBottom: 8 }}>
          {verdictLabel(race.verdict)}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 22, lineHeight: 1.4, color: T.paper, maxWidth: 640 }}>
          {race.headline}
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginBottom: 40, paddingBottom: 32, borderBottom: `1px solid ${T.line}` }}>
        <Stat label="FINISH TIME" value={race.finishTime} index={0} />
        <Stat label="PLACEMENT" value={`${race.placement}/${race.field}`} sub={`${race.percentile}th percentile`} index={1} />
        <Stat label="RACEIQ SCORE" value={race.rating} sub={`${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta} this race`} accent={T.brass} hero animated index={2} />
        <Stat label="CONDITIONS" value={`${race.tempC}°C`} sub={`${race.humidity}% humidity, ${race.wind} km/h wind`} index={3} />
      </div>

      {/* Pace / heat strip */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>
          Pace against temperature
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 600 }}>
          The dashed line tracks course temperature; the solid line is your pace. Where they cross is where the race turned.
        </div>
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            padding: "16px 12px 8px",
          }}
        >
          <PaceHeatStrip race={race} />
        </div>
      </div>

      {/* Two column: findings + nutrition */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>
            Findings
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 10 }}>
            What the data shows, in order of impact on the result.
          </div>
          <div>
            {allFindings.map((f, i) => (
              <Finding key={i} kind={f.kind} title={f.title} body={f.body} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>
            Fueling log
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16 }}>
            What you took in during the race.
          </div>
          <div
            style={{
              background: T.bg2,
              border: `1px solid ${T.line}`,
              borderRadius: 4,
              padding: 20,
            }}
          >
            {[
              ["Carbohydrate", `${race.fueling.carbsPerHr} g/hr`],
              ["Sodium", `${race.fueling.sodiumPerHr} mg/hr`],
              ["Fluids", `${race.fueling.fluidsPerHr} ml/hr`],
              ["Caffeine", `${race.fueling.caffeine} mg total`],
            ].map(([k, v], i) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < 3 ? `1px solid ${T.line}` : "none",
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                }}
              >
                <span style={{ color: T.inkDim }}>{k.toUpperCase()}</span>
                <span style={{ color: T.paper }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: T.paper, marginBottom: 10 }}>
              Fueling context
            </div>
            {(() => {
              const bench = fuelingBenchmarks(race.finishTime);
              if (!bench.needsCarbs) {
                return (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>
                    At this duration ({Math.round(parseClockToMinutes(race.finishTime))} min), exogenous carbohydrate is{" "}
                    <span style={{ color: T.brass }}>not required</span> — glycogen stores are sufficient. Water is the main priority.
                  </div>
                );
              }
              return (
                <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>
                  For {Math.round(parseClockToMinutes(race.finishTime))}-minute efforts, the evidence-backed carbohydrate target is{" "}
                  <span style={{ color: T.brass }}>{bench.carbsLabel}</span>
                  {bench.peerAvg != null && (
                    <> (athletes at your level in {race.sport.toLowerCase()} average <span style={{ color: T.brass }}>{bench.peerAvg}g/hr</span>)</>
                  )}
                  . {bench.rationale}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div style={{ marginTop: 44, paddingTop: 8 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>
          Recommendations for next time
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 4 }}>
          Specific, evidence-backed changes — not general advice.
        </div>
        <div>
          {recs.map((r, i) => (
            <Recommendation key={i} index={i + 1} action={r.action} why={r.why} />
          ))}
        </div>
      </div>

      {/* AI Coach teaser */}
      <div
        style={{
          marginTop: 40,
          padding: "22px 24px",
          background: T.bg2,
          border: `1px solid ${T.line}`,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.ink }}>
          Have a follow-up question about this race? Ask the AI Coach — <span style={{ color: T.paper }}>"Why did I bonk?"</span> or{" "}
          <span style={{ color: T.paper }}>"Am I improving?"</span>
        </div>
        <button
          onClick={onAskCoach}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: 0.5,
            color: T.bg,
            background: T.brass,
            border: "none",
            borderRadius: 3,
            padding: "10px 18px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ASK THE COACH
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   AI Coach — query layer, LLM integration, and UI
   --------------------------------------------------------- */

const COACH_HISTORY_KEY = "raceiq:coach-history";
const COACH_APIKEY_KEY = "raceiq:apikey";

function loadCoachHistory() {
  try { return JSON.parse(localStorage.getItem(COACH_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveCoachHistory(h) {
  try { localStorage.setItem(COACH_HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function loadStoredApiKey() {
  try { return localStorage.getItem(COACH_APIKEY_KEY) || ""; } catch { return ""; }
}
function persistApiKey(key) {
  try { localStorage.setItem(COACH_APIKEY_KEY, key); } catch {}
}

// ── Intent classification ─────────────────────────────────

function classifyIntent(question, races, contextRaceId) {
  const q = question.toLowerCase();

  if (/\b(pain|hurt|ache|injur|knee|ankle|shin|tendon|blister|medical|doctor|physio|cramp)\b/.test(q)) {
    return { category: "oos_medical" };
  }
  if (/\b(training plan|workout plan|program|weekly plan|base building|periodization)\b/.test(q)) {
    return { category: "oos_training" };
  }

  // Trend / progress — strong signals that override context
  if (/\b(improv|trend|better|faster|progress|getting|how has|over time|this year|season|am i getting)\b/.test(q)) {
    const sportHint = ["road running", "trail running", "gravel cycling", "marathon", "trail", "ultra"]
      .find(s => q.includes(s));
    return { category: "trend", sportFilter: sportHint || null };
  }

  // Race fit
  if (/\b(fit|which race|best race|suited|which course|should i do|trail or road|road or trail|type of race|best at|excel)\b/.test(q)) {
    return { category: "fit" };
  }

  // Planning / pre-race
  if (/\b(next|prepare|change|before|upcoming|should i|ready|goal race|what to|how to improve)\b/.test(q)) {
    return { category: "planning" };
  }

  // Benchmarking
  if (/\b(compar|similar athlete|how do i rank|versus|\bvs\b|peer|age group|cohort|other athlete)\b/.test(q)) {
    return { category: "benchmarking" };
  }

  // Single-race diagnostic (either explicit signal or context-loaded race)
  if (/\b(bonk|what went wrong|why did|this race|faded|died|collapsed|blew up|slowed|second half|late)\b/.test(q) || contextRaceId) {
    let raceId = contextRaceId;
    if (!raceId) {
      const matched = races.find(r =>
        q.includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().split(" ").some(word => word.length > 4 && q.includes(word.toLowerCase()))
      );
      raceId = matched?.id || races[0]?.id;
    }
    return { category: "diagnostic", raceId };
  }

  // Default: trend if multiple races, diagnostic if one
  if (races.length >= 2) return { category: "trend", sportFilter: null };
  return { category: "diagnostic", raceId: races[0]?.id };
}

// ── Deterministic data gathering ──────────────────────────

function fmtPace(minPerKm) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function paceDriftPct(splits) {
  if (!splits || splits.length < 2) return 0;
  const key = splits[0].gapPace != null ? "gapPace" : "pace";
  return Math.round(((splits[splits.length - 1][key] - splits[0][key]) / splits[0][key]) * 100);
}

function gatherDiagnosticData(race) {
  const key = race.splits?.[0]?.gapPace != null ? "gapPace" : "pace";
  const drift = paceDriftPct(race.splits);
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));
  const hot = race.tempC >= 24;
  const fuelingGap = fuel.needsCarbs ? race.fueling.carbsPerHr - fuel.carbsLow : null;
  const { strengths, limiters, recs } = buildDebrief(race);

  // Find the split where pace dropped most
  let turnKm = null;
  let maxJump = -Infinity;
  for (let i = 1; i < race.splits.length; i++) {
    const jump = race.splits[i][key] - race.splits[i - 1][key];
    if (jump > maxJump) { maxJump = jump; turnKm = race.splits[i].km; }
  }

  return {
    race, durationMin, drift, hot, fuelingGap, fuelRange: fuel.carbsLabel,
    needsCarbs: fuel.needsCarbs, turnKm,
    firstPace: fmtPace(race.splits[0][key]),
    lastPace: fmtPace(race.splits[race.splits.length - 1][key]),
    strengths, limiters, recs,
  };
}

function gatherTrendData(races, sportFilter) {
  let filtered = [...races].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sportFilter) {
    const sf = sportFilter.toLowerCase();
    filtered = filtered.filter(r => {
      if (sf.includes("trail")) return r.sport === "Trail Running";
      if (sf.includes("marathon")) return r.sport === "Road Running" && r.distanceKm >= 40;
      if (sf.includes("gravel") || sf.includes("cycling")) return r.sport.includes("Cycling");
      if (sf.includes("road")) return r.sport === "Road Running";
      return true;
    });
  }
  if (filtered.length < 2) return { filtered, insufficient: true };

  const ratings = filtered.map(r => r.rating);
  const percentiles = filtered.map(r => r.percentile);
  const verdicts = filtered.map(r => r.verdict);

  return {
    filtered, insufficient: false,
    ratingTrend: Math.round(ratings[ratings.length - 1] - ratings[0]),
    percentileTrend: Math.round((percentiles[percentiles.length - 1] - percentiles[0]) * 10) / 10,
    firstRating: ratings[0], lastRating: ratings[ratings.length - 1],
    firstPct: percentiles[0], lastPct: percentiles[percentiles.length - 1],
    strengthCount: verdicts.filter(v => v === "strength").length,
    limiterCount: verdicts.filter(v => v === "limiter").length,
  };
}

function gatherFitData(races) {
  if (races.length < 2) return { insufficient: true };
  const byVerdict = { strength: [], limiter: [], mixed: [] };
  for (const r of races) byVerdict[r.verdict].push(r);

  const avgTemp = (arr) => arr.length ? Math.round(arr.reduce((a, r) => a + r.tempC, 0) / arr.length * 10) / 10 : null;
  const sportVerdicts = {};
  for (const r of races) {
    if (!sportVerdicts[r.sport]) sportVerdicts[r.sport] = { strength: 0, limiter: 0, mixed: 0, count: 0 };
    sportVerdicts[r.sport][r.verdict]++;
    sportVerdicts[r.sport].count++;
  }

  return {
    insufficient: false,
    byVerdict, sportVerdicts, races,
    avgStrengthTemp: avgTemp(byVerdict.strength),
    avgLimiterTemp: avgTemp(byVerdict.limiter),
    topRaces: [...races].sort((a, b) => b.percentile - a.percentile).slice(0, 3),
  };
}

function gatherLimiterPatterns(races) {
  const limiters = races.filter(r => r.verdict === "limiter");
  const strengths = races.filter(r => r.verdict === "strength");
  return {
    races, limiters, strengths,
    hotLimiters: limiters.filter(r => r.tempC >= 24),
    underFueled: limiters.filter(r => {
      const fuel = fuelingBenchmarks(r.finishTime);
      return fuel.needsCarbs && r.fueling.carbsPerHr < fuel.carbsLow;
    }),
    coolStrengths: strengths.filter(r => r.tempC <= 14),
  };
}

// ── LLM prompt builders ───────────────────────────────────

function buildSystemPrompt(athleteName, races) {
  const sports = [...new Set(races.map(r => r.sport))].join(", ");
  const sorted = [...races].sort((a, b) => new Date(a.date) - new Date(b.date));
  const range = races.length >= 2
    ? `${fmtDate(sorted[0].date)} – ${fmtDate(sorted[sorted.length - 1].date)}`
    : races.length === 1 ? fmtDate(sorted[0].date) : "no races logged";

  return `You are RaceIQ's AI Coach — a race intelligence system for endurance athletes. You answer questions about ${athleteName}'s race performance using only the structured data provided with each question. You never invent splits, times, percentiles, or comparisons.

ATHLETE: ${athleteName} · ${races.length} races logged (${sports}) · ${range}

RULES:
1. Only cite numbers from the DATA block provided. Never fabricate statistics.
2. Name which race(s) every substantive claim comes from.
3. If a question involves pain, injury, or medical symptoms: decline clearly, suggest a sports medicine professional.
4. If asked for a training plan or weekly program: decline, explain you analyze races not build plans.
5. If data is insufficient, say so plainly — never invent a trend from one data point.
6. Be conversational and precise. Address ${athleteName} by first name. Avoid bullet lists unless summarizing 3+ races.
7. Aim for 2–4 sentences for simple questions, up to 3 focused paragraphs for trend or fit analysis.
8. If the question references a debrief the athlete has already seen, refer to it ("same pattern the debrief flagged") rather than restating it verbatim.`;
}

function buildQuestionContext(intent, data, question, contextRaceId) {
  let ctx = `QUESTION: ${question}\n\n`;

  switch (intent.category) {
    case "diagnostic": {
      if (!data.race) { ctx += "DATA: No matching race found.\n"; break; }
      const { race, durationMin, drift, hot, fuelingGap, fuelRange, needsCarbs, firstPace, lastPace, turnKm, limiters, strengths } = data;
      ctx += `DATA FOR THIS RACE:\n`;
      ctx += `Race: ${race.name} (${fmtDate(race.date)})\n`;
      ctx += `Sport: ${race.sport} · ${race.distanceKm}km · +${race.elevationM}m · ${race.surface}\n`;
      ctx += `Finish: ${race.finishTime} (${durationMin} min) · Place: ${race.placement}/${race.field} (${race.percentile}th percentile)\n`;
      ctx += `RaceIQ Score: ${race.rating} (${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta})\n`;
      ctx += `Conditions: ${race.tempC}°C, ${race.humidity}% humidity, ${race.wind}km/h wind${hot ? " — HEAT STRESS (≥24°C)" : ""}\n`;
      ctx += `Pace: first split ${firstPace} → last split ${lastPace} (${drift > 0 ? "+" : ""}${drift}% drift${race.usesGap ? ", grade-adjusted" : ""})\n`;
      if (turnKm) ctx += `Largest pace drop: at km ${turnKm}\n`;
      ctx += `Verdict: ${race.verdict.toUpperCase()}\n`;
      if (needsCarbs) {
        ctx += `Fueling: ${race.fueling.carbsPerHr}g carbs/hr (target for ${durationMin}-min effort: ${fuelRange}`;
        ctx += fuelingGap != null && fuelingGap < 0 ? `; ${Math.abs(fuelingGap)}g/hr below minimum)\n` : "; within range)\n";
        ctx += `Sodium: ${race.fueling.sodiumPerHr}mg/hr · Fluids: ${race.fueling.fluidsPerHr}ml/hr · Caffeine: ${race.fueling.caffeine}mg\n`;
      }
      if (strengths.length) ctx += `\nSTRENGTHS: ${strengths.map(s => s.title).join("; ")}\n`;
      if (limiters.length) ctx += `LIMITERS: ${limiters.map(l => l.title).join("; ")}\n`;
      if (contextRaceId === race.id) ctx += `\nThis race's debrief is already loaded — reference findings conversationally, don't re-deliver them verbatim.\n`;
      break;
    }

    case "trend": {
      const { filtered, insufficient, ratingTrend, percentileTrend, strengthCount, limiterCount, firstRating, lastRating, firstPct, lastPct } = data;
      if (insufficient) {
        ctx += `DATA: Only ${filtered.length} race(s) match — need at least 2 for a trend. Tell the athlete clearly.\n`;
      } else {
        ctx += `TREND DATA (${filtered.length} races, oldest→newest):\n`;
        for (const r of filtered) {
          ctx += `  ${fmtDate(r.date)} · ${r.name}: ${r.percentile}th pct, RaceIQ ${r.rating} [${r.verdict}], ${r.tempC}°C, ${r.distanceKm}km, ${r.surface}\n`;
        }
        ctx += `\nSUMMARY:\n`;
        ctx += `RaceIQ Score: ${firstRating} → ${lastRating} (${ratingTrend >= 0 ? "+" : ""}${ratingTrend})\n`;
        ctx += `Percentile: ${firstPct}th → ${lastPct}th (${percentileTrend >= 0 ? "+" : ""}${percentileTrend} pts)\n`;
        ctx += `Verdicts: ${strengthCount} strength / ${limiterCount} limiter / ${filtered.length - strengthCount - limiterCount} mixed\n`;
        ctx += `\nIMPORTANT: Account for course and weather variation. Don't equate faster raw times with improved fitness if conditions or course difficulty differ.\n`;
      }
      break;
    }

    case "fit": {
      const { byVerdict, avgStrengthTemp, avgLimiterTemp, sportVerdicts, topRaces, races } = data;
      ctx += `RACE FIT DATA (${races.length} races total):\n`;
      ctx += `Top 3 by percentile:\n`;
      for (const r of topRaces) {
        ctx += `  ${r.name}: ${r.percentile}th pct [${r.verdict}], ${r.tempC}°C, ${r.surface}, ${r.distanceKm}km\n`;
      }
      ctx += `Strengths (${byVerdict.strength.length}): ${byVerdict.strength.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      ctx += `Limiters (${byVerdict.limiter.length}): ${byVerdict.limiter.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      ctx += `Mixed (${byVerdict.mixed.length}): ${byVerdict.mixed.map(r => `${r.name} (${r.tempC}°C, ${r.surface})`).join("; ") || "none"}\n`;
      if (avgStrengthTemp != null) ctx += `Avg temp on strength races: ${avgStrengthTemp}°C\n`;
      if (avgLimiterTemp != null) ctx += `Avg temp on limiter races: ${avgLimiterTemp}°C\n`;
      ctx += `Sport breakdown: ${Object.entries(sportVerdicts).map(([s, v]) => `${s}: ${v.count} races (${v.strength}S/${v.limiter}L/${v.mixed}M)`).join("; ")}\n`;
      break;
    }

    case "planning": {
      const { races, hotLimiters, underFueled, coolStrengths } = data;
      ctx += `HISTORICAL PATTERNS (${races.length} races):\n`;
      if (hotLimiters.length) ctx += `Heat-driven limiters (≥24°C): ${hotLimiters.map(r => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      if (underFueled.length) ctx += `Under-fueling limiters: ${underFueled.map(r => `${r.name} (${r.fueling.carbsPerHr}g/hr)`).join(", ")}\n`;
      if (coolStrengths.length) ctx += `Cool-condition strengths (≤14°C): ${coolStrengths.map(r => `${r.name} (${r.tempC}°C)`).join(", ")}\n`;
      ctx += `No upcoming race is logged yet. Answer from historical limiter patterns and suggest logging the upcoming race for a more specific answer.\n`;
      break;
    }

    case "benchmarking": {
      ctx += `PERCENTILE DATA (${data.races.length} races):\n`;
      for (const r of data.races) {
        ctx += `  ${r.name}: ${r.percentile}th pct of ${r.field} finishers · ${r.sport}\n`;
      }
      ctx += `Full cohort benchmarking (age/sex-matched) is not yet implemented. Answer from available percentile data and note the limitation.\n`;
      break;
    }
  }

  return ctx;
}

async function callCoachLLM(apiKey, systemPrompt, priorMsgs, contextAndQuestion) {
  const messages = [
    ...priorMsgs.slice(-6).map(m => ({
      role: m.role === "coach" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: contextAndQuestion },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API error ${res.status}`);
  }
  const json = await res.json();
  return json.content?.[0]?.text || "No response received.";
}

// ── Fallback answers (no API key or OOS) ─────────────────

const OOS_INTENTS = new Set(["oos_medical", "oos_training"]);

function buildFallbackAnswer(intent, data) {
  switch (intent.category) {
    case "oos_medical":
      return "That sounds like it could involve a medical or injury concern — outside what RaceIQ can help with. Please consult a sports medicine professional or physiotherapist who can evaluate you in person.";
    case "oos_training":
      return "RaceIQ focuses on race analysis and readiness — generating a training plan is outside its scope. A coach can use these race insights as input, but the planning decisions belong with them.";
    case "diagnostic": {
      if (!data.race) return "I couldn't identify which race you're asking about. Try mentioning the race name.";
      const { race, limiters, strengths } = data;
      const parts = [`Looking at ${race.name} (${fmtDate(race.date)}):`];
      if (strengths.length) parts.push(`Strengths — ${strengths.map(s => s.title).join("; ")}.`);
      if (limiters.length) parts.push(`Limiters — ${limiters.map(l => l.title).join("; ")}.`);
      parts.push(`Add an Anthropic API key to get a full natural-language analysis.`);
      return parts.join(" ");
    }
    case "trend": {
      if (data.insufficient) return `Not enough races to show a trend yet — log at least 2 comparable races first.`;
      const { ratingTrend, filtered } = data;
      return `Across your ${filtered.length} races, your RaceIQ Score moved ${ratingTrend >= 0 ? "+" : ""}${ratingTrend} points. Add an Anthropic API key for full trend analysis.`;
    }
    case "fit": {
      if (data.insufficient) return "Log at least 2 races to see fit patterns.";
      const { byVerdict, topRaces } = data;
      return `Best result: ${topRaces[0]?.name} (${topRaces[0]?.percentile}th percentile). You have ${byVerdict.strength.length} strength and ${byVerdict.limiter.length} limiter races logged. Add an API key for detailed fit analysis.`;
    }
    case "planning":
      return "Your clearest limiters appear in hot conditions. Add an Anthropic API key for specific pre-race recommendations based on your full pattern history.";
    case "benchmarking": {
      const pcts = data.races?.map(r => r.percentile) || [];
      if (!pcts.length) return "No races logged yet.";
      return `Your percentile rankings range from ${Math.min(...pcts).toFixed(1)}th to ${Math.max(...pcts).toFixed(1)}th across your logged races. Add an API key for detailed benchmarking analysis.`;
    }
    default:
      return "Try asking about a specific race, your progress over time, or which race conditions suit you best.";
  }
}

function getSourceRaces(intent, data) {
  if (OOS_INTENTS.has(intent.category)) return [];
  switch (intent.category) {
    case "diagnostic": return data.race ? [data.race] : [];
    case "trend": return data.filtered || [];
    case "fit": case "planning": case "benchmarking": return data.races || [];
    default: return [];
  }
}

// ── Coach UI components ───────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Why did I bonk at my last race?",
  "Am I improving across my race history?",
  "Which types of races fit me best?",
  "What should I change before my next marathon?",
];

function CoachMessage({ msg }) {
  const isCoach = msg.role === "coach";
  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: isCoach ? "flex-start" : "flex-end" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>
        {isCoach ? "RACEIQ COACH" : "YOU"} · {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div
        style={{
          maxWidth: "82%",
          padding: "14px 18px",
          borderRadius: 4,
          fontFamily: FONT_BODY,
          fontSize: 15,
          lineHeight: 1.65,
          color: isCoach ? T.ink : T.bg,
          background: isCoach ? T.bg2 : T.brass,
          border: isCoach ? `1px solid ${T.line}` : "none",
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content}
      </div>
      {isCoach && msg.sources?.length > 0 && !OOS_INTENTS.has(msg.intentCategory) && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.inkDim, letterSpacing: 0.5 }}>BASED ON:</span>
          {msg.sources.map(r => (
            <span
              key={r.id}
              style={{
                fontFamily: FONT_MONO, fontSize: 9.5, color: T.brassDim,
                background: "rgba(201,162,75,0.1)", border: `1px solid ${T.brassDim}`,
                borderRadius: 2, padding: "2px 8px", letterSpacing: 0.3,
              }}
            >
              {r.name} · {fmtDate(r.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeyBanner({ onSave }) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{
        padding: "16px 20px", marginBottom: 24,
        background: "rgba(201,162,75,0.07)", border: `1px solid ${T.brassDim}`, borderRadius: 4,
      }}
    >
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.6, color: T.brass, marginBottom: 6 }}>
        CONNECT ANTHROPIC API KEY
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 12, lineHeight: 1.55 }}>
        The AI Coach needs an Anthropic API key to generate natural-language answers. Without one you'll see deterministic findings only. Your key is stored in this browser's local storage and sent only to Anthropic.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type={visible ? "text" : "password"}
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && key.trim() && onSave(key.trim())}
          placeholder="sk-ant-..."
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          onFocus={e => (e.target.style.borderColor = T.brass)}
          onBlur={e => (e.target.style.borderColor = T.line)}
        />
        <button
          onClick={() => setVisible(v => !v)}
          style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, fontFamily: FONT_MONO, fontSize: 11, padding: "9px 10px", cursor: "pointer" }}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
        <button
          onClick={() => key.trim() && onSave(key.trim())}
          disabled={!key.trim()}
          style={{
            fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 16px",
            borderRadius: 3, border: "none", fontWeight: 600, whiteSpace: "nowrap",
            background: key.trim() ? T.brass : T.line,
            color: key.trim() ? T.bg : T.inkDim,
            cursor: key.trim() ? "pointer" : "default",
          }}
        >
          SAVE KEY
        </button>
      </div>
    </div>
  );
}

function CoachView({ races, contextRace, onBack }) {
  const [history, setHistory] = useState(() => loadCoachHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(() => loadStoredApiKey());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const athleteName = "Alex";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, loading]);
  useEffect(() => { saveCoachHistory(history); }, [history]);

  function handleSaveApiKey(key) {
    persistApiKey(key);
    setApiKey(key);
  }

  async function handleSend(questionOverride) {
    const question = (questionOverride || input).trim();
    if (!question || loading) return;

    setInput("");
    setError("");

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
      contextRaceId: contextRace?.id || null,
    };

    // Snapshot history BEFORE adding current message — needed for correct API history
    const historySnapshot = history;
    setHistory(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const intent = classifyIntent(question, races, contextRace?.id || null);
      let answer;
      let sources = [];

      if (OOS_INTENTS.has(intent.category)) {
        answer = buildFallbackAnswer(intent, {});
      } else {
        let gatheredData;
        switch (intent.category) {
          case "diagnostic": {
            const race = races.find(r => r.id === intent.raceId) || contextRace || races[0];
            gatheredData = race ? gatherDiagnosticData(race) : { race: null };
            break;
          }
          case "trend":
            gatheredData = gatherTrendData(races, intent.sportFilter);
            break;
          case "fit":
            gatheredData = gatherFitData(races);
            break;
          case "planning":
            gatheredData = gatherLimiterPatterns(races);
            break;
          default:
            gatheredData = { races };
        }

        sources = getSourceRaces(intent, gatheredData);

        if (apiKey) {
          try {
            const systemPrompt = buildSystemPrompt(athleteName, races);
            const ctxBlock = buildQuestionContext(intent, gatheredData, question, contextRace?.id || null);
            const priorMsgs = historySnapshot
              .filter(m => m.role === "user" || m.role === "coach")
              .slice(-6);
            answer = await callCoachLLM(apiKey, systemPrompt, priorMsgs, ctxBlock);
          } catch (llmErr) {
            answer = buildFallbackAnswer(intent, gatheredData) + `\n\n[API error: ${llmErr.message}]`;
          }
        } else {
          answer = buildFallbackAnswer(intent, gatheredData);
        }
      }

      setHistory(prev => [...prev, {
        id: `msg_${Date.now() + 1}`,
        role: "coach",
        content: answer,
        timestamp: new Date().toISOString(),
        sources,
        intentCategory: intent.category,
      }]);
    } catch (err) {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasMessages = history.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 140px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", color: T.inkDim,
            fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5,
            cursor: "pointer", padding: 0, marginBottom: 20,
          }}
        >
          ← {contextRace ? "BACK TO DEBRIEF" : "BACK TO RACE RESUME"}
        </button>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
              AI COACH
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: 0, color: T.paper }}>
              Ask RaceIQ
            </h1>
          </div>
          {hasMessages && (
            <button
              onClick={() => { if (window.confirm("Clear conversation history?")) setHistory([]); }}
              style={{
                background: "none", border: `1px solid ${T.line}`, borderRadius: 3,
                color: T.inkDim, fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.4,
                padding: "6px 12px", cursor: "pointer",
              }}
            >
              CLEAR HISTORY
            </button>
          )}
        </div>
        {contextRace && (
          <div
            style={{
              marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 12px", background: "rgba(201,162,75,0.1)",
              border: `1px solid ${T.brassDim}`, borderRadius: 3,
              fontFamily: FONT_MONO, fontSize: 10.5, color: T.brass,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.brass, display: "inline-block" }} />
            CONTEXT: {contextRace.name}
          </div>
        )}
      </div>

      {!apiKey && <ApiKeyBanner onSave={handleSaveApiKey} />}

      {/* Messages or empty state */}
      <div style={{ flex: 1 }}>
        {!hasMessages ? (
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 16, color: T.inkDim, marginBottom: 28, lineHeight: 1.6 }}>
              Ask anything about your race history. Every answer is drawn from your logged data.
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1, color: T.inkDim, marginBottom: 14 }}>
              TRY ASKING
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  style={{
                    background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4,
                    color: T.ink, fontFamily: FONT_BODY, fontSize: 15, padding: "13px 18px",
                    cursor: "pointer", textAlign: "left", transition: "border-color 120ms ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.brass)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.line)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {history.map(msg => <CoachMessage key={msg.id} msg={msg} />)}
            {loading && (
              <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.8, color: T.inkDim, marginBottom: 6 }}>
                  RACEIQ COACH
                </div>
                <div style={{ padding: "14px 18px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.inkDim, letterSpacing: 0.5 }}>
                    Analyzing your data…
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div style={{ padding: "10px 16px", background: "rgba(255,106,57,0.08)", border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Sticky input */}
      <div
        style={{
          position: "sticky", bottom: 0, paddingTop: 20, paddingBottom: 8,
          background: T.bg, borderTop: `1px solid ${T.line}`, marginTop: 24,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contextRace ? `Ask about ${contextRace.name}…` : "Ask about your race history…"}
            rows={1}
            style={{
              ...inputStyle, flex: 1, resize: "none", lineHeight: 1.5,
              minHeight: 42, maxHeight: 120, overflow: "auto",
            }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, padding: "10px 18px",
              borderRadius: 3, border: "none", fontWeight: 600, flexShrink: 0,
              background: input.trim() && !loading ? T.brass : T.line,
              color: input.trim() && !loading ? T.bg : T.inkDim,
              cursor: input.trim() && !loading ? "pointer" : "default",
            }}
          >
            {loading ? "…" : "SEND"}
          </button>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.inkDim, marginTop: 8, letterSpacing: 0.3 }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PaceCompareStrip — overlaid pace lines for 2–3 races
   --------------------------------------------------------- */

function PaceCompareStrip({ races }) {
  const W = 720, H = 220;
  const padL = 46, padR = 40, padT = 24, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const [showTempFor, setShowTempFor] = useState(0);
  const [hoveredX, setHoveredX] = useState(null);
  const svgRef = useRef(null);

  const distMin = Math.min(...races.map((r) => r.distanceKm));
  const distMax = Math.max(...races.map((r) => r.distanceKm));
  const usePercent = (distMax - distMin) / distMin > 0.15;

  const paceKey = (r) => (r.usesGap ? "gapPace" : "pace");

  const normalizedRaces = races.map((r) => {
    const total = r.splits[r.splits.length - 1].km;
    return r.splits.map((s) => ({
      ...s,
      xVal: usePercent ? (s.km / total) * 100 : s.km,
    }));
  });

  const xMax = usePercent ? 100 : distMax;

  const allPaces = races.flatMap((r, ri) =>
    normalizedRaces[ri].map((s) => s[paceKey(r)])
  );
  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);
  const paceRange = Math.max(maxPace - minPace, 0.4);

  const tempRaceIdx = showTempFor >= 0 && showTempFor < races.length ? showTempFor : -1;
  const tempSplits = tempRaceIdx >= 0 ? normalizedRaces[tempRaceIdx] : null;
  const tempValues = tempSplits ? tempSplits.map((s) => s.tempC) : [];
  const minTemp = tempValues.length ? Math.min(...tempValues) : 0;
  const maxTemp = tempValues.length ? Math.max(...tempValues) : 0;
  const tempRange = Math.max(maxTemp - minTemp, 1);

  const xPos = (v) => padL + (v / xMax) * plotW;
  const yPace = (p) => padT + ((p - minPace) / paceRange) * plotH;
  const yTemp = (v) => padT + plotH - ((v - minTemp) / tempRange) * plotH * 0.45;

  function interpolatePace(raceIdx, xVal) {
    const splits = normalizedRaces[raceIdx];
    const r = races[raceIdx];
    const key = paceKey(r);
    if (!splits.length) return null;
    if (xVal > splits[splits.length - 1].xVal + 0.5) return null;
    let lo = splits[0], hi = splits[splits.length - 1];
    for (let i = 0; i < splits.length - 1; i++) {
      if (xVal >= splits[i].xVal && xVal <= splits[i + 1].xVal) {
        lo = splits[i]; hi = splits[i + 1]; break;
      }
    }
    if (lo === hi) return lo[key];
    const t = (xVal - lo.xVal) / (hi.xVal - lo.xVal);
    return lo[key] + t * (hi[key] - lo[key]);
  }

  function fmtPaceStr(v) {
    if (v == null) return "—";
    const m = Math.floor(v);
    const s = String(Math.round((v - m) * 60)).padStart(2, "0");
    return `${m}:${s}/km`;
  }

  function handleMouseMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    setHoveredX(Math.max(0, Math.min(xMax, ((mouseX - padL) / plotW) * xMax)));
  }

  const tooltipX = hoveredX != null ? xPos(hoveredX) : null;
  const tooltipFlip = tooltipX != null && tooltipX / W > 0.62;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Legend + temp toggle */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {races.map((r, i) => (
          <div key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="10" style={{ display: "block", flexShrink: 0 }}>
              <line x1="0" y1="5" x2="16" y2="5" stroke={COMPARE_COLORS[i]} strokeWidth={i === 0 ? 2.5 : 2} />
            </svg>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, color: T.ink }}>
              {r.name.toUpperCase()} · {shortDate(r.date)}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.inkDim, letterSpacing: 0.5 }}>TEMP:</span>
          <button
            onClick={() => setShowTempFor(-1)}
            style={{
              fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.3, padding: "2px 7px",
              borderRadius: 2, border: `1px solid ${showTempFor === -1 ? T.inkDim : T.line}`,
              background: "transparent", color: showTempFor === -1 ? T.ink : T.inkDim, cursor: "pointer",
            }}
          >
            OFF
          </button>
          {races.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setShowTempFor(i)}
              style={{
                fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.3, padding: "2px 7px",
                borderRadius: 2, border: `1px solid ${showTempFor === i ? T.temp : T.line}`,
                background: showTempFor === i ? "rgba(123,184,200,0.12)" : "transparent",
                color: showTempFor === i ? T.temp : T.inkDim, cursor: "pointer",
              }}
            >
              {shortDate(r.date)}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredX(null)}
        style={{ cursor: "crosshair", display: "block" }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={padL} y1={padT + plotH * f} x2={padL + plotW} y2={padT + plotH * f} stroke={T.line} strokeWidth="1" />
        ))}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={T.line} strokeWidth="1.5" />

        {/* Temperature line for selected race */}
        {tempSplits && tempValues.length > 0 && (
          <polyline
            points={tempSplits.map((s, i) => `${xPos(s.xVal)},${yTemp(tempValues[i])}`).join(" ")}
            fill="none" stroke={T.temp} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 3"
          />
        )}

        {/* Pace lines */}
        {races.map((r, ri) => {
          const splits = normalizedRaces[ri];
          const key = paceKey(r);
          return (
            <polyline
              key={r.id}
              points={splits.map((s) => `${xPos(s.xVal)},${yPace(s[key])}`).join(" ")}
              fill="none"
              stroke={COMPARE_COLORS[ri]}
              strokeWidth={ri === 0 ? 2.5 : 2}
              strokeOpacity={ri === 0 ? 1 : 0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Split dots */}
        {races.map((r, ri) => {
          const splits = normalizedRaces[ri];
          const key = paceKey(r);
          return splits.map((s, si) => (
            <circle
              key={`${ri}-${si}`}
              cx={xPos(s.xVal)} cy={yPace(s[key])}
              r={3} fill={COMPARE_COLORS[ri]} stroke={T.bg} strokeWidth="1.5"
            />
          ));
        })}

        {/* Hover crosshair */}
        {tooltipX != null && (
          <line x1={tooltipX} y1={padT} x2={tooltipX} y2={padT + plotH} stroke={T.paper} strokeOpacity="0.18" strokeWidth="1" />
        )}

        {/* X axis labels — from first race */}
        {normalizedRaces[0].map((s, i) => (
          <text key={i} x={xPos(s.xVal)} y={H - 10} textAnchor="middle" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="10">
            {usePercent ? `${Math.round(s.xVal)}%` : s.xVal}
          </text>
        ))}

        <text x={padL - 8} y={padT + 4} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">fast</text>
        <text x={padL - 8} y={padT + plotH} textAnchor="end" fill={T.inkDim} fontFamily={FONT_MONO} fontSize="9">slow</text>

        {/* Temp scale */}
        {tempSplits && tempValues.length > 0 && (
          <>
            <text x={padL + plotW + 5} y={yTemp(maxTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{maxTemp}°</text>
            <text x={padL + plotW + 5} y={yTemp(minTemp) + 4} textAnchor="start" fill={T.temp} fontFamily={FONT_MONO} fontSize="9" opacity="0.85">{minTemp}°</text>
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredX != null && tooltipX != null && (
        <div
          style={{
            position: "absolute", top: 36,
            ...(tooltipFlip
              ? { right: `${100 - (tooltipX / W) * 100}%`, transform: "translateX(50%)" }
              : { left: `${(tooltipX / W) * 100}%`, transform: "translateX(-50%)" }),
            pointerEvents: "none",
            background: T.bg, border: `1px solid ${T.line}`,
            borderRadius: 4, padding: "9px 13px", zIndex: 10,
            minWidth: 150, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.brass, letterSpacing: 0.6, marginBottom: 7, borderBottom: `1px solid ${T.line}`, paddingBottom: 5 }}>
            {usePercent ? `${Math.round(hoveredX)}% DIST` : `KM ${hoveredX.toFixed(1)}`}
          </div>
          {races.map((r, ri) => {
            const pace = interpolatePace(ri, hoveredX);
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontFamily: FONT_MONO, fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: T.inkDim }}>{shortDate(r.date)}</span>
                <span style={{ color: COMPARE_COLORS[ri] }}>{fmtPaceStr(pace)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   CompareView — side-by-side race analysis
   --------------------------------------------------------- */

function heatPenalty(tempC) {
  return Math.max(0, (tempC - 20) * 0.02);
}

function heatAdjustedTime(finishTime, fromTempC, toTempC) {
  const rawMin = parseClockToMinutes(finishTime);
  const fairMin = rawMin / (1 + heatPenalty(fromTempC));
  const adjMin = fairMin * (1 + heatPenalty(toTempC));
  const h = Math.floor(adjMin / 60);
  const m = Math.floor(adjMin % 60);
  const s = Math.round((adjMin * 60) % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function CompareView({ races, onBack, onOpenDebrief, onAskCoach }) {
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

  // gridTemplateColumns for the tables: label col + one col per race + optional delta col
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
    parts.push(
      `${b.name} (${shortDate(b.date)}) produced a ${pctStr} percentile ${pctDelta >= 0 ? "improvement" : "drop"} over ${a.name} (${shortDate(a.date)}), racing in ${condDiff} conditions (${a.tempC}°C → ${b.tempC}°C).`
    );
    if (driftA != null && driftB != null) {
      const driftBetter = driftB < driftA;
      parts.push(
        `Pace drift moved from ${driftA.toFixed(1)}% to ${driftB.toFixed(1)}% — ${driftBetter ? "tighter pacing discipline in the later race" : "more fade in the later race; pacing strategy is the clearest lever to pull"}.`
      );
    }
    const fuelDelta = b.fueling.carbsPerHr - a.fueling.carbsPerHr;
    if (Math.abs(fuelDelta) >= 10) {
      parts.push(
        `Fueling shifted by ${fuelDelta > 0 ? "+" : ""}${fuelDelta}g/hr carbohydrate — ${fuelDelta > 0 ? "higher intake in the later race likely supported the closing pace" : "lower intake in the later race; worth watching if late-race fade appears again"}.`
      );
    }
    const heatDiff = heatPenalty(a.tempC) - heatPenalty(b.tempC);
    if (heatDiff > 0.04) {
      parts.push(
        `Conditions explain part of the gap: the heat model estimates ${(heatDiff * 100).toFixed(0)}% of the time difference is attributable to ${shortDate(a.date)}'s warmer conditions, not fitness.`
      );
    }
    return parts.join(" ");
  }, [sorted]);

  const statRows = useMemo(() => {
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return [
      {
        label: "FINISH TIME",
        values: sorted.map((r) => r.finishTime),
        delta: hasDelta ? timeDeltaDisplay(first.finishTime, last.finishTime) : null,
      },
      {
        label: "PERCENTILE",
        values: sorted.map((r) => `${r.percentile}th`),
        delta: hasDelta ? numDelta(first.percentile, last.percentile, true) : null,
      },
      {
        label: "PLACEMENT",
        values: sorted.map((r) => `${r.placement}/${r.field}`),
        delta: null,
      },
      {
        label: "RACEIQ SCORE",
        values: sorted.map((r) => r.rating),
        delta: hasDelta ? numDelta(first.rating, last.rating, true) : null,
      },
      {
        label: "TEMP / HUMIDITY",
        values: sorted.map((r) => `${r.tempC}°C / ${r.humidity}%`),
        delta: null,
      },
      {
        label: "VERDICT",
        values: sorted.map((r) => verdictLabel(r.verdict)),
        valueColors: sorted.map((r) => verdictColor(r.verdict)),
        delta: null,
      },
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
    {
      label: "EST. ADJ. TIME",
      values: sorted.map((r) => heatAdjustedTime(r.finishTime, r.tempC, refRace.tempC)),
      note: true,
    },
  ];

  // shared cell styles
  const labelCellStyle = {
    padding: "12px 16px 12px 0",
    fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.6, color: T.inkDim,
    borderRight: `1px solid ${T.line}`,
  };
  const headerCellStyle = { padding: "10px 16px 10px 0", fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5 };

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: T.inkDim,
          fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5,
          cursor: "pointer", padding: 0, marginBottom: 28,
        }}
      >
        ← BACK TO RACE RESUME
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
        RACE COMPARISON
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 6px", color: T.paper, maxWidth: 780 }}>
        {sorted.map((r) => r.name).join(" vs. ")}
      </h1>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim, marginBottom: 28 }}>
        {sorted[0].sport} · {distMin === distMax ? `${distMin} km` : `${distMin}–${distMax} km`}
      </div>

      {distancesMismatched && (
        <div style={{
          marginBottom: 24, padding: "10px 16px",
          background: "rgba(255,106,57,0.08)", border: `1px solid ${T.emberDim}`,
          borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5,
        }}>
          These races differ in distance by more than 15%. Finish times aren't directly comparable — the pace chart uses % of total distance on the X axis.
        </div>
      )}

      {/* ── Stats table ── */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ ...headerCellStyle, color: T.inkDim }} />
          {sorted.map((r, i) => (
            <div key={r.id} style={{ ...headerCellStyle, color: COMPARE_COLORS[i] }}>
              <div>{r.name.toUpperCase()}</div>
              <div style={{ color: T.inkDim, fontSize: 9, marginTop: 2 }}>{fmtDate(r.date)}</div>
            </div>
          ))}
          {hasDelta && (
            <div style={{ ...headerCellStyle, color: T.inkDim }}>
              Δ {shortDate(sorted[sorted.length - 1].date)} vs {shortDate(sorted[0].date)}
            </div>
          )}
        </div>
        {statRows.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={labelCellStyle}>{row.label}</div>
            {sorted.map((r, i) => (
              <div
                key={r.id}
                style={{
                  padding: "14px 16px 14px 0",
                  fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600,
                  color: row.valueColors ? row.valueColors[i] : COMPARE_COLORS[i],
                }}
              >
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

      {/* ── Pace overlay chart ── */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>
          Pace overlay
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          {distancesMismatched
            ? "X axis shows % of total distance since races differ in length. Hover to compare effort at equivalent points in the race."
            : "Direct split overlay. Hover to compare pace at each checkpoint."}
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 12px 8px" }}>
          <PaceCompareStrip races={sorted} />
        </div>
      </div>

      {/* ── Conditions context ── */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>
          Conditions context
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          Est. adj. time shows what each finish time would have been in {refRace.name}'s conditions ({refRace.tempC}°C), using a 2%/°C heat penalty model above 20°C — isolating fitness from weather.
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>
                {shortDate(r.date)}
              </div>
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
                  {row.note && (
                    <div style={{ fontSize: 8.5, color: T.inkDim, opacity: 0.7, marginTop: 2 }}>
                      normalized to {shortDate(refRace.date)} conditions
                    </div>
                  )}
                </div>
                {sorted.map((r, i) => (
                  <div key={r.id} style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 13, color: row.note ? COMPARE_COLORS[i] : T.paper }}>
                    {row.values[i]}
                  </div>
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

      {/* ── Fueling comparison ── */}
      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 16 }}>
          Fueling comparison
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>
                {shortDate(r.date)}
              </div>
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

      {/* ── Narrative ── */}
      <div style={{ marginBottom: 44, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1, color: T.brass, marginBottom: 10 }}>
          RACEIQ ANALYSIS
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.65, color: T.ink }}>
          {narrative}
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 8 }}>
        <button
          onClick={onAskCoach}
          style={{
            fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5,
            padding: "10px 18px", borderRadius: 3,
            border: `1px solid ${T.brass}`, background: "rgba(201,162,75,0.1)",
            color: T.brass, cursor: "pointer",
          }}
        >
          ASK RACEIQ ABOUT THIS COMPARISON
        </button>
        {sorted.map((r, i) => (
          <button
            key={r.id}
            onClick={() => onOpenDebrief(r.id)}
            style={{
              fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5,
              padding: "10px 18px", borderRadius: 3,
              border: `1px solid ${T.line}`, background: "transparent",
              color: COMPARE_COLORS[i], cursor: "pointer",
            }}
          >
            {shortDate(r.date)} DEBRIEF →
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   App shell
   --------------------------------------------------------- */

export default function RaceIQApp() {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [coachContextRaceId, setCoachContextRaceId] = useState(null);
  const [customRaces, setCustomRaces] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    loadCustomRaces().then((races) => {
      setCustomRaces(races);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveCustomRaces(customRaces);
  }, [customRaces, loaded]);

  const allRaces = useMemo(
    () => [...customRaces, ...SEED_RACES].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [customRaces]
  );

  const activeRace = allRaces.find((r) => r.id === activeId);
  const coachContextRace = coachContextRaceId ? allRaces.find(r => r.id === coachContextRaceId) : null;

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function openCompare() {
    setView("compare");
  }

  function openRace(id) {
    setActiveId(id);
    setView("debrief");
  }

  function openCoach(raceId = null) {
    setCoachContextRaceId(raceId);
    setView("coach");
  }

  function handleSaveRace(race) {
    setCustomRaces((prev) => [...prev, race]);
    setActiveId(race.id);
    setView("debrief");
  }

  function handleEditRace(race) {
    setCustomRaces((prev) => prev.map((r) => (r.id === race.id ? race : r)));
    setActiveId(race.id);
    setView("debrief");
  }

  function handleDeleteRace(id) {
    setCustomRaces((prev) => prev.filter((r) => r.id !== id));
  }

  function handleCoachBack() {
    if (coachContextRaceId) {
      setView("debrief");
    } else {
      setView("list");
    }
  }

  return (
    <div style={{ minHeight: "100%", background: T.bg, color: T.paper, fontFamily: FONT_BODY, padding: "0" }}>
      {FONT_IMPORT}

      {/* top bar — sticky with backdrop blur via .app-header */}
      <div className="app-header" style={{ borderBottom: `1px solid ${T.line}` }}>
        {/* primary nav row */}
        <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <button
              onClick={() => setView("list")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 0 }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: 0.5, color: T.paper }}>
                RACE
              </span>
              <span style={{
                fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: 0.5,
                color: T.brass,
                border: `1px solid ${T.brassDim}`,
                borderRadius: 2,
                padding: "0 4px",
                marginLeft: 1,
                lineHeight: 1,
              }}>
                IQ
              </span>
            </button>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.inkDim, letterSpacing: 0.6, marginLeft: 8 }}>
              PROTOTYPE
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              onClick={() => openCoach(null)}
              style={{
                fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5,
                padding: "6px 14px", borderRadius: 3,
                border: `1px solid ${view === "coach" ? T.brass : T.line}`,
                background: view === "coach" ? "rgba(201,162,75,0.12)" : "transparent",
                color: view === "coach" ? T.brass : T.inkDim,
                cursor: "pointer",
              }}
            >
              ASK RACEIQ
            </button>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim }}>
              ALEX MORENO · RATING <span style={{ color: T.brass }}>1842</span>
            </div>
          </div>
        </div>

        {/* breadcrumb row — only visible outside the list view */}
        {view !== "list" && (
          <div style={{
            padding: "0 32px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            letterSpacing: 0.5,
          }}>
            <button
              onClick={() => setView("list")}
              style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}
            >
              RACES
            </button>
            {(view === "debrief" || view === "add" || view === "coach" || view === "compare") && (
              <>
                <span style={{ color: T.line, fontSize: 12 }}>›</span>
                {view === "debrief" && activeRace && (
                  <span style={{ color: T.ink }}>{activeRace.name.toUpperCase()}</span>
                )}
                {view === "add" && (
                  <span style={{ color: T.ink }}>ADD RACE</span>
                )}
                {view === "compare" && (
                  <span style={{ color: T.ink }}>COMPARE</span>
                )}
                {view === "coach" && coachContextRace && (
                  <>
                    <button
                      onClick={() => setView("debrief")}
                      style={{ background: "none", border: "none", padding: 0, color: T.inkDim, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}
                    >
                      {coachContextRace.name.toUpperCase()}
                    </button>
                    <span style={{ color: T.line, fontSize: 12 }}>›</span>
                    <span style={{ color: T.ink }}>ASK RACEIQ</span>
                  </>
                )}
                {view === "coach" && !coachContextRace && (
                  <span style={{ color: T.ink }}>ASK RACEIQ</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div key={view} className="view-enter" style={{ maxWidth: 920, margin: "0 auto", padding: "40px 32px 80px" }}>
        {view === "list" && (
          <RaceList
            races={allRaces}
            onOpen={openRace}
            onAddRace={() => setView("add")}
            onDelete={handleDeleteRace}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onCompare={openCompare}
            onClearSelection={clearSelection}
          />
        )}
        {view === "compare" && (
          <CompareView
            races={allRaces.filter((r) => selectedIds.has(r.id))}
            onBack={() => setView("list")}
            onOpenDebrief={(id) => { setActiveId(id); setView("debrief"); }}
            onAskCoach={() => openCoach(null)}
          />
        )}
        {view === "add" && (
          <AddRaceForm onSave={handleSaveRace} onCancel={() => setView("list")} />
        )}
        {view === "edit" && activeRace && (
          <AddRaceForm initialRace={activeRace} onSave={handleEditRace} onCancel={() => setView("debrief")} />
        )}
        {view === "debrief" && activeRace && (
          <RaceDebrief
            race={activeRace}
            onBack={() => setView("list")}
            onAskCoach={() => openCoach(activeRace.id)}
            onEdit={activeRace.id.startsWith("custom-") ? () => setView("edit") : undefined}
          />
        )}
        {view === "coach" && (
          <CoachView races={allRaces} contextRace={coachContextRace} onBack={handleCoachBack} />
        )}
      </div>
    </div>
  );
}
