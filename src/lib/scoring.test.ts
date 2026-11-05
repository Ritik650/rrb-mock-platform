import { describe, expect, it } from 'vitest';
import { outcomeOf, summarize, tallyQuestions } from './scoring';
import { paperFromMock } from './paper';
import { paletteState } from './examState';
import { loadRealBundle, makeQuestion } from '../test/bundle';
import type { QuestionProgress } from '../types';

const marking = { correct: 1, wrong: -0.25 };
const progress = (selected: number | null, marked = false, timeMs = 0): QuestionProgress => ({
  selected,
  marked,
  visited: true,
  timeMs,
  visitCount: 1,
});

describe('scoring', () => {
  it('40 correct, 10 wrong, 30 blank scores 37.5', () => {
    const qs = Array.from({ length: 80 }, (_, i) => makeQuestion(i + 1));
    const answers: Record<string, QuestionProgress> = {};
    qs.forEach((q, i) => {
      if (i < 40) answers[q.id] = progress(q.ans);
      else if (i < 50) answers[q.id] = progress((q.ans + 1) % 5);
    });
    const t = tallyQuestions(qs, answers, marking);
    expect(t.net).toBe(37.5);
    expect(t).toMatchObject({ total: 80, attempted: 50, correct: 40, wrong: 10, blank: 30, accuracy: 80 });
  });

  it('answered & marked counts for evaluation', () => {
    const q = makeQuestion(1);
    const p = progress(q.ans, true);
    expect(paletteState(p)).toBe('answered_marked');
    expect(tallyQuestions([q], { [q.id]: p }, marking)).toMatchObject({ attempted: 1, correct: 1, net: 1 });
  });

  it('marked only does not count', () => {
    const q = makeQuestion(1);
    const p = progress(null, true);
    expect(paletteState(p)).toBe('marked');
    expect(tallyQuestions([q], { [q.id]: p }, marking)).toMatchObject({ attempted: 0, blank: 1, net: 0 });
  });

  it('a wrong answer that was marked still costs marks', () => {
    const q = makeQuestion(1, { ans: 0 });
    expect(tallyQuestions([q], { [q.id]: progress(2, true) }, marking).net).toBe(-0.25);
  });

  it('classifies outcomes', () => {
    const q = makeQuestion(1, { ans: 3 });
    expect(outcomeOf(q, 3)).toBe('correct');
    expect(outcomeOf(q, 0)).toBe('wrong'); // option (a) is index 0, which must not read as blank
    expect(outcomeOf(q, null)).toBe('blank');
    expect(outcomeOf(q, undefined)).toBe('blank');
  });

  it('reports 0% accuracy, not NaN, when nothing was attempted', () => {
    expect(tallyQuestions([makeQuestion(1)], {}, marking).accuracy).toBe(0);
  });

  it('adds up time, including on unanswered questions', () => {
    const [a, b] = [makeQuestion(1), makeQuestion(2)];
    const t = tallyQuestions([a, b], { [a.id]: progress(0, false, 5000), [b.id]: progress(null, false, 7000) }, marking);
    expect(t.timeMs).toBe(12_000);
  });

  it('splits a real mock into sections and topics that add up', () => {
    const paper = paperFromMock(loadRealBundle().mocks[0]);
    const answers: Record<string, QuestionProgress> = {};
    paper.items.forEach(({ q }, i) => {
      if (i % 2 === 0) answers[q.id] = progress(q.ans, false, 1000);
    });
    const s = summarize(paper, answers);
    expect(s.overall.attempted).toBe(40);
    expect(s.overall.net).toBe(40);
    expect(s.sections.map((x) => x.tally.total)).toEqual([40, 40]);
    expect(s.sections.reduce((n, x) => n + x.tally.net, 0)).toBe(s.overall.net);
    expect(s.topics.reduce((n, t) => n + t.total, 0)).toBe(80);
    expect(s.topics.reduce((n, t) => n + t.correct, 0)).toBe(40);
    expect(s.topics.reduce((n, t) => n + t.timeMs, 0)).toBe(40_000);
  });
});
