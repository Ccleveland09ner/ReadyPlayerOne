/** Score trend — 30 lines of inline SVG. The tech design notes this is less
 *  code than configuring a chart library, and it styles to the pixel theme. */
export function TrendChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const w = 340;
  const h = 150;
  const pad = 26;
  const max = 100;

  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad - 8);
    const y = h - pad - (v / max) * (h - pad - 10);
    return [x, y] as const;
  });
  const path = points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full" role="img" aria-label="Score trend over time">
      {[0, 25, 50, 75, 100].map((g) => {
        const y = h - pad - (g / max) * (h - pad - 10);
        return (
          <g key={g}>
            <line x1={pad} y1={y} x2={w - 8} y2={y} stroke="#2c2760" strokeWidth="1" />
            <text x={4} y={y + 3} fill="#7c8cff" fontSize="8" fontFamily="var(--font-pixel), monospace">
              {g}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#a58bff" strokeWidth="2.5" strokeLinejoin="miter" strokeLinecap="square" />
      {points.map((p, i) => (
        <rect key={i} x={p[0] - 3} y={p[1] - 3} width="6" height="6" fill="#c9beff" stroke="#5b3fd6" strokeWidth="1.5" />
      ))}
      {labels.map((l, i) => (
        <text
          key={l}
          x={pad + (i / Math.max(1, labels.length - 1)) * (w - pad - 8)}
          y={h + 10}
          fill="#8fa0e6"
          fontSize="8"
          fontFamily="var(--font-pixel), monospace"
          textAnchor="middle"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
