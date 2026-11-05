import { INK, textWidth, Viz, wrapText } from './svgKit';

const ROW_H = 26;
const HEADER_LINE_H = 15;
const CELL_PAD = 18;
const MIN_COL = 40;

interface Props {
  headers: string[];
  rows: (string | number)[][];
  type?: string;
  label?: string;
}

/** A table drawn as inline SVG. Used by DI tables, solution tables and every table-style diagram. */
export function SvgTable({ headers, rows, type = 'table', label }: Props) {
  const wrapAt = headers.length > 4 ? 13 : 26;
  const headerLines = headers.map((h) => wrapText(h, wrapAt));
  const headerRows = Math.max(1, ...headerLines.map((l) => l.length));
  const headerH = headerRows * HEADER_LINE_H + 10;

  const widths = headers.map((_, col) => {
    const widest = Math.max(
      ...headerLines[col].map((line) => textWidth(line, 12) * 1.08),
      ...rows.map((r) => textWidth(String(r[col] ?? ''), 13)),
    );
    return Math.max(MIN_COL, Math.ceil(widest) + CELL_PAD);
  });
  const lefts = widths.map((_, col) => widths.slice(0, col).reduce((a, b) => a + b, 0));
  const totalW = widths.reduce((a, b) => a + b, 0) + 1;
  const totalH = headerH + rows.length * ROW_H + 1;

  const description = label ?? `Table. ${headers.join(', ')}. ${rows.map((r) => r.join(', ')).join('; ')}.`;

  return (
    <Viz type={type} width={totalW} height={totalH} label={description}>
      <rect x={0.5} y={0.5} width={totalW - 1} height={headerH} fill={INK.panel} />
      {headers.map((_, col) =>
        headerLines[col].map((line, i) => (
          <text
            key={`${col}-${i}`}
            x={lefts[col] + widths[col] / 2}
            y={(headerH - headerLines[col].length * HEADER_LINE_H) / 2 + 12 + i * HEADER_LINE_H}
            fontSize={12}
            fontWeight={600}
            textAnchor="middle"
            fill={INK.primary}
          >
            {line}
          </text>
        )),
      )}
      {rows.map((row, r) =>
        row.map((cell, col) => (
          <text
            key={`${r}-${col}`}
            x={lefts[col] + widths[col] / 2}
            y={headerH + r * ROW_H + 18}
            fontSize={13}
            textAnchor="middle"
            fill={INK.primary}
          >
            {String(cell)}
          </text>
        )),
      )}
      <g stroke={INK.line} strokeWidth={1} shapeRendering="crispEdges">
        <rect x={0.5} y={0.5} width={totalW - 1} height={totalH - 1} fill="none" />
        <line x1={0} x2={totalW} y1={headerH + 0.5} y2={headerH + 0.5} />
        {rows.slice(0, -1).map((_, r) => (
          <line key={r} x1={0} x2={totalW} y1={headerH + (r + 1) * ROW_H + 0.5} y2={headerH + (r + 1) * ROW_H + 0.5} />
        ))}
        {widths.slice(0, -1).map((_, col) => (
          <line key={col} x1={lefts[col + 1] + 0.5} x2={lefts[col + 1] + 0.5} y1={0} y2={totalH} />
        ))}
      </g>
    </Viz>
  );
}
