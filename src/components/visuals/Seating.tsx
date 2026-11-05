import type { Visual } from '../../types';
import { Arrow, BOX, INK, textWidth, Viz } from './svgKit';

type Of<T extends Visual['type']> = Extract<Visual, { type: T }>;

function SeatBox({ x, y, w, h, name }: { x: number; y: number; w: number; h: number; name: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} {...BOX} />
      <text x={x + w / 2} y={y + h / 2 + 5} fontSize={14} fontWeight={700} textAnchor="middle" fill={INK.primary}>
        {name}
      </text>
    </g>
  );
}

/** Boxes in a row with a facing arrow above each and the attribute underneath. */
export function LinearSeats({ visual }: { visual: Of<'linear'> }) {
  const { seats, facing } = visual;
  const seatW = Math.max(46, ...seats.map((s) => textWidth(s.attr ?? '', 12) + 10));
  const gap = 6;
  const width = seats.length * (seatW + gap) - gap + 16;
  const boxY = 32;
  const boxH = 36;
  const hasAttr = seats.some((s) => s.attr);
  const height = boxY + boxH + (hasAttr ? 24 : 8) + 18;
  const faceOf = (s: (typeof seats)[number]) => s.face ?? (facing === 'south' ? 'S' : 'N');
  const label = `Linear seating, left to right. ${seats
    .map((s) => `${s.name} facing ${faceOf(s) === 'N' ? 'north' : 'south'}${s.attr ? `, ${s.attr}` : ''}`)
    .join('; ')}.`;

  return (
    <Viz type="linear" width={width} height={height} label={label}>
      {seats.map((s, i) => {
        const x = 8 + i * (seatW + gap);
        const cx = x + seatW / 2;
        return (
          <g key={s.name}>
            {faceOf(s) === 'N' ? (
              <Arrow x1={cx} y1={boxY - 4} x2={cx} y2={8} />
            ) : (
              <Arrow x1={cx} y1={8} x2={cx} y2={boxY - 4} />
            )}
            <SeatBox x={x} y={boxY} w={seatW} h={boxH} name={s.name} />
            {s.attr && (
              <text x={cx} y={boxY + boxH + 16} fontSize={12} textAnchor="middle" fill={INK.secondary}>
                {s.attr}
              </text>
            )}
          </g>
        );
      })}
      <text x={8} y={height - 4} fontSize={11} fill={INK.muted}>
        Left end
      </text>
      <text x={width - 8} y={height - 4} fontSize={11} textAnchor="end" fill={INK.muted}>
        Right end
      </text>
    </Viz>
  );
}

/** Names around a table, clockwise from the top, with an arrow showing which way each person faces. */
export function CircleSeats({ visual }: { visual: Of<'circle'> }) {
  const { seats } = visual;
  const R = 92;
  const node = 17;
  const attrW = Math.max(0, ...seats.map((s) => textWidth(s.attr ?? '', 12)));
  const reach = R + node + 22;
  const cx = reach + attrW + 8;
  const cy = reach + 8;
  const width = cx * 2;
  const height = cy * 2 + 16;
  const label = `Circular seating, clockwise from the top. ${seats
    .map((s) => `${s.name} facing ${s.face === 'in' ? 'the centre' : 'outward'}${s.attr ? `, ${s.attr}` : ''}`)
    .join('; ')}.`;

  return (
    <Viz type="circle" width={width} height={height} label={label}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK.line} />
      {seats.map((s, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / seats.length;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const nx = cx + R * ux;
        const ny = cy + R * uy;
        const inward = s.face === 'in';
        const from = inward ? R - node : R + node;
        const to = inward ? R - node - 18 : R + node + 18;
        const labelR = R + node + (inward ? 8 : 24);
        const lx = cx + labelR * ux;
        const ly = cy + labelR * uy;
        return (
          <g key={s.name}>
            <Arrow x1={cx + from * ux} y1={cy + from * uy} x2={cx + to * ux} y2={cy + to * uy} />
            <circle cx={nx} cy={ny} r={node} {...BOX} />
            <text x={nx} y={ny + 5} fontSize={14} fontWeight={700} textAnchor="middle" fill={INK.primary}>
              {s.name}
            </text>
            {s.attr && (
              <text
                x={lx}
                y={ly + 4 + uy * 6}
                fontSize={12}
                textAnchor={Math.abs(ux) < 0.2 ? 'middle' : ux > 0 ? 'start' : 'end'}
                fill={INK.secondary}
              >
                {s.attr}
              </text>
            )}
          </g>
        );
      })}
      <text x={cx} y={height - 4} fontSize={11} textAnchor="middle" fill={INK.muted}>
        Read clockwise from the top
      </text>
    </Viz>
  );
}

/** Two rows facing each other. Row 1 faces south, row 2 faces north. */
export function ParallelRows({ visual }: { visual: Of<'parallel'> }) {
  const { row1, row2 } = visual;
  const seatW = 44;
  const gap = 8;
  const labelW = 118;
  const count = Math.max(row1.length, row2.length);
  const width = labelW + count * (seatW + gap);
  const boxH = 34;
  const y1 = 8;
  const y2 = y1 + boxH + 44;
  const height = y2 + boxH + 8;
  const xAt = (i: number) => labelW + i * (seatW + gap);
  const label = `Parallel rows. Row 1, facing south: ${row1.join(', ')}. Row 2, facing north: ${row2.join(', ')}.`;

  return (
    <Viz type="parallel" width={width} height={height} label={label}>
      <text x={0} y={y1 + boxH / 2 + 4} fontSize={12} fontWeight={600} fill={INK.secondary}>
        Row 1 (faces south)
      </text>
      <text x={0} y={y2 + boxH / 2 + 4} fontSize={12} fontWeight={600} fill={INK.secondary}>
        Row 2 (faces north)
      </text>
      {row1.map((name, i) => (
        <g key={name}>
          <SeatBox x={xAt(i)} y={y1} w={seatW} h={boxH} name={name} />
          <Arrow x1={xAt(i) + seatW / 2} y1={y1 + boxH + 3} x2={xAt(i) + seatW / 2} y2={y1 + boxH + 19} />
        </g>
      ))}
      {row2.map((name, i) => (
        <g key={name}>
          <SeatBox x={xAt(i)} y={y2} w={seatW} h={boxH} name={name} />
          <Arrow x1={xAt(i) + seatW / 2} y1={y2 - 3} x2={xAt(i) + seatW / 2} y2={y2 - 19} />
        </g>
      ))}
    </Viz>
  );
}
