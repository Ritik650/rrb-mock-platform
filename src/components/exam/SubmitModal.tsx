import { countPalette } from '../../lib/examState';
import type { Paper, PaperSection } from '../../lib/paper';
import type { QuestionProgress } from '../../types';
import { Button, Modal } from '../common/ui';

interface Props {
  paper: Paper;
  progress: Record<string, QuestionProgress>;
  unsavedQuestionNo: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const COLUMNS = [
  ['answered', 'Answered'],
  ['not_answered', 'Not answered'],
  ['marked', 'Marked'],
  ['answered_marked', 'Answered & marked'],
  ['not_visited', 'Not visited'],
] as const;

export function SubmitModal({ paper, progress, unsavedQuestionNo, onCancel, onConfirm }: Props) {
  const countsFor = (items: PaperSection['items']) =>
    countPalette(
      items.map((i) => i.q.id),
      progress,
    );
  const rows = paper.sections.map((s) => ({ name: s.name, counts: countsFor(s.items) }));
  const total = countsFor(paper.items);

  return (
    <Modal
      wide
      title="Submit this test?"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Back to the test</Button>
          <Button variant="submit" onClick={onConfirm}>
            Submit
          </Button>
        </>
      }
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-panel text-xs">
            <th scope="col" className="border border-line px-2 py-1 text-left font-semibold">
              Section
            </th>
            {COLUMNS.map(([key, label]) => (
              <th key={key} scope="col" className="border border-line px-2 py-1 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className="border border-line px-2 py-1 text-left font-medium">
                {row.name}
              </th>
              {COLUMNS.map(([key]) => (
                <td key={key} className="border border-line px-2 py-1 text-center">
                  {row.counts[key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="font-semibold">
            <th scope="row" className="border border-line px-2 py-1 text-left font-semibold">
              Total
            </th>
            {COLUMNS.map(([key]) => (
              <td key={key} className="border border-line px-2 py-1 text-center">
                {total[key]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-2">
        Answered &amp; marked questions are evaluated. Marked questions with no answer are not.
      </p>
      {unsavedQuestionNo !== null && (
        <p role="alert" className="mt-2 border border-amber bg-[#fff4e0] px-2 py-1 text-sm">
          Your selection on question {unsavedQuestionNo} is not saved and will not count. Go back and press Save &amp;
          Next to keep it.
        </p>
      )}
    </Modal>
  );
}
