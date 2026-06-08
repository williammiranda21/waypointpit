import { useId } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional override; default uses palette index. */
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Hex; defaults to Waypoint green. */
  defaultColor?: string;
  yLabel?: string;
  /** Show values above bars. */
  showValues?: boolean;
}

/**
 * Lightweight SVG vertical bar chart. No external deps — Waypoint avoids
 * Recharts/Chart.js to keep the bundle tight.
 */
export function BarChart({
  data,
  height = 200,
  defaultColor = '#22C55E',
  yLabel,
  showValues = true,
}: BarChartProps) {
  const id = useId();
  const padLeft = yLabel ? 36 : 24;
  const padBottom = 32;
  const padTop = showValues ? 18 : 8;
  const w = Math.max(320, data.length * 80);
  const h = height;
  const innerW = w - padLeft - 16;
  const innerH = h - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = innerW / Math.max(1, data.length) - 12;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label={yLabel ? `${yLabel} bar chart` : 'Bar chart'}
    >
      {/* Y-axis baseline */}
      <line
        x1={padLeft}
        y1={padTop + innerH}
        x2={w - 8}
        y2={padTop + innerH}
        stroke="#E5E7EB"
      />
      {/* Y-axis label */}
      {yLabel && (
        <text
          x={padLeft - 24}
          y={padTop + innerH / 2}
          fontSize="10"
          fill="#6B7280"
          textAnchor="middle"
          transform={`rotate(-90 ${padLeft - 24} ${padTop + innerH / 2})`}
        >
          {yLabel}
        </text>
      )}
      {/* Bars */}
      {data.map((d, i) => {
        const x = padLeft + i * (barW + 12);
        const barH = (d.value / max) * innerH;
        const y = padTop + innerH - barH;
        return (
          <g key={`${id}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill={d.color ?? defaultColor}
            />
            {showValues && d.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                fontSize="11"
                fontWeight="600"
                fill="#111827"
                textAnchor="middle"
              >
                {d.value}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={padTop + innerH + 14}
              fontSize="10"
              fill="#6B7280"
              textAnchor="middle"
            >
              {truncate(d.label, 16)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
