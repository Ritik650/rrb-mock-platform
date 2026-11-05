import { useState } from 'react';
import { ACCURACY_FLOOR, SLOW_FACTOR, type GroupRow, type TopicRow } from '../../lib/analysis';
import { formatDuration } from '../../lib/format';

function Flags({ row }: { row: GroupRow }) {
  return (
    <>
      {row.lowAccuracy && (
        <span className="ml-1 border border-nans px-1 text-[10px] font-semibold text-nans">Low accuracy</span>
      )}
      {row.slow && <span className="ml-1 border border-amber px-1 text-[10px] font-semibold text-amber">Slow</span>}
    </>
  );
}

function Cells({ row }: { row: GroupRow }) {
  const cell = 'border border-line px-2 py-1 text-center';
  // A section opens its first question by itself, so a topic can log a moment with no real time spent.
  const spentTime = row.avgTimeMs >= 500;
  return (
    <>
      <td className={cell}>
        {row.attempted} / {row.total}
      </td>
      <td className={cell}>{row.correct}</td>
      <td className={`${cell} ${row.lowAccuracy ? 'font-semibold text-nans' : ''}`}>
        {row.attempted ? `${row.accuracy.toFixed(0)}%` : '–'}
      </td>
      <td className={`${cell} ${row.slow ? 'font-semibold text-amber' : ''}`}>
        {spentTime ? formatDuration(row.avgTimeMs) : '–'}
      </td>
      <td className={cell}>{spentTime ? formatDuration(row.targetMs) : '–'}</td>
    </>
  );
}

export function TopicTable({ rows }: { rows: TopicRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white text-[13px] tabular-nums">
        <thead>
          <tr className="bg-panel text-xs">
            {['Topic', 'Attempted', 'Correct', 'Accuracy', 'Avg time', 'Target'].map((h, i) => (
              <th key={h} scope="col" className={`border border-line px-2 py-1 font-semibold ${i ? 'text-center' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const weak = row.lowAccuracy || row.slow;
            const expanded = open.has(row.key);
            return [
              <tr key={row.key} data-weak={weak} className={weak ? 'bg-[#fdf3f2]' : ''}>
                <th
                  scope="row"
                  className={`border border-line px-2 py-1 text-left font-medium ${weak ? 'border-l-4 border-l-nans' : ''}`}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggle(row.key)}
                    className="mr-1 inline-flex w-4 justify-center font-mono text-xs text-action"
                    aria-label={`${expanded ? 'Hide' : 'Show'} sub-topics of ${row.label}`}
                  >
                    {expanded ? '−' : '+'}
                  </button>
                  {row.label}
                  <Flags row={row} />
                </th>
                <Cells row={row} />
              </tr>,
              ...(expanded
                ? row.subs.map((sub) => (
                    <tr key={sub.key} data-sub={sub.key} className="text-ink-2">
                      <th
                        scope="row"
                        className={`border border-line py-1 pr-2 pl-7 text-left font-normal ${sub.lowAccuracy || sub.slow ? 'border-l-4 border-l-nans' : ''}`}
                      >
                        {sub.label}
                        <Flags row={sub} />
                      </th>
                      <Cells row={sub} />
                    </tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-ink-2">
        Flagged when accuracy is below {ACCURACY_FLOOR}% or average time is over {SLOW_FACTOR} × target. Targets come
        from your question file, shortened where a section's total runs past its clock. Average time is all your time
        in the topic per question answered, so a long read you abandoned still counts.
      </p>
    </div>
  );
}
