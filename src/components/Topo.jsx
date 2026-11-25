/*
  Topographic contour lines: RaceIQ's one decorative motif.

  Concentric, gently irregular rings around a summit, drawn from a seed so a
  given race always gets the same terrain and different races differ. Used as
  the photo placeholder and, very faintly, behind editorial headings. Purely
  decorative — always aria-hidden.
*/
import { T } from "../constants.js";

function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function TopoLines({ seed = "raceiq", rings = 9, color = T.brass, opacity = 0.22, strokeWidth = 1, width = 400, height = 240, style }) {
  const rnd = seeded(seed);
  const cx = width * (0.35 + rnd() * 0.4);
  const cy = height * (0.3 + rnd() * 0.45);
  const phase = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const amp = [0.12 + rnd() * 0.1, 0.06 + rnd() * 0.06, 0.03 + rnd() * 0.03];
  const step = Math.max(width, height) / (rings * 1.15);

  const paths = Array.from({ length: rings }, (_, k) => {
    const r = step * (k + 0.8);
    const pts = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      const wobble = 1 + amp[0] * Math.sin(2 * a + phase[0]) + amp[1] * Math.sin(3 * a + phase[1] + k * 0.3) + amp[2] * Math.sin(5 * a + phase[2]);
      return [cx + Math.cos(a) * r * wobble * 1.25, cy + Math.sin(a) * r * wobble * 0.8];
    });
    return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style={{ display: "block", width: "100%", height: "100%", ...style }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={i % 4 === 3 ? strokeWidth * 1.7 : strokeWidth} opacity={opacity} />
      ))}
    </svg>
  );
}

/*
  A photo, or the contour placeholder in its place. `alt` describes the photo
  when there is one; the placeholder is decoration and is hidden from
  assistive tech.
*/
export function PhotoSlot({ src, alt = "", seed, style, className, children }) {
  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${T.sageTint} 0%, #D6E0D2 100%)`, ...style }}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0 }}>
          <TopoLines seed={seed} />
        </div>
      )}
      {children}
    </div>
  );
}
