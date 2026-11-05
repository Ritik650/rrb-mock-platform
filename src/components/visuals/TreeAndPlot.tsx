import type { Visual } from '../../types';
import { ACCENT, Arrow, BOX, halo, INK, niceTicks, textWidth, Viz } from './svgKit';

type Of<T extends Visual['type']> = Extract<Visual, { type: T }>;

/** One row per generation, oldest first. */
export function FamilyTree({ visual }: { visual: Of<'tree'> }) {
  const { gens } = visual;
  const labelW = 46;
  const boxH = 30;
  const rowGap = 26;
  const gap = 12;
  const rows = gens.map((g) => {
    const widths = g.members.map((m) => textWidth(m, 13) + 18);
    return { ...g, widths, total: widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1) };
  });
  const innerW = Math.max(...rows.map((r) => r.total), 120);
  const width = labelW + innerW + 8;
  const height = rows.length * (boxH + rowGap) - rowGap + 8 + 20;
  const centre = labelW + innerW / 2;
  const label = `Family tree. ${gens.map((g) => `Generation ${g.gen}: ${g.members.join('; ')}`).join('. ')}.`;

  return (
    <Viz type="tree" width={width} height={height} label={label}>
      {rows.map((row, r) => {
        const y = 4 + r * (boxH + rowGap);
        let x = centre - row.total / 2;
        return (
          <g key={row.gen}>
            <text x={0} y={y + boxH / 2 + 4} fontSize={11} fontWeight={600} fill={INK.muted}>
              Gen {row.gen}
            </text>
            {r < rows.length - 1 && <line x1={centre} x2={centre} y1={y + boxH} y2={y + boxH + rowGap} stroke={INK.axis} />}
            {row.members.map((member, m) => {
              const at = x;
              x += row.widths[m] + gap;
              return (
                <g key={member}>
                  <rect x={at} y={y} width={row.widths[m]} height={boxH} {...BOX} />
                  <text x={at + row.widths[m] / 2} y={y + boxH / 2 + 5} fontSize={13} textAnchor="middle" fill={INK.primary}>
                    {member}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      <text x={labelW} y={height - 3} fontSize={11} fill={INK.muted}>
        (+) male, (−) female, (?) not stated, = couple
      </text>
    </Viz>
  );
}

/** A small grid plot of the walk: each labelled point, joined in order where the path is straight. */
export function CoordsPlot({ visual }: { visual: Of<'coords'> }) {
  const points = Object.entries(visual.points);
  const xs = points.map(([, p]) => p[0]);
  const ys = points.map(([, p]) => p[1]);
  // A grid step shared by both axes, with the plot snapped outward to whole steps so the grid closes.
  const step = niceTicks(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1), 8)[1];
  const minX = Math.floor(Math.min(...xs) / step) * step;
  const maxX = Math.max(Math.ceil(Math.max(...xs) / step) * step, minX + step);
  const minY = Math.floor(Math.min(...ys) / step) * step;
  const maxY = Math.max(Math.ceil(Math.max(...ys) / step) * step, minY + step);
  const unit = Math.min(360 / (maxX - minX), 240 / (maxY - minY), 40);
  const pad = 30;
  const width = (maxX - minX) * unit + pad * 2 + 30;
  const height = (maxY - minY) * unit + pad * 2;
  const px = (x: number) => pad + (x - minX) * unit;
  const py = (y: number) => pad + (maxY - y) * unit;
  const ticks = (min: number, max: number) => {
    const list: number[] = [];
    for (let t = min; t <= max + 1e-9; t += step) list.push(t);
    return list;
  };
  const label = `Plot of points. ${points.map(([n, p]) => `${n} at (${p[0]}, ${p[1]})`).join('; ')}.`;

  return (
    <Viz type="coords" width={width} height={height} label={label}>
      {ticks(minX, maxX).map((t) => (
        <line key={`x${t}`} x1={px(t)} x2={px(t)} y1={py(maxY)} y2={py(minY)} stroke={INK.grid} shapeRendering="crispEdges" />
      ))}
      {ticks(minY, maxY).map((t) => (
        <line key={`y${t}`} x1={px(minX)} x2={px(maxX)} y1={py(t)} y2={py(t)} stroke={INK.grid} shapeRendering="crispEdges" />
      ))}
      {points.slice(1).map(([name, p], i) => {
        const prev = points[i][1];
        if (prev[0] !== p[0] && prev[1] !== p[1]) return null;
        return <line key={name} x1={px(prev[0])} y1={py(prev[1])} x2={px(p[0])} y2={py(p[1])} stroke={ACCENT} strokeWidth={2} />;
      })}
      {points.map(([name, p]) => (
        <g key={name}>
          <circle cx={px(p[0])} cy={py(p[1])} r={4} fill={ACCENT} stroke={INK.surface} strokeWidth={2} />
          <text x={px(p[0]) + 7} y={py(p[1]) - 7} fontSize={13} fontWeight={700} fill={INK.primary} style={halo}>
            {name}
          </text>
        </g>
      ))}
      <g aria-hidden="true">
        <Arrow x1={width - 14} y1={32} x2={width - 14} y2={14} />
        <text x={width - 14} y={46} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK.muted}>
          N
        </text>
      </g>
    </Viz>
  );
}
