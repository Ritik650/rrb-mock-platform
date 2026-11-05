import { useEffect, useMemo } from 'react';
import { AppShell } from '../components/common/AppShell';
import { Button, ErrorNote, Loading, SectionTitle } from '../components/common/ui';
import { AttemptOrderStrip } from '../components/result/AttemptOrderStrip';
import { IdealOrderList, TimeSinkList } from '../components/result/InsightLists';
import { ScoreHero, SectionTable } from '../components/result/ScoreSummary';
import { TopicTable } from '../components/result/TopicTable';
import { loadAttempt, submittedAttempts } from '../data/attemptStore';
import { useSettings } from '../data/settings';
import { attemptOrder, idealOrder, timeSinks, topicTable } from '../lib/analysis';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

export function ResultPage({ attemptId }: { attemptId: string }) {
  const [settings] = useSettings();
  const { data, error } = useAsync(
    async () => ({ loaded: await loadAttempt(attemptId), history: await submittedAttempts() }),
    [attemptId],
  );

  const stillOpen = data?.loaded.attempt.status === 'in_progress';
  useEffect(() => {
    if (stillOpen) navigate(`/exam/${attemptId}`);
  }, [stillOpen, attemptId]);

  const analysis = useMemo(() => {
    if (!data || !data.loaded.attempt.summary) return null;
    const { paper, responses, visits } = data.loaded;
    const summaries = data.history.flatMap((a) => (a.summary ? [a.summary] : []));
    return {
      summary: data.loaded.attempt.summary,
      topics: topicTable(paper, responses),
      sinks: timeSinks(paper, responses),
      order: attemptOrder(paper, responses, visits),
      ideal: idealOrder(paper, summaries),
    };
  }, [data]);

  return (
    <AppShell route="result">
      {error && <ErrorNote error={error} />}
      {(!data || !settings) && !error && <Loading label="Marking your paper…" />}
      {data && analysis && settings && (
        <div className="mx-auto max-w-[1240px] space-y-4 p-4">
          <div>
            <h1 className="text-lg font-bold text-navy">{data.loaded.attempt.title}</h1>
            <p className="text-xs text-ink-2">
              Submitted {formatDate(data.loaded.attempt.submittedAt ?? data.loaded.attempt.startedAt)}
            </p>
          </div>
          <section aria-label="Score" className="flex flex-wrap items-start justify-between gap-4 border border-line bg-white p-4">
            <ScoreHero
              attempt={data.loaded.attempt}
              overall={analysis.summary.overall}
              cutOff={settings.cutOff}
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => navigate(`/review/${attemptId}`)}>
                Review solutions
              </Button>
              <Button onClick={() => navigate(data.loaded.attempt.kind === 'drill' ? '/drill' : '/')}>
                {data.loaded.attempt.kind === 'drill' ? 'Back to drills' : 'Back to mocks'}
              </Button>
            </div>
          </section>

          <section>
            <SectionTitle>Score by section</SectionTitle>
            <SectionTable overall={analysis.summary.overall} sections={analysis.summary.sections} />
          </section>

          <section>
            <SectionTitle>Attempt order</SectionTitle>
            <AttemptOrderStrip cells={analysis.order} attemptId={attemptId} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section>
              <SectionTitle>Topic performance</SectionTitle>
              <TopicTable rows={analysis.topics} />
            </section>
            <div className="space-y-4">
              <section>
                <SectionTitle>Time sinks ({analysis.sinks.length})</SectionTitle>
                <TimeSinkList sinks={analysis.sinks} attemptId={attemptId} />
              </section>
              <section>
                <SectionTitle>Suggested attempt order</SectionTitle>
                <IdealOrderList rows={analysis.ideal} />
              </section>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
