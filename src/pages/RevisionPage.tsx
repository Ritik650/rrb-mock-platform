import { AppShell } from '../components/common/AppShell';
import { ErrorNote, Loading } from '../components/common/ui';
import { SetPanel } from '../components/exam/SetPanel';
import { BookmarkStar, ReviewOptions, SolutionBlock } from '../components/review/ReviewedQuestion';
import { toggleBookmark } from '../data/bookmarks';
import { db } from '../data/db';
import { loadBank } from '../data/mockStore';
import { useAsync } from '../lib/useAsync';

/** Bookmarked questions, newest first. Each stays closed until opened, so it can be retried first. */
export function RevisionPage() {
  const { data, error, reload } = useAsync(async () => {
    const [bank, rows] = await Promise.all([loadBank(), db.bookmarks.orderBy('createdAt').reverse().toArray()]);
    return rows.flatMap((row) => {
      const entry = bank.questions.get(row.qid);
      return entry ? [entry] : [];
    });
  }, []);

  return (
    <AppShell route="revision">
      {error && <ErrorNote error={error} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="mx-auto max-w-4xl p-4">
          <h1 className="mb-3 text-lg font-bold text-navy">Revision ({data.length})</h1>
          {data.length === 0 && (
            <p className="border border-line bg-white p-3 text-ink-2">
              Nothing here yet. Press the star on any question while reviewing solutions to add it.
            </p>
          )}
          <ul className="space-y-2">
            {data.map(({ q, block, mock }) => (
              <li key={q.id} className="border border-line bg-white">
                <details>
                  <summary className="px-3 py-2 text-[13px]">
                    <span className="font-semibold">
                      Mock {mock.mock_no}, Q{q.no}
                    </span>{' '}
                    <span className="text-ink-2">
                      {q.topic}: {q.sub}
                    </span>
                    <span className="block truncate pl-3.5 text-ink-2">{q.stem.split('\n').at(-1)}</span>
                  </summary>
                  <div className="border-t border-line">
                    {block.kind === 'set' && <SetPanel block={block} />}
                    <div className="px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-line text-[15px] leading-[21px]">{q.stem}</p>
                        <BookmarkStar on onToggle={() => void toggleBookmark(q.id).then(reload)} />
                      </div>
                      <ReviewOptions q={q} />
                      <SolutionBlock q={q} block={block} />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
