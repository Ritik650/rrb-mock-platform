import { describe, expect, it } from 'vitest';
import { scoreSeries, topicTimes, topicTrends, totals } from './progress';
import type { Attempt, TopicStat } from '../types';

const topic = (name: string, attempted: number, correct: number, timeMs: number, total = 5, targetSec = 200): TopicStat => ({
  topic: name,
  section: 'S',
  total,
  attempted,
  correct,
  timeMs,
  targetSec,
});

function attempt(id: string, at: number, net: number, topics: TopicStat[], over: Partial<Attempt> = {}): Attempt {
  const attempted = topics.reduce((n, t) => n + t.attempted, 0);
  const correct = topics.reduce((n, t) => n + t.correct, 0);
  return {
    id,
    kind: 'mock',
    mockNo: 1,
    blockIds: null,
    title: `Paper ${id}`,
    status: 'submitted',
    submittedAt: at,
    startedAt: at - 100,
    summary: {
      overall: {
        total: 80,
        attempted,
        correct,
        wrong: attempted - correct,
        blank: 80 - attempted,
        accuracy: attempted ? (correct / attempted) * 100 : 0,
        net,
        timeMs: 0,
      },
      sections: [],
      topics,
    },
    ...over,
  } as Attempt;
}

const open = attempt('open', 500, 0, [], { status: 'in_progress', summary: null });
const late = attempt('b', 200, 50, [topic('Puzzle', 4, 2, 80_000)]);
const early = attempt('a', 100, 30, [topic('Puzzle', 2, 2, 40_000), topic('Syllogism', 0, 0, 5000)]);
const drill = attempt('d', 150, 3, [topic('Puzzle', 4, 1, 40_000)], { kind: 'drill', mockNo: null });

describe('progress', () => {
  it('plots finished mocks only, oldest first', () => {
    const series = scoreSeries([late, open, drill, early]);
    expect(series.map((p) => [p.attemptId, p.n, p.net])).toEqual([
      ['a', 1, 30],
      ['b', 2, 50],
    ]);
  });

  it('tracks accuracy per topic over time, including drills, skipping unanswered topics', () => {
    const trends = topicTrends([late, drill, early]);
    expect(trends.map((t) => t.topic)).toEqual(['Puzzle']);
    expect(trends[0].points.map((p) => [p.attemptId, p.accuracy])).toEqual([
      ['a', 100],
      ['d', 25],
      ['b', 50],
    ]);
  });

  it('pools average time per topic against its target', () => {
    const times = topicTimes([early, late]);
    expect(times).toEqual([{ topic: 'Puzzle', attempted: 6, avgSec: 20, targetSec: 40 }]);
  });

  it('counts total questions solved across mocks and drills', () => {
    expect(totals([early, late, drill, open])).toEqual({ solved: 10, correct: 5, mocks: 2, drills: 1, best: 50 });
  });

  it('handles having no finished attempts', () => {
    expect(scoreSeries([open])).toEqual([]);
    expect(topicTrends([])).toEqual([]);
    expect(totals([open])).toEqual({ solved: 0, correct: 0, mocks: 0, drills: 0, best: null });
  });
});
