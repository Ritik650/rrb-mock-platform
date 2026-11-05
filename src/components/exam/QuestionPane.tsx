import { memo } from 'react';
import { formatScore, optionLetter } from '../../lib/format';
import type { PaperItem } from '../../lib/paper';
import type { Marking } from '../../types';
import { SetPanel } from './SetPanel';

interface Props {
  item: PaperItem;
  draft: number | null;
  unsaved: boolean;
  marking: Marking;
  onSelect: (option: number) => void;
  onClear: () => void;
}

function QuestionPaneBase({ item, draft, unsaved, marking, onSelect, onClear }: Props) {
  const { q, block } = item;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <h2 className="text-[13px] font-semibold">Question No. {item.displayNo}</h2>
        <span className="text-xs text-ink-2">
          Marks: <span className="font-semibold text-ans-deep">+{formatScore(marking.correct)}</span>{' '}
          <span className="font-semibold text-nans">{formatScore(marking.wrong).replace('-', '−')}</span>
        </span>
      </div>
      {block.kind === 'set' && <SetPanel key={block.id} block={block} />}
      <div key={q.id} className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <p className="whitespace-pre-line text-[15px] leading-[21px]">{q.stem}</p>
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">Options for question {item.displayNo}</legend>
          {q.options.map((text, i) => {
            const selected = draft === i;
            return (
              <label
                key={i}
                className={`flex min-h-8 cursor-pointer items-center gap-2 border px-2 py-1 text-[14px] hover:border-action ${
                  selected ? 'border-action bg-action-wash font-semibold text-action-deep' : 'border-nv bg-white'
                }`}
              >
                <input
                  type="radio"
                  name={`option-${q.id}`}
                  checked={selected}
                  onChange={() => onSelect(i)}
                  // A radio sends no change event when clicked again, so deselecting listens for the click.
                  onClick={() => {
                    if (selected) onClear();
                  }}
                  className="h-3.5 w-3.5 accent-action"
                />
                <span className="text-[13px] font-medium">({optionLetter(i)})</span>
                <span>{text}</span>
              </label>
            );
          })}
        </fieldset>
        {unsaved && (
          <p role="status" className="mt-1 text-xs font-medium text-amber">
            Not saved yet. Press Save &amp; Next to keep this answer.
          </p>
        )}
      </div>
    </div>
  );
}

export const QuestionPane = memo(QuestionPaneBase);
