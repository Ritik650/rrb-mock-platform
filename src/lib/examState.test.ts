import { describe, expect, it } from 'vitest';
import {
  clearResponse,
  closeVisit,
  countPalette,
  goNext,
  goPrevious,
  goTo,
  hasUnsavedDraft,
  markAndNext,
  paletteState,
  resumeExam,
  saveAndNext,
  selectOption,
  startExam,
  type Clock,
  type ExamState,
} from './examState';

const order = ['q1', 'q2', 'q3', 'q4'];
const at = (remainingMs: number, now = 1000): Clock => ({ now, remainingMs });
const fresh = () => startExam(order, at(100_000));
const stateOf = (s: ExamState, qid: string) => paletteState(s.progress[qid]);

describe('palette states', () => {
  it('starts with Q1 visited and the rest not visited', () => {
    const s = fresh();
    expect(stateOf(s, 'q1')).toBe('not_answered');
    expect(stateOf(s, 'q2')).toBe('not_visited');
    expect(countPalette(order, s.progress)).toMatchObject({ not_answered: 1, not_visited: 3 });
  });

  it('visiting a question without answering marks it red', () => {
    const s = goTo(fresh(), 2, at(90_000));
    expect(stateOf(s, 'q3')).toBe('not_answered');
    expect(stateOf(s, 'q2')).toBe('not_visited');
  });

  it('Save & Next with an option makes it answered', () => {
    const s = saveAndNext(selectOption(fresh(), 3), at(90_000));
    expect(stateOf(s, 'q1')).toBe('answered');
    expect(s.progress.q1.selected).toBe(3);
    expect(s.activeIndex).toBe(1);
  });

  it('Save & Next with nothing selected leaves it not answered', () => {
    const s = saveAndNext(fresh(), at(90_000));
    expect(stateOf(s, 'q1')).toBe('not_answered');
  });

  it('Clear Response removes the answer but keeps the visited state', () => {
    let s = saveAndNext(selectOption(fresh(), 1), at(90_000));
    s = goTo(s, 0, at(80_000));
    expect(s.draft).toBe(1);
    s = clearResponse(s);
    expect(s.draft).toBeNull();
    expect(s.progress.q1.selected).toBeNull();
    expect(s.progress.q1.visited).toBe(true);
    expect(stateOf(s, 'q1')).toBe('not_answered');
  });

  it('Mark & Next on an answered question gives the purple-with-tick state', () => {
    let s = saveAndNext(selectOption(fresh(), 2), at(90_000));
    s = goTo(s, 0, at(80_000));
    s = markAndNext(s, at(70_000));
    expect(stateOf(s, 'q1')).toBe('answered_marked');
    expect(s.progress.q1.selected).toBe(2);
  });

  it('Mark & Next with a new selection stores it and gives the tick state', () => {
    const s = markAndNext(selectOption(fresh(), 4), at(90_000));
    expect(stateOf(s, 'q1')).toBe('answered_marked');
    expect(s.progress.q1.selected).toBe(4);
  });

  it('Mark & Next with no answer gives plain marked', () => {
    const s = markAndNext(fresh(), at(90_000));
    expect(stateOf(s, 'q1')).toBe('marked');
    expect(s.progress.q1.selected).toBeNull();
  });

  it('Clear Response on answered & marked leaves it marked', () => {
    let s = markAndNext(selectOption(fresh(), 4), at(90_000));
    s = clearResponse(goTo(s, 0, at(80_000)));
    expect(stateOf(s, 'q1')).toBe('marked');
  });

  it('Save & Next removes an earlier review mark', () => {
    let s = markAndNext(selectOption(fresh(), 4), at(90_000));
    s = saveAndNext(goTo(s, 0, at(80_000)), at(70_000));
    expect(stateOf(s, 'q1')).toBe('answered');
  });
});

describe('unsaved selections', () => {
  it('leaving a question without saving discards the selection, as on the real console', () => {
    let s = selectOption(fresh(), 3);
    expect(hasUnsavedDraft(s)).toBe(true);
    s = goNext(s, at(90_000));
    expect(s.progress.q1.selected).toBeNull();
    expect(stateOf(s, 'q1')).toBe('not_answered');
    expect(goTo(s, 0, at(80_000)).draft).toBeNull();
  });

  it('changing a saved answer without saving keeps the old answer', () => {
    let s = saveAndNext(selectOption(fresh(), 1), at(90_000));
    s = selectOption(goTo(s, 0, at(80_000)), 2);
    s = goNext(s, at(70_000));
    expect(s.progress.q1.selected).toBe(1);
  });
});

describe('navigation', () => {
  it('moves forward past the end back to Q1, and stays put at Previous on Q1', () => {
    let s = goTo(fresh(), 3, at(90_000));
    s = goNext(s, at(80_000));
    expect(s.activeIndex).toBe(0);
    expect(goPrevious(s, at(70_000))).toBe(s);
  });

  it('going to the current question changes nothing', () => {
    const s = fresh();
    expect(goTo(s, 0, at(90_000))).toBe(s);
  });
});

describe('time on question', () => {
  it('adds up across revisits and logs every visit with timestamps', () => {
    let s = startExam(order, at(100_000, 1000));
    s = goTo(s, 1, at(90_000, 11_000)); // q1: 10s
    s = goTo(s, 0, at(85_000, 16_000)); // q2: 5s
    s = goTo(s, 2, at(80_000, 21_000)); // q1 again: 5s
    expect(s.progress.q1.timeMs).toBe(15_000);
    expect(s.progress.q2.timeMs).toBe(5_000);
    expect(s.progress.q1.visitCount).toBe(2);
    expect(s.visitLog.map((v) => [v.seq, v.qid, v.enteredAt, v.leftAt, v.durationMs])).toEqual([
      [0, 'q1', 1000, 11_000, 10_000],
      [1, 'q2', 11_000, 16_000, 5_000],
      [2, 'q1', 16_000, 21_000, 5_000],
    ]);
  });

  it('per-question time adds up to the time used on the paper', () => {
    let s = startExam(order, at(100_000));
    s = goTo(s, 2, at(77_000));
    s = goTo(s, 1, at(40_000));
    s = closeVisit(s, at(12_000));
    const total = order.reduce((sum, q) => sum + s.progress[q].timeMs, 0);
    expect(total).toBe(100_000 - 12_000);
  });
});

describe('resume after reload', () => {
  it('keeps answers, closes the interrupted visit at its checkpoint and reopens the question', () => {
    let s = saveAndNext(selectOption(startExam(order, at(100_000, 1000)), 2), at(90_000, 11_000));
    s = goTo(s, 2, at(80_000, 21_000));
    // Tab closes at the 70s checkpoint and reopens long afterwards.
    const resumed = resumeExam(
      order,
      {
        progress: s.progress,
        activeQid: 'q3',
        visitStartRemainingMs: s.visitStartRemainingMs,
        visitEnteredAt: s.visitEnteredAt,
        nextVisitSeq: s.nextVisitSeq,
        remainingMs: 70_000,
        checkpointAt: 31_000,
      },
      at(70_000, 999_000),
    );
    expect(resumed.activeIndex).toBe(2);
    expect(resumed.progress.q1.selected).toBe(2);
    expect(resumed.progress.q3.timeMs).toBe(10_000); // only up to the checkpoint
    expect(resumed.visitLog).toEqual([
      { seq: s.nextVisitSeq, qid: 'q3', enteredAt: 21_000, leftAt: 31_000, durationMs: 10_000 },
    ]);
    expect(resumed.visitStartRemainingMs).toBe(70_000);
    expect(resumed.visitEnteredAt).toBe(999_000);
  });
});
