import { describe, expect, it } from 'vitest';
import { attemptOrder, idealOrder, timeSinks, topicTable } from './analysis';
import { paperFromBlocks } from './paper';
import { summarize } from './scoring';
import { makeQuestion } from '../test/bundle';
import type { Block, QuestionProgress, Question } from '../types';

const block = (id: string, qs: Question[]): Block => ({
  id,
  kind: 'single',
  topic: qs[0].topic,
  sub: qs[0].sub,
  qs,
});

function paperOf(qs: Question[]) {
  return paperFromBlocks(
    'T',
    600,
    { correct: 1, wrong: -0.25 },
    qs.map((q) => block(`B-${q.no}`, [q])),
  );
}

const done = (selected: number | null, timeMs: number): QuestionProgress => ({
  selected,
  marked: false,
  visited: true,
  timeMs,
  visitCount: 1,
});

describe('topic table', () => {
  const qs = [
    makeQuestion(1, { topic: 'Puzzle', sub: 'Linear', time: 40, ans: 0 }),
    makeQuestion(2, { topic: 'Puzzle', sub: 'Linear', time: 40, ans: 0 }),
    makeQuestion(3, { topic: 'Puzzle', sub: 'Circle', time: 60, ans: 0 }),
    makeQuestion(4, { topic: 'Series', sub: 'Missing', time: 30, ans: 0 }),
  ];

  it('groups by topic, expands into sub-topics and computes the columns', () => {
    const rows = topicTable(paperOf(qs), {
      'T-Q1': done(0, 40_000),
      'T-Q2': done(1, 40_000),
      'T-Q3': done(null, 40_000),
    });
    const puzzle = rows[0];
    expect(puzzle).toMatchObject({ label: 'Puzzle', total: 3, attempted: 2, correct: 1, accuracy: 50 });
    // 120s spent across the topic, divided by the 2 answered questions.
    expect(puzzle.avgTimeMs).toBe(60_000);
    expect(puzzle.targetMs).toBe(40_000);
    expect(puzzle.subs.map((s) => s.label)).toEqual(['Linear', 'Circle']);
    expect(puzzle.subs[0]).toMatchObject({ attempted: 2, correct: 1 });
    expect(rows[1]).toMatchObject({ label: 'Series', attempted: 0, avgTimeMs: 0, lowAccuracy: false, slow: false });
  });

  it('flags accuracy strictly below 70%', () => {
    const ten = Array.from({ length: 10 }, (_, i) => makeQuestion(i + 1, { topic: 'X', sub: 'Y', ans: 0 }));
    const answers = (correct: number) =>
      Object.fromEntries(ten.map((q, i) => [q.id, done(i < correct ? 0 : 1, 1000)]));
    expect(topicTable(paperOf(ten), answers(7))[0].lowAccuracy).toBe(false);
    expect(topicTable(paperOf(ten), answers(6))[0].lowAccuracy).toBe(true);
  });

  it('flags average time strictly above 1.3 times target', () => {
    const q = makeQuestion(1, { topic: 'X', sub: 'Y', time: 100, ans: 0 });
    expect(topicTable(paperOf([q]), { [q.id]: done(0, 130_000) })[0].slow).toBe(false);
    expect(topicTable(paperOf([q]), { [q.id]: done(0, 130_001) })[0].slow).toBe(true);
  });

  it('still shows time sunk in a topic with nothing attempted', () => {
    const q = makeQuestion(1, { topic: 'X', sub: 'Y', time: 40 });
    const row = topicTable(paperOf([q]), { [q.id]: done(null, 100_000) })[0];
    expect(row).toMatchObject({ attempted: 0, avgTimeMs: 100_000, targetMs: 40_000, slow: true, lowAccuracy: false });
  });
});

