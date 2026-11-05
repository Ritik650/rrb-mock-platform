import { describe, expect, it } from 'vitest';
import { drillTitle, planDrill, questionStandings, type QuestionStanding } from './drill';
import { loadRealBundle, makeQuestion } from '../test/bundle';
import type { Block, Question } from '../types';

const single = (no: number, topic = 'Syllogism', time = 40): Block => ({
  id: `S${no}`,
  kind: 'single',
  topic,
  sub: 's',
  qs: [makeQuestion(no, { topic, time })],
});

const set = (id: string, nos: number[], topic = 'Puzzle'): Block => ({
  id,
  kind: 'set',
  topic,
  sub: 's',
  qs: nos.map((n) => makeQuestion(n, { topic, set_id: id, time: 30 })),
});

const fixedRandom = () => 0.5;
const standings = (entries: [number, QuestionStanding][]) =>
  new Map(entries.map(([no, s]) => [`T-Q${no}`, s] as [string, QuestionStanding]));
const noSet = (ids: Block[]) => ids.map((b) => b.id);

describe('planDrill', () => {
  it('only uses the chosen topics', () => {
    const plan = planDrill([single(1), single(2, 'Ranking')], new Set(['Ranking']), 5, new Map(), fixedRandom);
    expect(noSet(plan.blocks)).toEqual(['S2']);
  });

  it('prefers wrong, then never seen, then skipped, then correct', () => {
    const blocks = [single(1), single(2), single(3), single(4)];
    const known = standings([
      [1, 'correct'],
      [2, 'skipped'],
      [4, 'wrong'],
    ]);
    const order = [1, 2, 3, 4].map((count) => noSet(planDrill(blocks, new Set(['Syllogism']), count, known, fixedRandom).blocks));
    expect(order[0]).toEqual(['S4']);
    expect(order[1]).toEqual(['S4', 'S3']); // S3 was never seen
    expect(order[2]).toEqual(['S4', 'S3', 'S2']);
    expect(order[3]).toEqual(['S4', 'S3', 'S2', 'S1']);
  });

  it('keeps sets together: one wrong question brings its whole set', () => {
    const blocks = [single(9), set('P1', [1, 2, 3, 4, 5])];
    const plan = planDrill(blocks, new Set(['Syllogism', 'Puzzle']), 5, standings([[3, 'wrong']]), fixedRandom);
    expect(noSet(plan.blocks)).toEqual(['P1']);
    expect(plan.questionCount).toBe(5);
  });

  it('takes a new question that fits rather than overshooting with a wrong set', () => {
    const blocks = [set('P1', [1, 2, 3, 4, 5]), single(9)];
    const plan = planDrill(blocks, new Set(['Syllogism', 'Puzzle']), 1, standings([[3, 'wrong']]), fixedRandom);
    expect(noSet(plan.blocks)).toEqual(['S9']);
  });

  it('prefers overshooting with a wrong set to filling up with a question already right', () => {
    const blocks = [set('P1', [1, 2, 3, 4, 5]), single(9)];
    const known = standings([
      [3, 'wrong'],
      [9, 'correct'],
    ]);
    const plan = planDrill(blocks, new Set(['Syllogism', 'Puzzle']), 1, known, fixedRandom);
    expect(noSet(plan.blocks)).toEqual(['P1']);
  });

  it('never splits a set across the whole real bank', () => {
    const bank = loadRealBundle().mocks.flatMap((m) => m.sections.flatMap((s) => s.blocks));
    const topics = new Set(bank.map((b) => b.topic));
    for (const count of [1, 7, 23, 80]) {
      const plan = planDrill(bank, topics, count, new Map());
      const chosen = plan.blocks.flatMap((b) => b.qs.map((q) => q.id));
      expect(new Set(chosen).size).toBe(chosen.length);
      expect(plan.questionCount).toBeGreaterThanOrEqual(count);
      for (const block of plan.blocks) {
        const original = bank.find((b) => b.id === block.id)!;
        expect(block.qs).toHaveLength(original.qs.length);
      }
    }
  });

  it('prefers a block that fits over overshooting within the same band', () => {
    const blocks = [set('P1', [1, 2, 3, 4, 5]), single(6, 'Puzzle')];
    const plan = planDrill(blocks, new Set(['Puzzle']), 1, new Map(), () => 0.999);
    expect(noSet(plan.blocks)).toEqual(['S6']);
    expect(plan.questionCount).toBe(1);
  });

  it('overshoots only when a set is the only way to reach the count', () => {
    const plan = planDrill([set('P1', [1, 2, 3, 4, 5])], new Set(['Puzzle']), 3, new Map(), fixedRandom);
    expect(plan.questionCount).toBe(5);
  });

  it('times the paper by the sum of the target times', () => {
    const plan = planDrill([single(1, 'X', 40), single(2, 'X', 25)], new Set(['X']), 2, new Map(), fixedRandom);
    expect(plan.durationSec).toBe(65);
  });

  it('uses each block\'s own shortened targets, rounded up to a whole second', () => {
    const blocks = [single(1, 'X', 40), single(2, 'X', 25)];
    const half = (b: Block) => (b.id === 'S1' ? 0.5 : 1);
    const plan = planDrill(blocks, new Set(['X']), 2, new Map(), fixedRandom, half);
    expect(plan.durationSec).toBe(45);
    const third = planDrill(blocks, new Set(['X']), 2, new Map(), fixedRandom, () => 1 / 3);
    expect(third.durationSec).toBe(22);
  });

  it('returns everything available when asked for more than exists', () => {
    const plan = planDrill([single(1), single(2)], new Set(['Syllogism']), 50, new Map(), fixedRandom);
    expect(plan.questionCount).toBe(2);
  });

  it('returns an empty plan when no topic is chosen', () => {
    expect(planDrill([single(1)], new Set(), 5, new Map(), fixedRandom).blocks).toEqual([]);
  });

  it('varies the paper between runs', () => {
    const blocks = Array.from({ length: 30 }, (_, i) => single(i + 1));
    const papers = new Set(
      Array.from({ length: 8 }, () => noSet(planDrill(blocks, new Set(['Syllogism']), 5, new Map()).blocks).join()),
    );
    expect(papers.size).toBeGreaterThan(1);
  });
});

