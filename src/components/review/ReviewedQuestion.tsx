import { formatDuration, optionLetter } from '../../lib/format';
import { outcomeOf } from '../../lib/scoring';
import { DI_TOPIC, derivedFor, visualFor } from '../../lib/visibility';
import type { Block, Question } from '../../types';
import { SvgTable } from '../visuals/SvgTable';
import { VisualView } from '../visuals/VisualView';

function optionStyle(isAnswer: boolean, isMine: boolean): string {
  if (isAnswer) return 'border-ans bg-[#e6f4ea]';
  if (isMine) return 'border-nans bg-[#fce8e6]';
  return 'border-nv bg-white';
}

interface OptionsProps {
  q: Question;
  /** undefined means there is no attempt behind this view, as in the Revision list. */
  selected?: number | null;
}

/** Correct option green, a wrong pick red. Each also says so in words, so colour is never the only cue. */
export function ReviewOptions({ q, selected }: OptionsProps) {
  return (
    <ul className="mt-2 space-y-1">
      {q.options.map((text, i) => {
        const isAnswer = i === q.ans;
        const isMine = i === selected;
        return (
          <li
            key={i}
            data-correct={isAnswer}
            data-mine={isMine}
            className={`flex min-h-8 items-center gap-2 border px-2 py-1 text-[14px] ${optionStyle(isAnswer, isMine)}`}
          >
            <span className="text-[13px] font-medium">({optionLetter(i)})</span>
            <span className="flex-1">{text}</span>
            {isAnswer && <span className="shrink-0 text-xs font-semibold text-ans-deep">✓ Correct answer</span>}
            {isMine && (
              <span className={`shrink-0 text-xs font-semibold ${isAnswer ? 'text-ans-deep' : 'text-nans'}`}>
                {isAnswer ? '· Your answer' : '✕ Your answer'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The worked steps, plus the arrangement or table the set resolves to. */
export function SolutionBlock({ q, block }: { q: Question; block: Block }) {
  const visual = visualFor(block, 'review');
  const derived = derivedFor(block, 'review');
  // A DI chart is question data and is already on screen in the set panel.
  const solutionVisual = visual && block.topic !== DI_TOPIC ? visual : null;

  return (
    <section aria-label="Solution" className="mt-3 border border-line bg-[#fbfcfe] p-2 lg:mt-0">
      <h3 className="text-[13px] font-semibold text-navy">Solution</h3>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[14px]">
        {q.sol.map((step, i) => (
          <li key={i} className="whitespace-pre-line">
            {step}
          </li>
        ))}
      </ol>
      {solutionVisual && (
        <div className="mt-2 overflow-x-auto" data-testid="solution-visual">
          <VisualView visual={solutionVisual} />
        </div>
      )}
      {derived && (
        <div className="mt-2 overflow-x-auto" data-testid="solution-derived">
          <SvgTable headers={derived.headers} rows={derived.rows} />
        </div>
      )}
    </section>
  );
}

export function YourTime({ q, timeMs, selected }: { q: Question; timeMs: number; selected: number | null }) {
  const outcome = outcomeOf(q, selected);
  const over = timeMs > q.time * 1000;
  return (
    <span className="flex items-center gap-3 text-xs text-ink-2 tabular-nums">
      <span data-testid="review-time">
        Your time <strong className={over ? 'text-amber' : 'text-ink'}>{formatDuration(timeMs)}</strong> · Target{' '}
        <strong className="text-ink">{formatDuration(q.time * 1000)}</strong>
      </span>
      <span
        className={`border px-1 text-[10px] font-semibold ${
          outcome === 'correct'
            ? 'border-ans-deep text-ans-deep'
            : outcome === 'wrong'
              ? 'border-nans text-nans'
              : 'border-ink-3 text-ink-2'
        }`}
      >
        {outcome === 'correct' ? '✓ Correct' : outcome === 'wrong' ? '✕ Wrong' : 'Not answered'}
      </span>
    </span>
  );
}

export function BookmarkStar({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove bookmark' : 'Bookmark this question'}
      title={on ? 'Remove from Revision' : 'Add to Revision'}
      onClick={onToggle}
      className={`px-1 text-lg leading-none ${on ? 'text-[#b26a00]' : 'text-ink-3 hover:text-ink'}`}
    >
      {on ? '★' : '☆'}
    </button>
  );
}
