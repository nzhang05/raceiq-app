/*
  Four glyphs for the four sports, drawn inline rather than pulled from an icon
  library — it is eight paths, and a dependency for that would be its own kind
  of clutter.

  Everything is stroked in `currentColor` so the caller sets the colour by
  setting `color`, which is what lets the same glyph sit in a filter chip (brass
  when active, ink when not) and in a race row without a variant prop.

  Running and cycling are distinguished by their shape; road and trail/gravel by
  the ground line under them — solid for road, broken for off-road. That reads at
  16px, where a difference in the figure itself would not.
*/
const RUN = "M9.2 3.1a1.15 1.15 0 1 0 0-.02M8.4 6.2 6.1 8l.9 2.7-1.8 2.4M8.4 6.2l2.6-.9 2.1 1.8 1.9.4M8.4 6.2 8 9.4l2.2 1.6.4 2.9";
const BIKE = "M4.3 12.6a2.6 2.6 0 1 0 0-.02M11.7 12.6a2.6 2.6 0 1 0 0-.02M4.3 12.6 7.5 7h3.2M8.9 4.6h2.1l2.9 8M6.6 7h4.4";

const GLYPHS = {
  "Road Running": { path: RUN, ground: "solid" },
  "Trail Running": { path: RUN, ground: "broken" },
  "Road Cycling": { path: BIKE, ground: "solid" },
  "Gravel Cycling": { path: BIKE, ground: "broken" },
};

export default function SportIcon({ sport, size = 15, style }) {
  const glyph = GLYPHS[sport];
  // "All" and any sport added later render nothing rather than a wrong glyph.
  if (!glyph) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyph.path} />
      <path
        d="M1.5 14.6h13"
        opacity="0.5"
        strokeDasharray={glyph.ground === "broken" ? "2 2" : undefined}
      />
    </svg>
  );
}