describe('questionStandings', () => {
  const q = makeQuestion(1, { ans: 2 });
  const lookup = (qid: string): Question | undefined => (qid === q.id ? q : undefined);
  const standing = (rows: { selected: number | null; visited: boolean }[]) =>
    questionStandings(rows.map((r) => ({ qid: q.id, ...r })), lookup).get(q.id);

  it('marks a wrong answer as wrong and a right one as correct', () => {
    expect(standing([{ selected: 0, visited: true }])).toBe('wrong');
    expect(standing([{ selected: 2, visited: true }])).toBe('correct');
  });

  it('lets a later right answer clear an earlier mistake', () => {
    expect(standing([{ selected: 0, visited: true }, { selected: 2, visited: true }])).toBe('correct');
  });

  it('keeps an answer when a later attempt only skipped the question', () => {
    expect(standing([{ selected: 0, visited: true }, { selected: null, visited: true }])).toBe('wrong');
  });

  it('counts a question opened but unanswered as skipped, and unopened as never seen', () => {
    expect(standing([{ selected: null, visited: true }])).toBe('skipped');
    expect(standing([{ selected: null, visited: false }])).toBeUndefined();
  });

  it('ignores questions no longer in the bank', () => {
    expect(questionStandings([{ qid: 'gone', selected: 1, visited: true }], lookup).size).toBe(0);
  });
});

describe('drillTitle', () => {
  it('names up to three topics, then counts them', () => {
    expect(drillTitle(['Puzzle', 'Syllogism'], 12)).toBe('Drill: Puzzle, Syllogism (12 Q)');
    expect(drillTitle(['a', 'b', 'c', 'd'], 20)).toBe('Drill: 4 topics (20 Q)');
  });
});
