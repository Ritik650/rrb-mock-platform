import type { Attempt } from '../types';

export interface ScorePoint {
  attemptId: string;
  /** 1-based position among finished mocks. */
  n: number;
  title: string;
  net: number;
  total: number;
  accuracy: number;
  at: number;
}

const finished = (attempts: Attempt[]) =>
  attempts
    .filter((a) => a.status === 'submitted' && a.summary)
    .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));

/** Full mocks only. A short drill's score has no meaning against the cut-off. */
export function scoreSeries(attempts: Attempt[]): ScorePoint[] {
  return finished(attempts)
    .filter((a) => a.kind === 'mock')
    .map((a, i) => ({
      attemptId: a.id,
      n: i + 1,
      title: a.title,
      net: a.summary!.overall.net,
      total: a.summary!.overall.total,
      accuracy: a.summary!.overall.accuracy,
      at: a.submittedAt ?? a.startedAt,
    }));
}

export interface TopicTrend {
  topic: string;
  /** One point per attempt that answered at least one question in this topic. */
  points: { attemptId: string; accuracy: number; attempted: number; at: number }[];
}

export function topicTrends(attempts: Attempt[]): TopicTrend[] {
  const trends = new Map<string, TopicTrend>();
  for (const a of finished(attempts)) {
    for (const t of a.summary!.topics) {
      if (t.attempted === 0) continue;
      let trend = trends.get(t.topic);
      if (!trend) {
        trend = { topic: t.topic, points: [] };
        trends.set(t.topic, trend);
      }
      trend.points.push({
        attemptId: a.id,
        accuracy: (t.correct / t.attempted) * 100,
        attempted: t.attempted,
        at: a.submittedAt ?? a.startedAt,
      });
    }
  }
  return [...trends.values()];
}

export interface TopicTime {
  topic: string;
  attempted: number;
  /** All time in the topic per question answered, matching the analysis page. */
  avgSec: number;
  targetSec: number;
}

export function topicTimes(attempts: Attempt[]): TopicTime[] {
  const sums = new Map<string, { attempted: number; timeMs: number; targetSec: number; total: number }>();
  for (const a of finished(attempts)) {
    for (const t of a.summary!.topics) {
      const s = sums.get(t.topic) ?? { attempted: 0, timeMs: 0, targetSec: 0, total: 0 };
      s.attempted += t.attempted;
      s.timeMs += t.timeMs;
      s.targetSec += t.targetSec;
      s.total += t.total;
      sums.set(t.topic, s);
    }
  }
  return [...sums]
    .filter(([, s]) => s.attempted > 0)
    .map(([topic, s]) => ({
      topic,
      attempted: s.attempted,
      avgSec: s.timeMs / 1000 / s.attempted,
      targetSec: s.targetSec / s.total,
    }));
}

export interface Totals {
  solved: number;
  correct: number;
  mocks: number;
  drills: number;
  best: number | null;
}

export function totals(attempts: Attempt[]): Totals {
  const done = finished(attempts);
  const mocks = done.filter((a) => a.kind === 'mock');
  return {
    solved: done.reduce((n, a) => n + a.summary!.overall.attempted, 0),
    correct: done.reduce((n, a) => n + a.summary!.overall.correct, 0),
    mocks: mocks.length,
    drills: done.length - mocks.length,
    best: mocks.length ? Math.max(...mocks.map((a) => a.summary!.overall.net)) : null,
  };
}
