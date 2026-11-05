import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VisualView } from './VisualView';
import { SvgTable } from './SvgTable';
import { niceTicks, wrapText } from './svgKit';
import { loadRealBundle } from '../../test/bundle';
import { DI_TOPIC } from '../../lib/visibility';
import type { Block, Visual } from '../../types';

const blocks: Block[] = loadRealBundle().mocks.flatMap((m) => m.sections.flatMap((s) => s.blocks));
const withVisual = blocks.filter((b) => b.visual);
const html = (visual: Visual) => renderToStaticMarkup(<VisualView visual={visual} />);
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
const texts = (markup: string) => [...markup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

function expectWellFormed(markup: string, type: string, id: string) {
  expect(markup, id).toContain(`data-visual="${type}"`);
  expect(markup.startsWith('<svg'), id).toBe(true);
  expect(markup, id).not.toMatch(/NaN|undefined|null|Infinity/);
  expect(markup, id).toMatch(/aria-label="[^"]{10,}/);
}

describe('every visual in all 20 mocks', () => {
  it('finds all the visuals, of every type', () => {
    expect(withVisual).toHaveLength(191);
    expect(new Set(withVisual.map((b) => b.visual!.type))).toEqual(
      new Set(['table', 'pie', 'bar', 'line', 'linear', 'circle', 'stack', 'schedule', 'floorflat', 'parallel', 'tree', 'coords']),
    );
  });

  it('renders without error or broken numbers', () => {
    for (const block of withVisual) {
      const visual = block.visual!;
      expectWellFormed(html(visual), visual.type, block.id);
    }
  });

  it('renders every derived table', () => {
    const derived = blocks.filter((b) => b.derived);
    expect(derived).toHaveLength(26);
    for (const block of derived) {
      const markup = renderToStaticMarkup(<SvgTable {...block.derived!} />);
      expectWellFormed(markup, 'table', block.id);
      for (const cell of block.derived!.rows.flat()) expect(texts(markup), block.id).toContain(String(cell));
    }
  });
});

