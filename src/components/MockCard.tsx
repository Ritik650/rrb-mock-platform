import type { MockStats } from '../data/attemptStore';
import { formatClock, formatDate, formatScore } from '../lib/format';
import { paperTimeLeftMs, sectionLimitsFor } from '../lib/sectionTiming';
import type { Mock } from '../types';
import { Button, LevelBadge } from './common/ui';

interface Props {
  mock: Mock;
  stats: MockStats | undefined;
  cutOff: number;
  onStart: () => void;
  onResume: (attemptId: string) => void;
  onRestart: (attemptId: string) => void;
  onReview: () => void;
}

const questionCount = (m: Mock) =>
  m.sections.reduce((n, s) => n + s.blocks.reduce((k, b) => k + b.qs.length, 0), 0);

export function MockCard({ mock, stats, cutOff, onStart, onResume, onRestart, onReview }: Props) {
  const open = stats?.inProgress ?? null;
  const done = stats?.attempts ?? [];
  const best = stats?.best ?? null;
  const gap = best === null ? null : best - cutOff;
  const limits = sectionLimitsFor(mock);

  return (
    <article
      aria-label={mock.title}
      className={`flex flex-col justify-between bg-white p-3 ${open ? 'border-2 border-action' : 'border border-line'}`}
    >
      <div>
        <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
          <h2 className="text-[15px] font-semibold text-navy">Mock {String(mock.mock_no).padStart(2, '0')}</h2>
          <LevelBadge level={mock.level} />
        </div>
        <p className="mb-2 text-xs text-ink-2">
          {questionCount(mock)} Q | {limits ? limits.map((sec) => sec / 60).join(' + ') : mock.duration_min} min
        </p>
        <div className="mb-2 border border-line bg-panel p-2 text-xs">
          {open ? (
            <p className="font-semibold text-action">In progress: {formatClock(paperTimeLeftMs(open))} left</p>
          ) : (
            <>
              <p className="flex justify-between">
                <span className="text-ink-2">Best score</span>
                <span className="font-bold tabular-nums">{best === null ? '--' : formatScore(best)}</span>
              </p>
              <p
                className={`mt-0.5 text-[11px] font-semibold ${gap === null ? 'text-ink-3' : gap >= 0 ? 'text-ans-deep' : 'text-nans'}`}
              >
                {gap === null
                  ? 'Not attempted'
                  : `${gap >= 0 ? '+' : '−'}${formatScore(Math.abs(gap))} vs cut-off ${formatScore(cutOff)}`}
              </p>
            </>
          )}
        </div>
        <p className="mb-2 text-[11px] text-ink-2">
          {done.length} attempt{done.length === 1 ? '' : 's'}
          {done[0] ? ` · last ${formatDate(done[0].submittedAt ?? done[0].startedAt)}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-2">
        {open ? (
          <>
            <Button variant="primary" onClick={() => onResume(open.id)}>
              Resume
            </Button>
            <Button onClick={() => onRestart(open.id)}>Start over</Button>
          </>
        ) : (
          <>
            <Button variant="primary" className={done.length ? '' : 'col-span-2'} onClick={onStart}>
              {done.length ? 'Re-attempt' : 'Start'}
            </Button>
            {done.length > 0 && <Button onClick={onReview}>Review</Button>}
          </>
        )}
      </div>
    </article>
  );
}
