import { AppShell } from '../components/common/AppShell';
import { ErrorNote, Loading, SectionTitle } from '../components/common/ui';
import { ScoreTrend } from '../components/dashboard/ScoreTrend';
import { TimeVsTarget, TopicTrends } from '../components/dashboard/TopicCharts';
import { attemptsForProgress } from '../data/attemptStore';
import { useSettings } from '../data/settings';
import { formatDate, formatScore } from '../lib/format';
import { scoreSeries, topicTimes, topicTrends, totals } from '../lib/progress';
import { useAsync } from '../lib/useAsync';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white p-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="text-2xl font-semibold text-navy">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const [settings] = useSettings();
  const { data: attempts, error } = useAsync(attemptsForProgress, []);

  const content = () => {
    if (!attempts || !settings) return null;
    const { cutOff } = settings;
    const scores = scoreSeries(attempts);
    const trends = topicTrends(attempts);
    const times = topicTimes(attempts);
    const sum = totals(attempts);

    if (attempts.length === 0) {
      return (
        <p className="border border-line bg-white p-4 text-ink-2">
          Your progress appears here after you finish a mock or a drill.
        </p>
      );
    }

    return (
      <>
        <section aria-label="Totals" className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Tile label="Questions solved" value={sum.solved.toLocaleString('en-IN')} />
          <Tile label="Correct" value={sum.solved ? `${((sum.correct / sum.solved) * 100).toFixed(0)}%` : '–'} />
          <Tile label="Mocks finished" value={String(sum.mocks)} />
          <Tile label="Drills finished" value={String(sum.drills)} />
          <Tile label="Best mock score" value={sum.best === null ? '–' : formatScore(sum.best)} />
        </section>

        <section>
          <SectionTitle>Net score per attempt</SectionTitle>
          {scores.length === 0 ? (
            <p className="border border-line bg-white p-3 text-[13px] text-ink-2">Finish a full mock to start this chart.</p>
          ) : (
            <div className="border border-line bg-white p-2">
              <ScoreTrend points={scores} cutOff={cutOff} />
              <details className="mt-1 text-[13px]">
                <summary className="text-action">Show as a table</summary>
                <table className="mt-1 w-full border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-panel text-left text-xs">
                      {['#', 'Paper', 'Net', 'Accuracy', 'Finished'].map((h) => (
                        <th key={h} scope="col" className="border border-line px-2 py-1 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((p) => (
                      <tr key={p.attemptId}>
                        <td className="border border-line px-2 py-1">{p.n}</td>
                        <td className="border border-line px-2 py-1">
                          <a className="text-action underline" href={`#/result/${p.attemptId}`}>
                            {p.title}
                          </a>
                        </td>
                        <td className="border border-line px-2 py-1">{formatScore(p.net)}</td>
                        <td className="border border-line px-2 py-1">{p.accuracy.toFixed(1)}%</td>
                        <td className="border border-line px-2 py-1">{formatDate(p.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </section>

        {trends.length > 0 && (
          <section>
            <SectionTitle>Accuracy per topic over time</SectionTitle>
            <TopicTrends trends={trends} />
          </section>
        )}

        {times.length > 0 && (
          <section>
            <SectionTitle>Average time per topic against target</SectionTitle>
            <div className="border border-line bg-white p-2">
              <TimeVsTarget times={times} />
            </div>
          </section>
        )}
      </>
    );
  };

  return (
    <AppShell route="dashboard">
      {error && <ErrorNote error={error} />}
      {!attempts && !error && <Loading />}
      {attempts && (
        <div className="mx-auto max-w-[1240px] space-y-4 p-4">
          <h1 className="text-lg font-bold text-navy">Progress</h1>
          {content()}
        </div>
      )}
    </AppShell>
  );
}
