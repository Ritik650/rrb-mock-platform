import { AppShell } from '../components/common/AppShell';
import { Button, ErrorNote, Loading } from '../components/common/ui';
import { mockStats } from '../data/attemptStore';
import { db } from '../data/db';
import { formatDate, formatDuration, formatScore } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

/** Every finished attempt at one mock, each with its analysis and solutions. */
export function HistoryPage({ mockNo }: { mockNo: number }) {
  const { data, error } = useAsync(
    async () => ({ mock: await db.mocks.get(mockNo), stats: (await mockStats()).get(mockNo) }),
    [mockNo],
  );
  const attempts = data?.stats?.attempts ?? [];

  return (
    <AppShell route="history">
      {error && <ErrorNote error={error} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="mx-auto max-w-3xl p-4">
          <h1 className="mb-3 text-lg font-bold text-navy">{data.mock?.title ?? `Mock ${mockNo}`}: past attempts</h1>
          {attempts.length === 0 ? (
            <p className="border border-line bg-white p-3 text-ink-2">No finished attempts yet.</p>
          ) : (
            <ul className="divide-y divide-line border border-line bg-white">
              {attempts.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[13px]">
                    <span className="font-semibold">Attempt {attempts.length - i}</span>{' '}
                    <span className="text-ink-2">{formatDate(a.submittedAt ?? a.startedAt)}</span>
                    <span className="block text-ink-2 tabular-nums">
                      Net {formatScore(a.summary?.overall.net ?? 0)} · {a.summary?.overall.attempted ?? 0} attempted ·{' '}
                      {formatDuration(a.summary?.overall.timeMs ?? 0)} used
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button onClick={() => navigate(`/result/${a.id}`)}>Analysis</Button>
                    <Button variant="primary" onClick={() => navigate(`/review/${a.id}`)}>
                      Solutions
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
