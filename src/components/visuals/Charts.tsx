import { halo, INK, Legend, niceTicks, SERIES, Viz } from './svgKit';

interface SeriesChartProps {
  categories: string[];
  series: { name: string; values: number[] }[];
  unit: string;
}

const W = 560;
const H = 262;
const M = { left: 42, right: 12, top: 44, bottom: 24 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** Plain "number" adds nothing, so only a real unit gets an axis caption. */
const unitCaption = (unit: string) => (unit && unit !== 'number' ? unit : null);

function describe(kind: string, { categories, series, unit }: SeriesChartProps): string {
  const points = categories.map((c, i) => `${c}: ${series.map((s) => `${s.name} ${s.values[i]}`).join(', ')}`);
  return `${kind} (${unit}). ${points.join('; ')}.`;
}

function Frame({ categories, series, unit, ticks, y }: SeriesChartProps & { ticks: number[]; y: (v: number) => number }) {
  const band = PLOT_W / categories.length;
  const caption = unitCaption(unit);
  return (
    <g>
      <Legend items={series.map((s, i) => ({ name: s.name, color: SERIES[i] }))} x={M.left} y={14} />
      {caption && (
        <text x={W - M.right} y={15} fontSize={11} textAnchor="end" fill={INK.muted}>
          Unit: {caption}
        </text>
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? INK.axis : INK.grid}
            shapeRendering="crispEdges"
          />
          <text x={M.left - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill={INK.muted}>
            {t}
          </text>
        </g>
      ))}
      {categories.map((c, i) => (
        <text key={c} x={M.left + band * (i + 0.5)} y={H - 7} fontSize={12} textAnchor="middle" fill={INK.secondary}>
          {c}
        </text>
      ))}
    </g>
  );
}

function scaleFor(series: SeriesChartProps['series']) {
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.values)));
  const top = ticks[ticks.length - 1];
  return { ticks, y: (v: number) => M.top + PLOT_H * (1 - v / top) };
}

/**
 * Grouped columns. Every value is printed: a DI question needs exact numbers,
 * so the usual "label selectively" chart advice does not apply here.
 */
export function BarChart(props: SeriesChartProps) {
  const { categories, series } = props;
  const { ticks, y } = scaleFor(series);
  const band = PLOT_W / categories.length;
  const gap = 2;
  const barW = Math.min(24, (band - 14 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);

  return (
    <Viz type="bar" width={W} height={H} label={describe('Bar chart', props)}>
      <Frame {...props} ticks={ticks} y={y} />
      {categories.map((c, i) =>
        series.map((s, k) => {
          const x = M.left + band * i + (band - groupW) / 2 + k * (barW + gap);
          const v = s.values[i];
          const top = y(v);
          const bottom = y(0);
          const r = Math.min(4, bottom - top);
          return (
            <g key={`${c}-${s.name}`}>
              <path
                d={`M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + barW - r}Q${x + barW} ${top} ${x + barW} ${top + r}V${bottom}Z`}
                fill={SERIES[k]}
              >
                <title>{`${c}, ${s.name}: ${v}`}</title>
              </path>
              <text x={x + barW / 2} y={top - 4} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK.primary}>
                {v}
              </text>
            </g>
          );
        }),
      )}
    </Viz>
  );
}

/** Lines with a printed value at each point: above for the higher series, below for the lower. */
export function LineChart(props: SeriesChartProps) {
  const { categories, series } = props;
  const { ticks, y } = scaleFor(series);
  const band = PLOT_W / categories.length;
  const xAt = (i: number) => M.left + band * (i + 0.5);

  return (
    <Viz type="line" width={W} height={H} label={describe('Line chart', props)}>
      <Frame {...props} ticks={ticks} y={y} />
      {series.map((s, k) => (
        <polyline
          key={s.name}
          points={s.values.map((v, i) => `${xAt(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={SERIES[k]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {categories.map((c, i) => {
        const ranked = series
          .map((s, k) => ({ k, name: s.name, v: s.values[i] }))
          .sort((a, b) => b.v - a.v || a.k - b.k);
        return ranked.map((point, rank) => {
          const above = rank < ranked.length / 2;
          return (
            <g key={`${c}-${point.name}`}>
              <circle cx={xAt(i)} cy={y(point.v)} r={4} fill={SERIES[point.k]} stroke={INK.surface} strokeWidth={2}>
                <title>{`${c}, ${point.name}: ${point.v}`}</title>
              </circle>
              <text
                x={xAt(i)}
                y={y(point.v) + (above ? -9 : 18)}
                fontSize={11}
                fontWeight={600}
                textAnchor="middle"
                fill={INK.primary}
                style={halo}
              >
                {point.v}
              </text>
            </g>
          );
        });
      })}
    </Viz>
  );
}

interface PieProps {
  labels: string[];
  values: number[];
  unit: string;
  title: string;
}

const PIE_W = 460;
const PIE_H = 262;
const CX = PIE_W / 2;
const CY = 146;
const R = 84;

export function PieChart({ labels, values, unit, title }: PieProps) {
  const total = values.reduce((a, b) => a + b, 0);
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { label: labels[i], v, start, end: angle, mid: start + sweep / 2, color: SERIES[i % SERIES.length] };
  });
  const point = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;

  return (
    <Viz
      type="pie"
      width={PIE_W}
      height={PIE_H}
      label={`Pie chart. ${title}. ${slices.map((s) => `${s.label} ${s.v}${unit}`).join(', ')}.`}
    >
      <text x={CX} y={16} fontSize={13} fontWeight={600} textAnchor="middle" fill={INK.primary}>
        {title}
      </text>
      {slices.map((s) => {
        const [x1, y1] = point(R, s.start);
        const [x2, y2] = point(R, s.end);
        const large = s.end - s.start > Math.PI ? 1 : 0;
        const [lx1, ly1] = point(R + 2, s.mid);
        const [lx2, ly2] = point(R + 12, s.mid);
        const [tx, ty] = point(R + 16, s.mid);
        const right = Math.cos(s.mid) >= 0;
        const text = `${s.label} ${s.v}${unit}`;
        return (
          <g key={s.label}>
            <path
              d={`M${CX} ${CY}L${x1} ${y1}A${R} ${R} 0 ${large} 1 ${x2} ${y2}Z`}
              fill={s.color}
              stroke={INK.surface}
              strokeWidth={2}
            >
              <title>{text}</title>
            </path>
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={INK.axis} />
            <text
              x={tx}
              y={ty + 4}
              fontSize={12}
              fontWeight={600}
              textAnchor={right ? 'start' : 'end'}
              fill={INK.primary}
            >
              {text}
            </text>
          </g>
        );
      })}
    </Viz>
  );
}
