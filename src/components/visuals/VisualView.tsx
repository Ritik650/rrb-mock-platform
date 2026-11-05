import type { Visual } from '../../types';
import { BarChart, LineChart, PieChart } from './Charts';
import { CircleSeats, LinearSeats, ParallelRows } from './Seating';
import { SvgTable } from './SvgTable';
import { CoordsPlot, FamilyTree } from './TreeAndPlot';

/** Builds a table's columns, dropping a Detail column that would be empty. */
function withDetail(headers: string[], rows: { cells: string[]; attr: string | null }[], detail: string) {
  const hasDetail = rows.some((r) => r.attr);
  return {
    headers: hasDetail ? [...headers, detail] : headers,
    rows: rows.map((r) => (hasDetail ? [...r.cells, r.attr ?? '–'] : r.cells)),
  };
}

/** Draws any Visual. Callers decide whether it may be shown: see lib/visibility.ts. */
export function VisualView({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case 'table':
      return <SvgTable headers={visual.headers} rows={visual.rows} />;
    case 'pie':
      return <PieChart {...visual} />;
    case 'bar':
      return <BarChart {...visual} />;
    case 'line':
      return <LineChart {...visual} />;
    case 'linear':
      return <LinearSeats visual={visual} />;
    case 'circle':
      return <CircleSeats visual={visual} />;
    case 'parallel':
      return <ParallelRows visual={visual} />;
    case 'tree':
      return <FamilyTree visual={visual} />;
    case 'coords':
      return <CoordsPlot visual={visual} />;
    case 'stack': {
      const first = visual.style === 'floor' ? 'Floor' : 'Position';
      const second = visual.style === 'floor' ? 'Person' : 'Box';
      const t = withDetail(
        [first, second],
        visual.levels.map((l) => ({ cells: [l.label, l.name], attr: l.attr })),
        'Detail',
      );
      return <SvgTable type="stack" {...t} />;
    }
    case 'schedule': {
      const t = withDetail(
        ['When', 'Person'],
        visual.rows.map((r) => ({ cells: [r.slot, r.name], attr: r.attr })),
        'Detail',
      );
      return <SvgTable type="schedule" {...t} />;
    }
    case 'floorflat':
      return (
        <SvgTable
          type="floorflat"
          headers={['Floor', 'Flat-X (west)', 'Flat-Y (east)']}
          rows={visual.floors.map((f) => [`Floor ${f.floor}`, f.P, f.Q])}
        />
      );
  }
}
