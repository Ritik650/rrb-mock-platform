import { memo, useSyncExternalStore } from 'react';
import { formatClock } from '../../lib/format';
import { timerPhase, type ClockStore, type TimerPhase } from '../../lib/timer';
import type { PaperSection } from '../../lib/paper';
import { Button } from '../common/ui';

const PHASE_STYLE: Record<TimerPhase, string> = {
  normal: 'bg-navy-deep text-white',
  warning: 'bg-warn text-black',
  critical: 'bg-nans text-white',
};

/** Subscribes on its own, so the once-a-second tick re-renders only this. */
export function TimerDisplay({ clock, label }: { clock: ClockStore; label: string }) {
  const ms = useSyncExternalStore(clock.subscribe, clock.get);
  const phase = timerPhase(ms);
  return (
    <div
      role="timer"
      aria-label="Time left"
      data-phase={phase}
      className={`flex h-8 items-center gap-2 px-3 ${PHASE_STYLE[phase]}`}
    >
      <span className="text-[11px] font-medium">{label}</span>
      <span className="text-base font-bold tabular-nums">{formatClock(ms)}</span>
    </div>
  );
}

interface TopBarProps {
  title: string;
  candidate: string;
  clock: ClockStore;
  timerLabel: string;
  allowPause: boolean;
  paused: boolean;
  onTogglePause: () => void;
}

export function ExamTopBar({ title, candidate, clock, timerLabel, allowPause, paused, onTogglePause }: TopBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-navy-deep bg-navy px-3 text-white">
      <h1 className="truncate text-[15px] font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-3">
        {allowPause && (
          <Button variant="ghost" onClick={onTogglePause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        )}
        <TimerDisplay clock={clock} label={timerLabel} />
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-navy"
          >
            {candidate.slice(0, 1).toUpperCase()}
          </span>
          <span>{candidate}</span>
        </div>
      </div>
    </header>
  );
}

interface TabsProps {
  sections: PaperSection[];
  activeSection: string;
  onSelect: (section: string) => void;
  /** Set when each section has its own clock: only the running section can be opened. */
  limitsSec?: number[] | null;
  runningIndex?: number;
}

function SectionTabsBase({ sections, activeSection, onSelect, limitsSec, runningIndex = 0 }: TabsProps) {
  return (
    <div className="flex h-8 shrink-0 items-end justify-between gap-2 border-b border-line bg-subbar px-3">
      <div role="tablist" aria-label="Sections" className="flex h-full items-end gap-1">
        {sections.map((s, i) => {
          const active = s.name === activeSection;
          const locked = Boolean(limitsSec) && i !== runningIndex;
          const done = Boolean(limitsSec) && i < runningIndex;
          return (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={locked}
              title={done ? 'This section is finished.' : locked ? 'Opens when the current section ends.' : undefined}
              onClick={() => onSelect(s.name)}
              className={`-mb-px h-7 border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:text-ink-3 ${
                active
                  ? 'border-line border-t-2 border-t-action border-b-white bg-white text-navy'
                  : 'border-line bg-subbar text-ink-2 enabled:hover:bg-white'
              }`}
            >
              {done && <span aria-hidden="true">✓ </span>}
              {s.name}
              {limitsSec && <span className="font-medium"> · {limitsSec[i] / 60} min</span>}
            </button>
          );
        })}
      </div>
      {limitsSec && (
        <span className="self-center text-xs text-ink-2 tabular-nums">
          Section {runningIndex + 1} of {sections.length}
        </span>
      )}
    </div>
  );
}

export const SectionTabs = memo(SectionTabsBase);
