import { memo } from 'react';
import type { CellResult } from '../../lib/analysis';
import type { PaperSection } from '../../lib/paper';
import { outcomeOf } from '../../lib/scoring';
import type { QuestionProgress } from '../../types';

const STYLE: Record<CellResult, { fill: string; label: string }> = {
  correct: { fill: 'bg-ans text-white shape-answered', label: 'Correct' },
  wrong: { fill: 'bg-nans text-white shape-not-answered', label: 'Wrong' },
  blank: { fill: 'bg-amber text-white rounded-full', label: 'Opened, no answer' },
  not_visited: { fill: 'bg-nv border border-line text-ink', label: 'Never opened' },
};

const ORDER: CellResult[] = ['correct', 'wrong', 'blank', 'not_visited'];

export function resultOf(q: Parameters<typeof outcomeOf>[0], p: QuestionProgress | undefined): CellResult {
  if (!p?.visited) return 'not_visited';
  return outcomeOf(q, p.selected);
}

interface Props {
  section: PaperSection;
  activeQid: string;
  responses: Record<string, QuestionProgress>;
  bookmarks: Set<string>;
  onPick: (index: number) => void;
}

function ReviewPaletteBase({ section, activeQid, responses, bookmarks, onPick }: Props) {
  const counts: Record<CellResult, number> = { correct: 0, wrong: 0, blank: 0, not_visited: 0 };
  for (const { q } of section.items) counts[resultOf(q, responses[q.id])] += 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="shrink-0 bg-subbar px-3 py-1 text-xs font-semibold">Results: {section.name}</h2>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
          {section.items.map(({ q, displayNo, index }) => {
            const result = resultOf(q, responses[q.id]);
            const active = q.id === activeQid;
            const starred = bookmarks.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                data-result={result}
                aria-current={active ? 'true' : undefined}
                aria-label={`Question ${displayNo}, ${STYLE[result].label.toLowerCase()}${starred ? ', bookmarked' : ''}`}
                onClick={() => onPick(index)}
                className={`relative flex h-[34px] items-center justify-center text-xs font-bold tabular-nums ${
                  active ? 'outline-2 outline-offset-1 outline-navy' : ''
                }`}
              >
                <span className={`absolute inset-0 ${STYLE[result].fill}`} />
                <span className={`relative ${result === 'not_visited' ? 'text-ink' : 'text-white'}`}>{displayNo}</span>
                {starred && (
                  <span aria-hidden="true" className="absolute -top-1 -right-0.5 text-[11px] leading-none text-[#b26a00]">
                    ★
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <ul aria-label="Results legend" className="shrink-0 space-y-1 border-t border-line px-3 py-2 text-[11px] leading-tight">
        {ORDER.map((r) => (
          <li key={r} className="flex items-center gap-2">
            <span className="relative inline-flex h-[26px] w-[30px] shrink-0 items-center justify-center text-[11px] font-bold tabular-nums">
              <span className={`absolute inset-0 ${STYLE[r].fill}`} />
              <span className={`relative ${r === 'not_visited' ? 'text-ink' : 'text-white'}`}>{counts[r]}</span>
            </span>
            {STYLE[r].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ReviewPalette = memo(ReviewPaletteBase);
