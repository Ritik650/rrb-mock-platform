import { useMemo, useState } from 'react';
import { AppShell } from '../components/common/AppShell';
import { Button, ErrorNote, Loading, SectionTitle } from '../components/common/ui';
import { createDrillAttempt, discardAttempt, historyRows } from '../data/attemptStore';
import { db } from '../data/db';
import { loadBank } from '../data/mockStore';
import { drillTitle, planDrill, questionStandings } from '../lib/drill';
import { formatClock, formatDate, formatDuration, formatScore } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { navigate } from '../router';

interface TopicInfo {
  topic: string;
  section: string;
  total: number;
  wrong: number;
  fresh: number;
}

async function loadDrillData() {
  const [bank, rows, attempts] = await Promise.all([loadBank(), historyRows(), db.attempts.where('kind').equals('drill').toArray()]);
  const standings = questionStandings(rows, (qid) => bank.questions.get(qid)?.q);
  const byTopic = new Map<string, TopicInfo>();
  for (const { q } of bank.questions.values()) {
    const info = byTopic.get(q.topic) ?? { topic: q.topic, section: q.section, total: 0, wrong: 0, fresh: 0 };
    const standing = standings.get(q.id);
    info.total += 1;
    if (standing === 'wrong') info.wrong += 1;
    if (standing === undefined) info.fresh += 1;
    byTopic.set(q.topic, info);
  }
  return {
    blocks: [...bank.blocks.values()].map((b) => b.block),
    standings,
    topics: [...byTopic.values()],
    open: attempts.filter((a) => a.status === 'in_progress'),
    done: attempts.filter((a) => a.status === 'submitted').sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)),
  };
}

export function DrillPage() {
  const { data, error, reload } = useAsync(loadDrillData, []);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [count, setCount] = useState('20');
  const [notice, setNotice] = useState<string | null>(null);

  const sections = useMemo(() => {
    const names = [...new Set(data?.topics.map((t) => t.section))];
    return names.map((name) => ({ name, topics: data!.topics.filter((t) => t.section === name) }));
  }, [data]);

  const toggle = (topic: string) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });

  const requested = Math.floor(Number(count));
  const countValid = Number.isFinite(requested) && requested >= 1;

  async function start() {
    if (!data) return;
    const plan = planDrill(data.blocks, chosen, requested, data.standings);
    if (plan.questionCount === 0) {
      setNotice('No questions match those topics.');
      return;
    }
    const id = await createDrillAttempt(drillTitle([...chosen], plan.questionCount), plan.blocks, plan.durationSec);
    navigate(`/exam/${id}`);
  }

  return (
    <AppShell route="drill">
      {error && <ErrorNote error={error} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="mx-auto max-w-[1100px] space-y-4 p-4">
          <h1 className="text-lg font-bold text-navy">Topic drill</h1>
          {data.open.length > 0 && (
            <section aria-label="Unfinished drills" className="border-2 border-action bg-white p-3">
              <SectionTitle>Unfinished</SectionTitle>
              <ul className="space-y-1">
                {data.open.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span>
                      {a.title} · {formatClock(a.remainingMs)} left
                    </span>
                    <span className="flex gap-2">
                      <Button variant="primary" onClick={() => navigate(`/exam/${a.id}`)}>
                        Resume
                      </Button>
                      <Button onClick={() => void discardAttempt(a.id).then(reload)}>Discard</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Build a drill" className="border border-line bg-white p-3">
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((s) => (
                <fieldset key={s.name}>
                  <legend className="mb-1 text-[13px] font-semibold text-navy">{s.name}</legend>
                  <ul className="space-y-0.5">
                    {s.topics.map((t) => (
                      <li key={t.topic}>
                        <label className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-[13px] hover:bg-panel">
                          <input
                            type="checkbox"
                            checked={chosen.has(t.topic)}
                            onChange={() => toggle(t.topic)}
                            className="h-3.5 w-3.5 accent-action"
                          />
                          <span className="flex-1">{t.topic}</span>
                          <span className="text-xs text-ink-2 tabular-nums">
                            {t.total} Q · {t.wrong} wrong · {t.fresh} new
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <label className="flex items-center gap-2 text-[13px]">
                Questions
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="h-8 w-20 border border-ink-3 px-2 tabular-nums"
                />
              </label>
              <Button variant="primary" disabled={chosen.size === 0 || !countValid} onClick={() => void start()}>
                Start drill
              </Button>
              <p className="text-xs text-ink-2">
                Questions you got wrong or never saw come first. Sets stay whole, so a drill can run a little over.
                The clock is the sum of the target times.
              </p>
            </div>
            {notice && (
              <p role="alert" className="mt-2 text-[13px] text-nans">
                {notice}
              </p>
            )}
          </section>

          {data.done.length > 0 && (
            <section>
              <SectionTitle>Past drills</SectionTitle>
              <ul className="divide-y divide-line border border-line bg-white">
                {data.done.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span>
                      <span className="font-semibold">{a.title}</span>
                      <span className="block text-ink-2 tabular-nums">
                        {formatDate(a.submittedAt ?? a.startedAt)} · Net {formatScore(a.summary?.overall.net ?? 0)} ·{' '}
                        {(a.summary?.overall.accuracy ?? 0).toFixed(0)}% ·{' '}
                        {formatDuration(a.summary?.overall.timeMs ?? 0)} of {formatDuration(a.durationSec * 1000)}
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
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
