/** Import format. This mirrors the bundle exactly; do not change its shape. */
export type Level = 'Exam level' | 'Hard';

export type Visual =
  | { type: 'table'; headers: string[]; rows: (string | number)[][] }
  | { type: 'pie'; labels: string[]; values: number[]; unit: string; title: string }
  | {
      type: 'bar' | 'line';
      categories: string[];
      series: { name: string; values: number[] }[];
      unit: string;
    }
  | {
      type: 'linear';
      facing: 'north' | 'south' | 'mixed';
      seats: { name: string; face: 'N' | 'S' | null; attr: string | null }[];
    }
  | { type: 'circle'; seats: { name: string; face: 'in' | 'out'; attr: string | null }[] }
  | {
      type: 'stack';
      style: 'box' | 'floor';
      levels: { name: string; attr: string | null; label: string }[];
    }
  | { type: 'schedule'; rows: { slot: string; name: string; attr: string | null }[] }
  | { type: 'floorflat'; floors: { floor: number; P: string; Q: string }[] }
  | { type: 'parallel'; row1: string[]; row2: string[] }
  | { type: 'tree'; gens: { gen: number; members: string[] }[] }
  | { type: 'coords'; points: Record<string, [number, number]> };

export interface Derived {
  headers: string[];
  rows: (string | number)[][];
}

export interface Question {
  id: string;
  no: number;
  section: string;
  set_id: string | null;
  stem: string;
  options: string[];
  ans: number;
  answer: string;
  sol: string[];
  topic: string;
  sub: string;
  time: number;
}

export interface Block {
  id: string;
  kind: 'set' | 'single';
  topic: string;
  sub: string;
  directions?: string;
  intro?: string;
  clues?: string[];
  visual?: Visual | null;
  derived?: Derived;
  qs: Question[];
}

export interface Section {
  name: string;
  blocks: Block[];
}

export interface Marking {
  correct: number;
  wrong: number;
}

export interface Mock {
  mock_no: number;
  title: string;
  level: Level;
  duration_min: number;
  marking: Marking;
  sections: Section[];
}

export interface Bundle {
  exam: string;
  n_mocks: number;
  pattern: unknown;
  notes: string;
  mocks: Mock[];
}

/** App records stored in IndexedDB. */
export interface QuestionProgress {
  selected: number | null;
  marked: boolean;
  visited: boolean;
  /** Time on this question, added up across revisits. */
  timeMs: number;
  visitCount: number;
}

export interface ResponseRow extends QuestionProgress {
  attemptId: string;
  qid: string;
}

export interface VisitRow {
  attemptId: string;
  seq: number;
  qid: string;
  enteredAt: number;
  leftAt: number;
  durationMs: number;
}

export interface Tally {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Percent of attempted questions that were correct. 0 when nothing was attempted. */
  accuracy: number;
  net: number;
  timeMs: number;
}

export interface TopicStat {
  topic: string;
  section: string;
  total: number;
  attempted: number;
  correct: number;
  timeMs: number;
  /** Sum of target seconds across every question in this group. */
  targetSec: number;
}

export interface AttemptSummary {
  overall: Tally;
  sections: { name: string; tally: Tally }[];
  topics: TopicStat[];
}

export type AttemptStatus = 'in_progress' | 'submitted';
export type AttemptKind = 'mock' | 'drill';

export interface Attempt {
  id: string;
  kind: AttemptKind;
  /** Set for full mocks. */
  mockNo: number | null;
  /** Set for drills: the bank blocks this paper was built from, in order. */
  blockIds: string[] | null;
  title: string;
  status: AttemptStatus;
  durationSec: number;
  startedAt: number;
  submittedAt: number | null;
  submitReason: 'manual' | 'timeout' | null;
  /**
   * Seconds per section when each has its own clock, in paper order. Null or absent means one clock
   * for the whole paper: drills, and mocks begun before sections were timed.
   */
  sectionLimitsSec?: number[] | null;
  /** Which section's clock is running. */
  activeSection?: number;
  /** Timer checkpoint: time left on the running clock at checkpointAt. */
  remainingMs: number;
  checkpointAt: number;
  activeQid: string | null;
  /** Where the visit still in progress began, on the paper's clock. */
  visitStartRemainingMs: number;
  visitEnteredAt: number;
  nextVisitSeq: number;
  summary: AttemptSummary | null;
}

export interface Bookmark {
  qid: string;
  createdAt: number;
}

export interface Settings {
  candidateName: string;
  cutOff: number;
  beepEnabled: boolean;
  /** Practice mode: show a Pause button in tests. Off by default, as in the real exam. */
  allowPause: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  candidateName: 'Ritik',
  cutOff: 64,
  beepEnabled: true,
  allowPause: false,
};
