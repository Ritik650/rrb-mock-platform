import type { QuestionProgress } from '../types';

/**
 * The exam's rules as pure functions.
 *
 * A selected option is only a draft, as on the real console: it counts once Save & Next or
 * Mark for Review & Next stores it. Leaving a question any other way discards the draft.
 */
export interface Clock {
  now: number;
  remainingMs: number;
}

export interface VisitLogEntry {
  seq: number;
  qid: string;
  enteredAt: number;
  leftAt: number;
  durationMs: number;
}

export interface ExamState {
  order: string[];
  activeIndex: number;
  draft: number | null;
  progress: Record<string, QuestionProgress>;
  visitStartRemainingMs: number;
  visitEnteredAt: number;
  nextVisitSeq: number;
  /** Visits closed since this session began. Append-only. */
  visitLog: VisitLogEntry[];
}

export type PaletteState = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';

export const PALETTE_STATES: PaletteState[] = [
  'answered',
  'not_answered',
  'not_visited',
  'marked',
  'answered_marked',
];

export const PALETTE_LABELS: Record<PaletteState, string> = {
  not_visited: 'Not visited',
  not_answered: 'Not answered',
  answered: 'Answered',
  marked: 'Marked for review',
  answered_marked: 'Answered & marked for review',
};

export function blankProgress(): QuestionProgress {
  return { selected: null, marked: false, visited: false, timeMs: 0, visitCount: 0 };
}

export function paletteState(p: QuestionProgress): PaletteState {
  if (!p.visited) return 'not_visited';
  if (p.marked) return p.selected !== null ? 'answered_marked' : 'marked';
  return p.selected !== null ? 'answered' : 'not_answered';
}

export function countPalette(
  qids: string[],
  progress: Record<string, QuestionProgress>,
): Record<PaletteState, number> {
  const counts: Record<PaletteState, number> = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  for (const qid of qids) counts[paletteState(progress[qid] ?? blankProgress())] += 1;
  return counts;
}

function openVisit(s: ExamState, index: number, clock: Clock): ExamState {
  const qid = s.order[index];
  const p = s.progress[qid];
  return {
    ...s,
    activeIndex: index,
    draft: p.selected,
    progress: { ...s.progress, [qid]: { ...p, visited: true, visitCount: p.visitCount + 1 } },
    visitStartRemainingMs: clock.remainingMs,
    visitEnteredAt: clock.now,
  };
}

/** Time on a question comes off the paper's own clock, so per-question times add up to the total. */
export function closeVisit(s: ExamState, clock: Clock): ExamState {
  const qid = s.order[s.activeIndex];
  const durationMs = Math.max(0, s.visitStartRemainingMs - clock.remainingMs);
  const p = s.progress[qid];
  return {
    ...s,
    progress: { ...s.progress, [qid]: { ...p, timeMs: p.timeMs + durationMs } },
    nextVisitSeq: s.nextVisitSeq + 1,
    visitLog: [
      ...s.visitLog,
      { seq: s.nextVisitSeq, qid, enteredAt: s.visitEnteredAt, leftAt: clock.now, durationMs },
    ],
  };
}

export function startExam(order: string[], clock: Clock): ExamState {
  const progress: Record<string, QuestionProgress> = {};
  for (const qid of order) progress[qid] = blankProgress();
  return openVisit(
    {
      order,
      activeIndex: 0,
      draft: null,
      progress,
      visitStartRemainingMs: clock.remainingMs,
      visitEnteredAt: clock.now,
      nextVisitSeq: 0,
      visitLog: [],
    },
    0,
    clock,
  );
}

export interface SavedExam {
  progress: Record<string, QuestionProgress>;
  activeQid: string;
  visitStartRemainingMs: number;
  visitEnteredAt: number;
  nextVisitSeq: number;
  /** The last checkpoint: where the interrupted visit stopped. */
  remainingMs: number;
  checkpointAt: number;
}

/** Rebuilds a session after a reload: ends the interrupted visit at its last checkpoint, then reopens. */
export function resumeExam(order: string[], saved: SavedExam, clock: Clock): ExamState {
  const progress: Record<string, QuestionProgress> = {};
  for (const qid of order) progress[qid] = saved.progress[qid] ?? blankProgress();
  const index = Math.max(0, order.indexOf(saved.activeQid));
  const interrupted: ExamState = {
    order,
    activeIndex: index,
    draft: null,
    progress,
    visitStartRemainingMs: saved.visitStartRemainingMs,
    visitEnteredAt: saved.visitEnteredAt,
    nextVisitSeq: saved.nextVisitSeq,
    visitLog: [],
  };
  const closed = closeVisit(interrupted, { now: saved.checkpointAt, remainingMs: saved.remainingMs });
  return openVisit(closed, index, clock);
}

export function goTo(s: ExamState, index: number, clock: Clock): ExamState {
  if (index === s.activeIndex || index < 0 || index >= s.order.length) return s;
  return openVisit(closeVisit(s, clock), index, clock);
}

export const goNext = (s: ExamState, clock: Clock) => goTo(s, (s.activeIndex + 1) % s.order.length, clock);
export const goPrevious = (s: ExamState, clock: Clock) => goTo(s, s.activeIndex - 1, clock);

export function selectOption(s: ExamState, option: number): ExamState {
  return s.draft === option ? s : { ...s, draft: option };
}

function store(s: ExamState, marked: boolean): ExamState {
  const qid = s.order[s.activeIndex];
  return { ...s, progress: { ...s.progress, [qid]: { ...s.progress[qid], selected: s.draft, marked } } };
}

export const saveAndNext = (s: ExamState, clock: Clock) => goNext(store(s, false), clock);
export const markAndNext = (s: ExamState, clock: Clock) => goNext(store(s, true), clock);

/** Removes the answer. The question stays visited, and any review mark stays. */
export function clearResponse(s: ExamState): ExamState {
  const qid = s.order[s.activeIndex];
  return {
    ...s,
    draft: null,
    progress: { ...s.progress, [qid]: { ...s.progress[qid], selected: null } },
  };
}

export function hasUnsavedDraft(s: ExamState): boolean {
  return s.draft !== s.progress[s.order[s.activeIndex]].selected;
}
