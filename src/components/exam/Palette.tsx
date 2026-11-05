import { memo } from 'react';
import {
  blankProgress,
  countPalette,
  PALETTE_LABELS,
  PALETTE_STATES,
  paletteState,
  type PaletteState,
} from '../../lib/examState';
import type { PaperSection } from '../../lib/paper';
import type { QuestionProgress } from '../../types';

const FILL: Record<PaletteState, string> = {
  not_visited: 'bg-nv border border-line text-ink',
  not_answered: 'bg-nans text-white shape-not-answered',
  answered: 'bg-ans text-white shape-answered',
  marked: 'bg-mark text-white rounded-full',
  answered_marked: 'bg-mark text-white rounded-full',
};

/** The purple-with-green-tick mark for "answered & marked". */
function Tick() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-ans text-[9px] leading-none font-bold text-white"
    >
      ✓
    </span>
  );
}

function Swatch({ state, label }: { state: PaletteState; label?: number | string }) {
  return (
    <span className="relative inline-flex h-[26px] w-[30px] shrink-0 items-center justify-center text-[11px] font-bold tabular-nums">
      <span className={`absolute inset-0 ${FILL[state]}`} />
      <span className={`relative ${state === 'not_visited' ? 'text-ink' : 'text-white'}`}>{label}</span>
      {state === 'answered_marked' && <Tick />}
    </span>
  );
}

interface PaletteProps {
  section: PaperSection;
  activeQid: string;
  progress: Record<string, QuestionProgress>;
  onPick: (index: number) => void;
}

function PaletteBase({ section, activeQid, progress, onPick }: PaletteProps) {
  const counts = countPalette(
    section.items.map((i) => i.q.id),
    progress,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="shrink-0 bg-subbar px-3 py-1 text-xs font-semibold">Question Palette: {section.name}</h2>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
          {section.items.map(({ q, displayNo, index }) => {
            const state = paletteState(progress[q.id] ?? blankProgress());
            const active = q.id === activeQid;
            return (
              <button
                key={q.id}
                type="button"
                data-state={state}
                aria-current={active ? 'true' : undefined}
                aria-label={`Question ${displayNo}, ${PALETTE_LABELS[state].toLowerCase()}`}
                onClick={() => onPick(index)}
                className={`relative flex h-[34px] items-center justify-center text-xs font-bold tabular-nums ${
                  active ? 'outline-2 outline-offset-1 outline-navy' : ''
                }`}
              >
                <span className={`absolute inset-0 ${FILL[state]}`} />
                <span className={`relative ${state === 'not_visited' ? 'text-ink' : 'text-white'}`}>{displayNo}</span>
                {state === 'answered_marked' && <Tick />}
              </button>
            );
          })}
        </div>
      </div>
      <ul aria-label="Palette legend" className="shrink-0 space-y-1 border-t border-line px-3 py-2 text-[11px] leading-tight">
        {PALETTE_STATES.map((state) => (
          <li key={state} className="flex items-center gap-2" data-legend={state}>
            <Swatch state={state} label={counts[state]} />
            <span>{PALETTE_LABELS[state]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Palette = memo(PaletteBase);
