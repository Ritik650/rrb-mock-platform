import { formatDuration, formatGap, formatScore } from '../../lib/format';
import type { Attempt, Tally } from '../../types';

interface Props {
  attempt: Attempt;
  overall: Tally;
  sections: { name: string; tally: Tally }[];
  cutOff: number;
}

function Row({ name, t, strong, limitSec }: { name: string; t: Tally; strong?: boolean; limitSec?: number }) {
  const cell = 'border border-line px-2 py-1 text-center';
  return (
    <tr className={strong ? 'font-semibold' : ''}>
      <th scope="row" className={`border border-line px-2 py-1 text-left ${strong ? 'font-semibold' : 'font-medium'}`}>
        {name}
      </th>
      <td className={cell}>
        {t.attempted} / {t.total}
      </td>
      <td className={cell}>{t.correct}</td>
      <td className={cell}>{t.wrong}</td>
      <td className={cell}>{t.attempted ? `${t.accuracy.toFixed(1)}%` : '–'}</td>
      <td className={cell}>{formatScore(t.net)}</td>
      <td className={cell}>
        {formatDuration(t.timeMs)}
        {limitSec !== undefined && <span className="font-normal text-ink-2"> / {formatDuration(limitSec * 1000)}</span>}
      </td>
    </tr>
  );
}

/** Headline score and, for a full mock, how far it sits from the cut-off. */
export function ScoreHero({ attempt, overall, cutOff }: Omit<Props, 'sections'>) {
  const isMock = attempt.kind === 'mock';
  const cleared = overall.net >= cutOff;
  const clamp = (v: number) => Math.min(100, Math.max(0, (v / overall.total) * 100));
  return (
    <div>
      <p className="text-5xl font-semibold text-navy">
        {formatScore(overall.net)}
        <span className="ml-1 text-xl font-medium text-ink-2">/ {overall.total}</span>
      </p>
      {isMock && (
        <>
          <p className={`mt-1 text-[15px] font-semibold ${cleared ? 'text-ans-deep' : 'text-nans'}`}>
            {cleared ? '✓ ' : '✕ '}
            {formatGap(overall.net, cutOff)} ({formatScore(cutOff)})
          </p>
          <div
            className="relative mt-2 h-2 w-72 max-w-full bg-subbar"
            role="img"
            aria-label={`Score ${formatScore(overall.net)} against a cut-off of ${formatScore(cutOff)} out of ${overall.total}`}
          >
            <div className={`h-full ${cleared ? 'bg-ans' : 'bg-nans'}`} style={{ width: `${clamp(overall.net)}%` }} />
            <div className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${clamp(cutOff)}%` }} />
          </div>
        </>
      )}
      {attempt.submitReason === 'timeout' && (
        <p className="mt-2 text-xs text-ink-2">Time ran out, so this paper was submitted automatically.</p>
      )}
    </div>
  );
}

interface SectionTableProps extends Pick<Props, 'overall' | 'sections'> {
  /** Per-section limits when the paper was timed by section. */
  limitsSec?: number[] | null;
}

export function SectionTable({ overall, sections, limitsSec }: SectionTableProps) {
  const totalLimit = limitsSec?.reduce((a, b) => a + b, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white text-[13px] tabular-nums">
        <thead>
          <tr className="bg-panel text-xs">
            {['Section', 'Attempted', 'Correct', 'Wrong', 'Accuracy', 'Net score', 'Time used'].map((h, i) => (
              <th key={h} scope="col" className={`border border-line px-2 py-1 font-semibold ${i ? 'text-center' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row name="Overall" t={overall} strong limitSec={totalLimit} />
          {sections.map((s, i) => (
            <Row key={s.name} name={s.name} t={s.tally} limitSec={limitsSec?.[i]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
