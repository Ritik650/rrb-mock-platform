import { formatDate, formatScore } from '../../lib/format';
import type { ScorePoint } from '../../lib/progress';
import { INK, niceTicks, SERIES, Viz, halo } from '../visuals/svgKit';

const W = 1180;
const H = 280;
const M = { left: 40, right: 90, top: 18, bottom: 28 };

/** Net score per mock against the cut-off. Each point opens that attempt's analysis. */
export function ScoreTrend({ points, cutOff }: { points: ScorePoint[]; cutOff: number }) {
  const maxScale = Math.max(cutOff, ...points.map((p) => p.total), ...points.map((p) => p.net));
  const minNet = Math.min(0, ...points.map((p) => p.net));
  const ticks = niceTicks(maxScale, 4);
  const top = ticks[ticks.length - 1];
  const bottom = minNet < 0 ? Math.floor(minNet / 5) * 5 : 0;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => M.top + plotH * (1 - (v - bottom) / (top - bottom));
  const best = Math.max(...points.map((p) => p.net));
  const bestIndex = points.findIndex((p) => p.net === best);
  const lastIndex = points.length - 1;
  const labelled = new Set([bestIndex, lastIndex]);
  const everyNth = Math.max(1, Math.ceil(points.length / 20));

  return (
    <Viz
      type="score-trend"
      width={W}
      height={H}
      label={`Net score per attempt against a cut-off of ${formatScore(cutOff)}. ${points.map((p) => `Attempt ${p.n}: ${formatScore(p.net)}`).join(', ')}.`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} shapeRendering="crispEdges" />
          <text x={M.left - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill={INK.muted}>
            {t}
          </text>
        </g>
      ))}
      <line x1={M.left} x2={W - M.right} y1={y(cutOff)} y2={y(cutOff)} stroke={INK.primary} strokeWidth={1.5} />
      <text x={W - M.right + 6} y={y(cutOff) + 4} fontSize={11} fontWeight={600} fill={INK.primary}>
        Cut-off {formatScore(cutOff)}
      </text>
      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.net)}`).join(' ')}
          fill="none"
          stroke={SERIES[0]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {points.map((p, i) => (
        <a key={p.attemptId} href={`#/result/${p.attemptId}`} aria-label={`Attempt ${p.n}: ${formatScore(p.net)}`}>
          <title>{`Attempt ${p.n}, ${p.title}: ${formatScore(p.net)} (${p.accuracy.toFixed(0)}% accuracy), ${formatDate(p.at)}`}</title>
          <circle cx={x(i)} cy={y(p.net)} r={14} fill="transparent" />
          <circle cx={x(i)} cy={y(p.net)} r={4} fill={SERIES[0]} stroke={INK.surface} strokeWidth={2} />
          {labelled.has(i) && (
            <text x={x(i)} y={y(p.net) - 10} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK.primary} style={halo}>
              {formatScore(p.net)}
            </text>
          )}
        </a>
      ))}
      {points.map((p, i) =>
        i % everyNth === 0 || i === lastIndex ? (
          <text key={p.attemptId} x={x(i)} y={H - 8} fontSize={11} textAnchor="middle" fill={INK.muted}>
            {p.n}
          </text>
        ) : null,
      )}
    </Viz>
  );
}
