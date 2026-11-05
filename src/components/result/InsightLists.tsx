import type { IdealGroup, TimeSink } from '../../lib/analysis';
import { formatDuration } from '../../lib/format';
import type { Outcome } from '../../lib/scoring';

const OUTCOME_TAG: Record<Outcome, { text: string; style: string }> = {
  wrong: { text: '✕ Wrong', style: 'border-nans text-nans' },
  correct: { text: '✓ Correct', style: 'border-ans-deep text-ans-deep' },
  blank: { text: 'No answer', style: 'border-ink-3 text-ink-2' },
};

export function TimeSinkList({ sinks, attemptId }: { sinks: TimeSink[]; attemptId: string }) {
  if (sinks.length === 0) {
    return <p className="border border-line bg-white p-3 text-[13px] text-ink-2">No question took more than twice its target time.</p>;
  }
  return (
    <ul className="divide-y divide-line border border-line bg-white">
      {sinks.map((s) => {
        const tag = OUTCOME_TAG[s.outcome];
        return (
          <li key={s.item.q.id} data-sink={s.item.q.id} className={s.outcome === 'wrong' ? 'bg-[#fdf3f2]' : ''}>
            <a
              href={`#/review/${attemptId}/${s.item.q.id}`}
              className="flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] hover:bg-panel"
            >
              <span className="min-w-0">
                <span className="font-semibold">Q{s.item.displayNo}</span>{' '}
                <span className="text-ink-2">{s.item.q.sub}</span>
                <span className="block text-xs text-ink-2 tabular-nums">
                  {formatDuration(s.timeMs)} spent, {formatDuration(s.targetMs)} target, {formatDuration(s.lostMs)} lost
                </span>
              </span>
              <span className={`shrink-0 border px-1 text-[10px] font-semibold ${tag.style}`}>{tag.text}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function IdealOrderList({ groups }: { groups: IdealGroup[] }) {
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.section ?? 'all'} data-ideal-group={group.section ?? 'all'}>
          {group.section && <h3 className="mb-1 text-xs font-semibold text-ink-2">{group.section}</h3>}
          <ol className="divide-y divide-line border border-line bg-white">
            {group.rows.map((r, i) => (
              <li key={r.topic} className="flex items-center gap-2 px-2 py-1.5 text-[13px]">
                <span className="w-5 shrink-0 text-right font-semibold text-ink-2 tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.topic}</span>{' '}
                  <span className="text-xs text-ink-2">
                    {r.questions} Q
                    {r.hasHistory
                      ? ` · ${r.accuracy.toFixed(0)}% · ${formatDuration(r.secPerQuestion * 1000)} per Q`
                      : ' · no history yet'}
                  </span>
                </span>
                {r.expectedPerQuestion <= 0 && (
                  <span className="border border-nans px-1 text-[10px] font-semibold text-nans">Skip unless sure</span>
                )}
                <span className="shrink-0 font-semibold tabular-nums">{r.marksPerMinute.toFixed(2)}/min</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="text-xs text-ink-2">
        Expected marks per minute from all your finished attempts. Topics with no history assume 70% accuracy at target
        time.
        {groups.some((g) => g.section) && ' Sections run in a fixed order, so the ranking restarts in each one.'}
      </p>
    </div>
  );
}
