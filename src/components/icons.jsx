/*
  Line icons in one hand: 1.6px strokes, round caps, 24-unit grid. Drawn here
  rather than pulled from an icon font so they share the brand's weight and
  stay decorative (aria-hidden) unless a label is passed.
*/
function Icon({ size = 20, label, children, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export const SparkIcon = (p) => (
  <Icon {...p}><path d="M12 3.5 13.9 10.1 20.5 12 13.9 13.9 12 20.5 10.1 13.9 3.5 12 10.1 10.1Z" fill="currentColor" stroke="none" /><path d="M19 2.8v3.4M17.3 4.5h3.4" /></Icon>
);
export const ShoeIcon = (p) => (
  <Icon {...p}><path d="M3 16.5c0-2 1-4.5 2-6.5l2.5 1.2c1.4.7 3 .4 4-.7L13 9l2.6 3.7c.6.9 1.6 1.4 2.7 1.5l1.6.1c.7.1 1.1.6 1.1 1.3V17H4.5A1.5 1.5 0 0 1 3 15.5Z" /><path d="M3 19h18M9.5 12.5l1-1.4M12 13.6l1-1.5" /></Icon>
);
export const MountainIcon = (p) => (
  <Icon {...p}><path d="M2.5 19.5 9 8.5l3.5 5.5 2.5-3.5 6.5 9Z" /><path d="m7.4 11.2 1.6 1.3 1.5-1.4" /></Icon>
);
export const ClockIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
);
export const ThermometerIcon = (p) => (
  <Icon {...p}><path d="M10 13.6V5a2 2 0 1 1 4 0v8.6a4 4 0 1 1-4 0Z" /><path d="M12 9v6.5" /></Icon>
);
export const DropIcon = (p) => (
  <Icon {...p}><path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z" /></Icon>
);
export const ArrowUpRightIcon = (p) => (
  <Icon {...p}><path d="M7 17 17 7M9 7h8v8" /></Icon>
);
export const AlertIcon = (p) => (
  <Icon {...p}><path d="M12 4 21 19.5H3Z" /><path d="M12 10v4.2M12 17.2v.1" /></Icon>
);
export const BalanceIcon = (p) => (
  <Icon {...p}><path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" /></Icon>
);
export const InfoIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 2.5" /><path d="M12 11v5M12 8v.1" /></Icon>
);
export const ChevronRightIcon = (p) => (
  <Icon {...p}><path d="m9.5 6 6 6-6 6" /></Icon>
);
export const CompassIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2.3 4.7-4.7 2.3 2.3-4.7Z" fill="currentColor" stroke="none" opacity=".9" /></Icon>
);
export const TrophyIcon = (p) => (
  <Icon {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M10 16.5h4" /></Icon>
);
