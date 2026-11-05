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
export function TimerDisplay({ clock }: { clock: ClockStore }) {
  const ms = useSyncExternalStore(clock.subscribe, clock.get);
  const phase = timerPhase(ms);
  return (
    <div
      role="timer"
      aria-label="Time left"
      data-phase={phase}
      className={`flex h-8 items-center gap-2 px-3 ${PHASE_STYLE[phase]}`}
    >
      <span className="text-[11px] font-medium">Time left</span>
      <span className="text-base font-bold tabular-nums">{formatClock(ms)}</span>
    </div>
  );
}

interface TopBarProps {
  title: string;
  candidate: string;
  clock: ClockStore;
  allowPause: boolean;
  paused: boolean;
  onTogglePause: () => void;
}

export function ExamTopBar({ title, candidate, clock, allowPause, paused, onTogglePause }: TopBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-navy-deep bg-navy px-3 text-white">
      <h1 className="truncate text-[15px] font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-3">
        {allowPause && (
          <Button variant="ghost" onClick={onTogglePause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        )}
        <TimerDisplay clock={clock} />
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
}

function SectionTabsBase({ sections, activeSection, onSelect }: TabsProps) {
  return (
    <div role="tablist" aria-label="Sections" className="flex h-8 shrink-0 items-end gap-1 border-b border-line bg-subbar px-3">
      {sections.map((s) => {
        const active = s.name === activeSection;
        return (
          <button
            key={s.name}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.name)}
            className={`-mb-px h-7 border px-3 text-xs font-semibold ${
              active
                ? 'border-line border-t-2 border-t-action border-b-white bg-white text-navy'
                : 'border-line bg-subbar text-ink-2 hover:bg-white'
            }`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

export const SectionTabs = memo(SectionTabsBase);
