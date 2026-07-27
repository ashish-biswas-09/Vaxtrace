// Inline SVG trend line for the KPI cards. No dependency — a polyline over a normalised
// series is about fifteen lines, and Recharts would be ~100KB for four of them.
//
// aria-hidden on purpose: the shape carries no value a reader could use, and the delta chip
// beside it already states the change in words.

export function Sparkline({
  points,
  color,
  width = 72,
  height = 24,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  // A flat series would divide by zero and, worse, draw at the top of the box as if it were a
  // peak. Draw it through the middle instead.
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const pad = 2;
  const usable = height - pad * 2;

  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = max === min ? height / 2 : pad + usable - ((p - min) / span) * usable;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