describe('time sinks', () => {
  it('lists questions over 2x target, sorted by time lost, with their outcome', () => {
    const qs = [
      makeQuestion(1, { time: 40, ans: 0 }), // exactly 2x: not a sink
      makeQuestion(2, { time: 40, ans: 0 }), // lost 50s, right
      makeQuestion(3, { time: 60, ans: 0 }), // lost 90s, wrong
      makeQuestion(4, { time: 60, ans: 0 }), // lost 90s too, blank: later question sorts after
      makeQuestion(5, { time: 60, ans: 0 }), // under target
    ];
    const sinks = timeSinks(paperOf(qs), {
      'T-Q1': done(0, 80_000),
      'T-Q2': done(0, 90_000),
      'T-Q3': done(1, 150_000),
      'T-Q4': done(null, 150_000),
      'T-Q5': done(0, 10_000),
    });
    expect(sinks.map((s) => [s.item.q.no, s.lostMs, s.outcome])).toEqual([
      [3, 90_000, 'wrong'],
      [4, 90_000, 'blank'],
      [2, 50_000, 'correct'],
    ]);
  });
});

describe('attempt order', () => {
  it('uses first-visit order, ignores revisits and puts unopened questions last', () => {
    const qs = [1, 2, 3, 4].map((n) => makeQuestion(n, { ans: 0 }));
    const cells = attemptOrder(
      paperOf(qs),
      { 'T-Q3': done(0, 1), 'T-Q1': done(1, 1), 'T-Q2': done(null, 1) },
      [
        { qid: 'T-Q3', seq: 0 },
        { qid: 'T-Q1', seq: 1 },
        { qid: 'T-Q3', seq: 2 },
        { qid: 'T-Q2', seq: 3 },
      ],
    );
    expect(cells.map((c) => [c.item.q.no, c.result, c.position])).toEqual([
      [3, 'correct', 1],
      [1, 'wrong', 2],
      [2, 'blank', 3],
      [4, 'not_visited', null],
    ]);
  });

  it('always returns one cell per question', () => {
    const qs = Array.from({ length: 80 }, (_, i) => makeQuestion(i + 1));
    expect(attemptOrder(paperOf(qs), {}, [])).toHaveLength(80);
  });
});

describe('ideal order', () => {
  const qs = [
    makeQuestion(1, { topic: 'Fast', sub: 's', time: 30, ans: 0 }),
    makeQuestion(2, { topic: 'Slow', sub: 's', time: 30, ans: 0 }),
    makeQuestion(3, { topic: 'Guessy', sub: 's', time: 30, ans: 0 }),
    makeQuestion(4, { topic: 'Unseen', sub: 's', time: 60, ans: 0 }),
  ];
  const paper = paperOf(qs);

  it('ranks by expected marks per minute from past accuracy and time', () => {
    const history = [
      summarize(paper, {
        'T-Q1': done(0, 30_000), // always right, quick: 1 mark in 30s = 2/min
        'T-Q2': done(0, 120_000), // always right, slow: 0.5/min
        'T-Q3': done(1, 30_000), // always wrong: -0.25 in 30s = -0.5/min
      }),
    ];
    const rows = idealOrder(paper, history);
    // Unseen: assumed 70% gives 0.625 per question at its 60s target, so 0.625/min.
    expect(rows.map((r) => r.topic)).toEqual(['Fast', 'Unseen', 'Slow', 'Guessy']);
    const fast = rows.find((r) => r.topic === 'Fast')!;
    expect(fast.marksPerMinute).toBeCloseTo(2);
    expect(rows.find((r) => r.topic === 'Slow')!.marksPerMinute).toBeCloseTo(0.5);
    expect(rows.find((r) => r.topic === 'Guessy')!.marksPerMinute).toBeCloseTo(-0.5);
  });

  it('places a topic with no history using its target time and an assumed accuracy', () => {
    const row = idealOrder(paper, []).find((r) => r.topic === 'Unseen')!;
    expect(row.hasHistory).toBe(false);
    expect(row.secPerQuestion).toBe(60);
    expect(row.marksPerMinute).toBeCloseTo(0.625);
  });

  it('pools accuracy and time across attempts', () => {
    const one = summarize(paper, { 'T-Q1': done(0, 30_000) });
    const two = summarize(paper, { 'T-Q1': done(1, 90_000) });
    const fast = idealOrder(paper, [one, two]).find((r) => r.topic === 'Fast')!;
    expect(fast.attempted).toBe(2);
    expect(fast.accuracy).toBe(50);
    expect(fast.secPerQuestion).toBe(60);
    expect(fast.expectedPerQuestion).toBeCloseTo(0.375);
  });
});
