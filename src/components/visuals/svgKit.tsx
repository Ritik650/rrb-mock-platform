import type { ReactNode } from 'react';

export const INK = {
  primary: '#181c20',
  secondary: '#43474e',
  muted: '#5f6368',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  line: '#c6c9cc',
  panel: '#f1f3f4',
  surface: '#ffffff',
};

/** Validated categorical order (run through the palette validator against white). Never cycled by rank. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];

/** Estimated text width. Renderers run without a DOM in tests, so this cannot measure real glyphs. */
export function textWidth(text: string, px = 13): number {
  return String(text).length * px * 0.58;
}

export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of String(text).split(/\s+/)) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

/** Round axis ticks from 0 to at least `max`. */
export function niceTicks(max: number, target = 5): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let t = 0; t < max + step - 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

interface VizProps {
  type: string;
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}

/** Root of every chart and diagram. Scales down to fit, and never above its natural size. */
export function Viz({ type, width, height, label, children }: VizProps) {
  return (
    <svg
      className="viz mx-auto block h-auto max-w-full"
      data-visual={type}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

interface LegendProps {
  items: { name: string; color: string }[];
  x: number;
  y: number;
}

export function Legend({ items, x, y }: LegendProps) {
  let cursor = x;
  return (
    <g>
      {items.map((item) => {
        const at = cursor;
        cursor += 18 + textWidth(item.name, 12) + 16;
        return (
          <g key={item.name}>
            <rect x={at} y={y - 9} width={12} height={12} rx={2} fill={item.color} />
            <text x={at + 16} y={y + 1} fontSize={12} fill={INK.secondary}>
              {item.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Halo so a value label stays readable where it crosses a line. */
export const halo = { paintOrder: 'stroke', stroke: INK.surface, strokeWidth: 3, strokeLinejoin: 'round' } as const;

export const ACCENT = '#1a5fb4';
export const BOX = { fill: INK.surface, stroke: INK.secondary };

/** A small solid arrow from (x1,y1) to (x2,y2). Drawn, not a glyph, so it looks the same in any font. */
export function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 6;
  const a = (offset: number) =>
    `${x2 - head * Math.cos(angle + offset)},${y2 - head * Math.sin(angle + offset)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={2} />
      <polygon points={`${x2},${y2} ${a(0.5)} ${a(-0.5)}`} fill={ACCENT} />
    </g>
  );
}
