import { visualFor } from '../../lib/visibility';
import type { Block } from '../../types';
import { VisualView } from '../visuals/VisualView';

/**
 * A set's shared passage, pinned above the stem. It only ever shows question data: test and review
 * use the same panel, and solution visuals are drawn separately in the review pane.
 */
export function SetPanel({ block }: { block: Block }) {
  const visual = visualFor(block, 'test');
  const clues = block.clues?.join(' ');
  const hasText = Boolean(block.directions || block.intro || clues);
  if (!hasText && !visual) return null;

  return (
    <section
      aria-label="Set directions"
      data-testid="set-panel"
      tabIndex={0}
      className={`shrink-0 overflow-auto border-b border-line bg-panel px-3 py-2 text-[14px] leading-[20px] ${visual ? 'max-h-[58%]' : 'max-h-[46%]'}`}
    >
      {block.directions && <p className="mb-1 font-semibold">{block.directions}</p>}
      <div className={visual ? 'gap-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start' : ''}>
        <div>
          {block.intro && <p className="whitespace-pre-line">{block.intro}</p>}
          {clues && <p className="mt-1">{clues}</p>}
        </div>
        {visual && (
          <div className="mt-2 border border-line bg-white p-1 lg:mt-0">
            <VisualView visual={visual} />
          </div>
        )}
      </div>
    </section>
  );
}