describe('DI charts are correct for every DI block', () => {
  const di = withVisual.filter((b) => b.topic === DI_TOPIC);

  it('covers all 40 DI blocks', () => {
    expect(di).toHaveLength(40);
  });

  it('prints every value a question could ask about', () => {
    for (const block of di) {
      const v = block.visual!;
      const printed = texts(html(v));
      if (v.type === 'bar' || v.type === 'line') {
        for (const c of v.categories) expect(printed, block.id).toContain(c);
        for (const s of v.series) {
          expect(printed, block.id).toContain(s.name);
          for (const value of s.values) expect(printed, block.id).toContain(String(value));
        }
      } else if (v.type === 'pie') {
        v.labels.forEach((label, i) => expect(printed, block.id).toContain(`${label} ${v.values[i]}${v.unit}`));
        expect(printed, block.id).toContain(v.title);
      } else if (v.type === 'table') {
        for (const cell of v.rows.flat()) expect(printed, block.id).toContain(String(cell));
      } else {
        throw new Error(`Unexpected DI visual ${v.type}`);
      }
    }
  });

  it('draws one mark per data point', () => {
    for (const block of di) {
      const v = block.visual!;
      const markup = html(v);
      if (v.type === 'bar') {
        expect(count(markup, /<path/g), block.id).toBe(v.categories.length * v.series.length);
      } else if (v.type === 'line') {
        expect(count(markup, /<circle/g), block.id).toBe(v.categories.length * v.series.length);
        expect(count(markup, /<polyline/g), block.id).toBe(v.series.length);
      } else if (v.type === 'pie') {
        expect(count(markup, /<path/g), block.id).toBe(v.labels.length);
      }
    }
  });

  it('draws bars in proportion to their values, from a shared baseline', () => {
    const block = di.find((b) => b.visual!.type === 'bar')!;
    const v = block.visual as Extract<Visual, { categories: string[] }>;
    const paths = [...html(v).matchAll(/<path d="M([\d.]+) ([\d.]+)V([\d.]+)Q[^"]*"/g)];
    const values = v.categories.flatMap((_, i) => v.series.map((s) => s.values[i]));
    const baselines = new Set(paths.map((p) => p[2]));
    expect(baselines.size).toBe(1);
    const baseline = Number(paths[0][2]);
    // Height is the distance from the baseline to the bar's top. The path starts 4px below it.
    const heights = paths.map((p) => baseline - (Number(p[3]) - 4));
    heights.forEach((h, i) => {
      expect(h / values[i]).toBeCloseTo(heights[0] / values[0], 5);
    });
  });

  it('closes each pie exactly: slice angles add up to the full circle', () => {
    const block = di.find((b) => b.visual!.type === 'pie')!;
    const markup = html(block.visual!);
    const arcs = [...markup.matchAll(/d="M[\d.]+ [\d.]+L([\d.]+) ([\d.]+)A[^"]* ([\d.]+) ([\d.]+)Z"/g)];
    expect(Number(arcs[0][1])).toBeCloseTo(Number(arcs.at(-1)![3]), 6);
    expect(Number(arcs[0][2])).toBeCloseTo(Number(arcs.at(-1)![4]), 6);
  });
});

describe('solution diagrams carry the arrangement', () => {
  const firstOf = <T extends Visual['type']>(type: T) =>
    withVisual.find((b) => b.visual!.type === type)!.visual as Extract<Visual, { type: T }>;

  it('linear: names in seat order with facing arrows and attributes', () => {
    const v = firstOf('linear');
    const markup = html(v);
    expect(texts(markup).filter((t) => v.seats.some((s) => s.name === t))).toEqual(v.seats.map((s) => s.name));
    expect(count(markup, /<polygon/g)).toBe(v.seats.length);
    for (const s of v.seats) if (s.attr) expect(texts(markup)).toContain(s.attr);
  });

  it('linear: a mixed row points each arrow by that seat\'s own facing', () => {
    const markup = html({
      type: 'linear',
      facing: 'mixed',
      seats: [
        { name: 'A', face: 'N', attr: null },
        { name: 'B', face: 'S', attr: null },
      ],
    });
    const lines = [...markup.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/g)];
    expect(Number(lines[0][1])).toBeGreaterThan(Number(lines[0][2])); // north points up the page
    expect(Number(lines[1][1])).toBeLessThan(Number(lines[1][2])); // south points down the page
  });

  it('circle: places the first seat at the top and goes clockwise', () => {
    const markup = html({
      type: 'circle',
      seats: ['A', 'B', 'C', 'D'].map((name) => ({ name, face: 'in' as const, attr: null })),
    });
    const at = (name: string) => {
      const m = markup.match(new RegExp(`<text x="([\\d.]+)" y="([\\d.]+)"[^>]*>${name}</text>`))!;
      return [Number(m[1]), Number(m[2])];
    };
    const [ax, ay] = at('A');
    const [bx, by] = at('B');
    const [cx, cy] = at('C');
    expect(bx).toBeGreaterThan(ax); // B is to the right of the top seat
    expect(by).toBeGreaterThan(ay);
    expect(cy).toBeGreaterThan(by); // C is at the bottom
    expect(cx).toBeCloseTo(ax, 5);
  });

  it('circle: arrows point inward or outward as stated', () => {
    const arrow = (face: 'in' | 'out') => {
      const markup = html({ type: 'circle', seats: [{ name: 'A', face, attr: null }] });
      const m = markup.match(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/)!;
      return Number(m[2]) - Number(m[1]);
    };
    expect(arrow('in')).toBeGreaterThan(0); // from the top seat, inward is down the page
    expect(arrow('out')).toBeLessThan(0);
  });

  it('stack and floorflat are tables that keep the data\'s order', () => {
    const stack = firstOf('stack');
    const printed = texts(html(stack));
    const labels = printed.filter((t) => stack.levels.some((l) => l.label === t));
    expect(labels).toEqual(stack.levels.map((l) => l.label));
    const ff = firstOf('floorflat');
    const ffPrinted = texts(html(ff));
    expect(ffPrinted).toContain('Flat-X (west)');
    for (const f of ff.floors) {
      expect(ffPrinted).toContain(f.P);
      expect(ffPrinted).toContain(f.Q);
    }
  });

  it('stack hides the Detail column when no level has an attribute', () => {
    const v = withVisual.map((b) => b.visual!).find((x) => x.type === 'stack' && x.levels.every((l) => !l.attr))!;
    expect(texts(html(v))).not.toContain('Detail');
  });

  it('parallel: labels which row faces which way', () => {
    const v = firstOf('parallel');
    const printed = texts(html(v));
    expect(printed).toContain('Row 1 (faces south)');
    expect(printed).toContain('Row 2 (faces north)');
    for (const name of [...v.row1, ...v.row2]) expect(printed).toContain(name);
  });

  it('tree: every member of every generation appears', () => {
    const v = firstOf('tree');
    const printed = texts(html(v));
    for (const g of v.gens) for (const m of g.members) expect(printed).toContain(m);
  });

  it('coords: labels each point and puts north up the page', () => {
    const markup = html({ type: 'coords', points: { A: [0, 0], B: [0, 4], C: [3, 4] } });
    const y = (name: string) => Number(markup.match(new RegExp(`y="([\\d.]+)"[^>]*>${name}</text>`))![1]);
    expect(y('B')).toBeLessThan(y('A'));
    expect(count(markup, /stroke-width="2"><\/line>|stroke="#1a5fb4"/g)).toBeGreaterThanOrEqual(2);
  });

  it('coords: never joins two points that are not in a straight line', () => {
    const joined = html({ type: 'coords', points: { A: [0, 0], B: [3, 4] } });
    const straight = html({ type: 'coords', points: { A: [0, 0], B: [0, 4] } });
    const paths = (m: string) => count(m, /<line[^>]*stroke="#1a5fb4"/g);
    expect(paths(straight)).toBe(paths(joined) + 1);
  });
});

describe('helpers', () => {
  it('builds round axis ticks that reach the maximum', () => {
    expect(niceTicks(160)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(24).at(-1)).toBeGreaterThanOrEqual(24);
  });

  it('wraps long headers without losing words', () => {
    expect(wrapText('% of loans given for housing', 13).join(' ')).toBe('% of loans given for housing');
    expect(wrapText('Short', 13)).toEqual(['Short']);
    expect(wrapText('', 13)).toEqual(['']);
  });
});
