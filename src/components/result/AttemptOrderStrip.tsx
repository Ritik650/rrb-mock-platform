import type { CellResult, OrderCell } from '../../lib/analysis';
import { formatDuration } from '../../lib/format';

const STYLE: Record<CellResult, { fill: string; label: string; word: string }> = {
  correct: { fill: 'bg-ans text-white', label: 'Correct', word: 'correct' },
  wrong: { fill: 'bg-nans text-white', label: 'Wrong', word: 'wrong' },
  blank: { fill: 'bg-amber text-white', label: 'Opened, no answer', word: 'no answer' },
  not_visited: { fill: 'bg-nv text-ink', label: 'Never opened', word: 'never opened' },
};

const LEGEND: CellResult[] = ['correct', 'wrong', 'blank', 'not_visited'];

interface Props {
  cells: OrderCell[];
  attemptId: string;
}

/** A strip of one cell per question, in the order first opened. Each cell opens that solution. */
export function AttemptOrderStrip({ cells, attemptId }: Props) {
  return (
    <div>
      <ol aria-label="Questions in the order you opened them" className="flex w-full gap-px">
        {cells.map((c) => {
          const s = STYLE[c.result];
          const label = `Q${c.item.displayNo}, ${c.item.q.topic}: ${s.word}, ${formatDuration(c.timeMs)}${c.position ? `, opened ${c.position}${ordinal(c.position)}` : ''}`;
          return (
            <li key={c.item.q.id} data-result={c.result} className="min-w-0 flex-1" style={{ maxWidth: 32 }}>
              <a
                href={`#/review/${attemptId}/${c.item.q.id}`}
                title={label}
                aria-label={label}
                className={`flex h-6 items-center justify-center text-[9px] leading-none font-semibold tabular-nums hover:opacity-80 ${s.fill}`}
              >
                {c.item.displayNo}
              </a>
            </li>
          );
        })}
      </ol>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        {LEGEND.map((r) => (
          <li key={r} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-3 w-3 ${STYLE[r].fill}`} />
            {STYLE[r].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}
