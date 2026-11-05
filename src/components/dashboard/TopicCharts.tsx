import { SLOW_FACTOR } from '../../lib/analysis';
import { formatDuration } from '../../lib/format';
import type { TopicTime, TopicTrend } from '../../lib/progress';
import { INK, Legend, niceTicks, SERIES, Viz } from '../visuals/svgKit';

/** One small chart per topic, sharing a 0-100% scale. Fourteen lines on one plot would be unreadable. */
function TopicSpark({ trend }: { trend: TopicTrend }) {
  const W = 220;
  const H = 74;
  const M = { left: 26, right: 44, top: 8, bottom: 8 };
  const { points } = trend;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => M.top + plotH * (1 - v / 100);
  const last = points[points.length - 1];
  return (
    <div className="border border-line bg-white p-1.5">
      <p className="text-xs font-semibold">{trend.topic}</p>
      <Viz
        type="topic-trend"
        width={W}
        height={H}
        label={`${trend.topic} accuracy over time: ${points.map((p) => `${p.accuracy.toFixed(0)}%`).join(', ')}.`}
      >
        {[0, 70, 100].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} shapeRendering="crispEdges" />
            <text x={M.left - 4} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill={INK.muted}>
              {t}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <polyline
            points={points.map((p, i) => `${x(i)},${y(p.accuracy)}`).join(' ')}
            fill="none"
            stroke={SERIES[0]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <g key={`${p.attemptId}-${i}`}>
            <title>{`${p.accuracy.toFixed(0)}% on ${p.attempted} question${p.attempted === 1 ? '' : 's'}`}</title>
            <circle cx={x(i)} cy={y(p.accuracy)} r={12} fill="transparent" />
            <circle cx={x(i)} cy={y(p.accuracy)} r={4} fill={SERIES[0]} stroke={INK.surface} strokeWidth={2} />
          </g>
        ))}
        <text
          x={x(points.length - 1) + 8}
          y={y(last.accuracy) + 4}
          fontSize={11}
          fontWeight={600}
          fill={INK.primary}
        >
          {last.accuracy.toFixed(0)}%
        </text>
      </Viz>
    </div>
  );
}

export function TopicTrends({ trends }: { trends: TopicTrend[] }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {trends.map((t) => (
          <TopicSpark key={t.topic} trend={t} />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-2">Accuracy per attempt, oldest on the left. The middle line marks 70%.</p>
    </div>
  );
}

/** Bars for your average with a tick at the target, so running over reads at a glance. */
export function TimeVsTarget({ times }: { times: TopicTime[] }) {
  const W = 1180;
  const rowH = 24;
  const barH = 14;
  const labelW = 150;
  const top = 26;
  const H = top + times.length * rowH + 4;
  const right = 190;
  const ticks = niceTicks(Math.max(...times.flatMap((t) => [t.avgSec, t.targetSec]), 1), 6);
  const maxSec = ticks[ticks.length - 1];
  const x = (sec: number) => labelW + ((W - labelW - right) * sec) / maxSec;

  return (
    <Viz
      type="time-vs-target"
      width={W}
      height={H}
      label={`Average time per question against target. ${times
        .map((t) => `${t.topic}: ${formatDuration(t.avgSec * 1000)}, target ${formatDuration(t.targetSec * 1000)}`)
        .join('; ')}.`}
    >
      <Legend items={[{ name: 'Your average', color: SERIES[0] }]} x={labelW} y={14} />
      <line x1={labelW + 120} x2={labelW + 120} y1={5} y2={17} stroke={INK.primary} strokeWidth={2} />
      <text x={labelW + 126} y={15} fontSize={12} fill={INK.secondary}>
        Target
      </text>
      {times.map((t, i) => {
        const y = top + i * rowH;
        const slow = t.avgSec > SLOW_FACTOR * t.targetSec;
        const end = x(t.avgSec);
        const barY = y + (rowH - barH) / 2;
        const r = Math.min(4, end - labelW);
        return (
          <g key={t.topic}>
            <title>{`${t.topic}: ${formatDuration(t.avgSec * 1000)} per question over ${t.attempted} answered, target ${formatDuration(t.targetSec * 1000)}`}</title>
            <text x={labelW - 8} y={y + rowH / 2 + 4} fontSize={12} textAnchor="end" fill={INK.secondary}>
              {t.topic}
            </text>
            <path
              d={`M${labelW} ${barY}H${end - r}Q${end} ${barY} ${end} ${barY + r}V${barY + barH - r}Q${end} ${barY + barH} ${end - r} ${barY + barH}H${labelW}Z`}
              fill={SERIES[0]}
            />
            <line x1={x(t.targetSec)} x2={x(t.targetSec)} y1={y + 2} y2={y + rowH - 2} stroke={INK.primary} strokeWidth={2} />
            <text x={Math.max(end, x(t.targetSec)) + 8} y={y + rowH / 2 + 4} fontSize={12} fill={INK.primary}>
              {formatDuration(t.avgSec * 1000)} vs {formatDuration(t.targetSec * 1000)}
              {slow ? ' · slow' : ''}
            </text>
          </g>
        );
      })}
    </Viz>
  );
}
