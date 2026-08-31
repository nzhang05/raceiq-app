import { T } from "../constants.js";
import { verdictColor } from "../utils/ratings.js";

/*
  A race reduced to one small shape.

  Two jobs, one component. In the race list it sits in each row at 80×28 and
  answers "what kind of day was this" before the athlete reads a single number;
  behind the debrief headline it renders large and near-transparent as a
  watermark. Both want the same curve, so both come from here.

  Which curve depends on the race. A course with real climbing is best described
  by its elevation silhouette — that shape *is* the race. A flat course has no
  silhouette worth drawing, so the pace curve carries the information instead:
  a rising line is a fade, a flat one is even pacing.

  Hand-rolled SVG with local scale closures, matching PaceHeatStrip and
  ElevationProfile. No charting library is installed and none is wanted for a
  polyline.
*/
export default function RowSparkline({ race, width = 80, height = 28, variant = "row" }) {
  const splits = race?.splits ?? [];
  if (splits.length < 3) return null;

  const isWatermark = variant === "watermark";
  const hasElev = splits.some((s) => s.elevM != null);
  // Grade-adjusted pace where it exists: on a hilly course the raw pace curve is
  // mostly terrain, and drawing terrain twice says nothing about the athlete.
  const paceKey = race.usesGap && splits.some((s) => s.gapPace != null) ? "gapPace" : "pace";
  const mode = hasElev && race.elevationM > 200 ? "elev" : "pace";

  // The watermark is the course silhouette specifically. Scaled up behind the
  // headline, a pace curve is just a faint diagonal line across the text — it
  // reads as a rendering artifact rather than as the shape of the course, so a
  // race without elevation gets no watermark at all.
  if (isWatermark && mode !== "elev") return null;

  const values = splits
    .map((s) => (mode === "elev" ? s.elevM : s[paceKey]))
    .filter((v) => v != null && isFinite(v));
  if (values.length < 3) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero and, drawn, would be a straight line
  // anyway — which is the honest picture, so draw it at mid-height.
  const span = max - min || 1;
  const pad = isWatermark ? 0 : 2;
  const x = (i) => pad + (i / (values.length - 1)) * (width - pad * 2);
  // Elevation reads naturally (up is higher). Pace is inverted so that up is
  // *faster*, which keeps "the line falls away" meaning "they slowed down" in
  // both modes.
  const y = (v) => {
    const norm = (v - min) / span;
    const t = mode === "elev" ? 1 - norm : norm;
    return pad + t * (height - pad * 2);
  };

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const stroke = isWatermark ? T.paper : verdictColor(race.verdict);

  return (
    <svg
      width={isWatermark ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={isWatermark ? "none" : "xMidYMid meet"}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
      focusable="false"
    >
      {mode === "elev" && (
        <polygon
          points={`${x(0).toFixed(1)},${height} ${points} ${x(values.length - 1).toFixed(1)},${height}`}
          fill={stroke}
          opacity={isWatermark ? 0.5 : 0.14}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={isWatermark ? 2 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={isWatermark ? 0.9 : 0.75}
      />
    </svg>
  );
}
