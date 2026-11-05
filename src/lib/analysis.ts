import type { AttemptSummary, Marking, QuestionProgress, VisitRow } from '../types';
import type { Paper, PaperItem } from './paper';
import { outcomeOf, type Outcome } from './scoring';

export const ACCURACY_FLOOR = 70;
export const SLOW_FACTOR = 1.3;
export const SINK_FACTOR = 2;
/** Assumed accuracy for a topic with no attempts yet, so it can still be placed in the order. */
export const NO_HISTORY_ACCURACY = 0.7;

type ProgressMap = Record<string, QuestionProgress | undefined>;

export interface GroupRow {
  key: string;
  label: string;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number;
  /** All time spent in this group per question attempted, so a long read that was abandoned still shows. */
  avgTimeMs: number;
  /** Mean target of the same questions. */
  targetMs: number;
  lowAccuracy: boolean;
  slow: boolean;
}

export interface TopicRow extends GroupRow {
  subs: GroupRow[];
}

function groupRow(key: string, label: string, items: PaperItem[], progress: ProgressMap): GroupRow {
  let attempted = 0;
  let correct = 0;
  let timeMs = 0;
  let attemptedTarget = 0;
  let visited = 0;
  let visitedTarget = 0;
  for (const { q, targetSec } of items) {
    const p = progress[q.id];
    const outcome = outcomeOf(q, p?.selected);
    timeMs += p?.timeMs ?? 0;
    if (outcome !== 'blank') {
      attempted += 1;
      attemptedTarget += targetSec;
    }
    if (outcome === 'correct') correct += 1;
    if ((p?.timeMs ?? 0) > 0) {
      visited += 1;
      visitedTarget += targetSec;
    }
  }
  // With nothing attempted, fall back to the questions you spent time on.
  const count = attempted > 0 ? attempted : visited;
  const target = attempted > 0 ? attemptedTarget : visitedTarget;
  const avgTimeMs = count > 0 ? timeMs / count : 0;
  const targetMs = count > 0 ? (target / count) * 1000 : 0;
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  return {
    key,
    label,
    total: items.length,
    attempted,
    correct,
    accuracy,
    avgTimeMs,
    targetMs,
    lowAccuracy: attempted > 0 && accuracy < ACCURACY_FLOOR,
    slow: count > 0 && avgTimeMs > SLOW_FACTOR * targetMs,
  };
}

/** Topic rows in paper order, each expandable into its sub-topics. */
export function topicTable(paper: Paper, progress: ProgressMap): TopicRow[] {
  const byTopic = new Map<string, PaperItem[]>();
  for (const item of paper.items) {
    const list = byTopic.get(item.q.topic);
    if (list) list.push(item);
    else byTopic.set(item.q.topic, [item]);
  }
  return [...byTopic].map(([topic, items]) => {
    const bySub = new Map<string, PaperItem[]>();
    for (const item of items) {
      const list = bySub.get(item.q.sub);
      if (list) list.push(item);
      else bySub.set(item.q.sub, [item]);
    }
    return {
      ...groupRow(topic, topic, items, progress),
      subs: [...bySub].map(([sub, subItems]) => groupRow(`${topic}/${sub}`, sub, subItems, progress)),
    };
  });
}

export interface TimeSink {
  item: PaperItem;
  timeMs: number;
  targetMs: number;
  lostMs: number;
  outcome: Outcome;
}

/** Questions that took more than twice their target, biggest loss first. */
export function timeSinks(paper: Paper, progress: ProgressMap): TimeSink[] {
  const sinks: TimeSink[] = [];
  for (const item of paper.items) {
    const p = progress[item.q.id];
    const timeMs = p?.timeMs ?? 0;
    const targetMs = item.targetSec * 1000;
    if (timeMs > SINK_FACTOR * targetMs) {
      sinks.push({ item, timeMs, targetMs, lostMs: timeMs - targetMs, outcome: outcomeOf(item.q, p?.selected) });
    }
  }
  return sinks.sort((a, b) => b.lostMs - a.lostMs || a.item.index - b.item.index);
}

export type CellResult = Outcome | 'not_visited';

export interface OrderCell {
  item: PaperItem;
  result: CellResult;
  timeMs: number;
  /** 1-based position in visit order, or null if never opened. */
  position: number | null;
}

/** One cell per question, in the order first opened. Questions never opened go at the end. */
export function attemptOrder(paper: Paper, progress: ProgressMap, visits: Pick<VisitRow, 'qid' | 'seq'>[]): OrderCell[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const v of [...visits].sort((a, b) => a.seq - b.seq)) {
    if (!seen.has(v.qid)) {
      seen.add(v.qid);
      ordered.push(v.qid);
    }
  }
  const cell = (item: PaperItem, position: number | null): OrderCell => {
    const p = progress[item.q.id];
    return {
      item,
      position,
      timeMs: p?.timeMs ?? 0,
      result: position === null ? 'not_visited' : outcomeOf(item.q, p?.selected),
    };
  };
  const visitedCells = ordered.flatMap((qid, i) => {
    const index = paper.indexById.get(qid);
    return index === undefined ? [] : [cell(paper.items[index], i + 1)];
  });
  const rest = paper.items.filter((item) => !seen.has(item.q.id)).map((item) => cell(item, null));
  return [...visitedCells, ...rest];
}

export interface IdealRow {
  topic: string;
  section: string;
  questions: number;
  hasHistory: boolean;
  /** Questions answered in this topic across all past attempts. */
  attempted: number;
  accuracy: number;
  secPerQuestion: number;
  expectedPerQuestion: number;
  marksPerMinute: number;
}

/**
 * Orders this paper's topics by expected marks per minute, from every finished attempt. A question
 * is worth p*correct + (1-p)*wrong on average and takes your usual time for the topic.
 */
export function idealOrder(paper: Paper, history: AttemptSummary[]): IdealRow[] {
  const inPaper = new Map<string, { section: string; questions: number; targetSec: number }>();
  for (const { q, section, targetSec } of paper.items) {
    const t = inPaper.get(q.topic) ?? { section, questions: 0, targetSec: 0 };
    t.questions += 1;
    t.targetSec += targetSec;
    inPaper.set(q.topic, t);
  }
  const past = new Map<string, { attempted: number; correct: number; timeMs: number }>();
  for (const summary of history) {
    for (const t of summary.topics) {
      const sum = past.get(t.topic) ?? { attempted: 0, correct: 0, timeMs: 0 };
      sum.attempted += t.attempted;
      sum.correct += t.correct;
      sum.timeMs += t.timeMs;
      past.set(t.topic, sum);
    }
  }
  return [...inPaper]
    .map(([topic, t]) => toIdealRow(topic, t, past.get(topic), paper.marking))
    .sort((a, b) => b.marksPerMinute - a.marksPerMinute || a.topic.localeCompare(b.topic));
}

export interface IdealGroup {
  /** Null when topics can be taken in any order across the paper. */
  section: string | null;
  rows: IdealRow[];
}

/**
 * With section clocks you cannot move between sections, so a single ranking across them could not
 * be followed. The ranking then restarts in each section, in paper order.
 */
export function idealOrderGroups(paper: Paper, history: AttemptSummary[], bySection: boolean): IdealGroup[] {
  const rows = idealOrder(paper, history);
  if (!bySection) return [{ section: null, rows }];
  return paper.sections
    .map((s) => ({ section: s.name, rows: rows.filter((r) => r.section === s.name) }))
    .filter((g) => g.rows.length > 0);
}

function toIdealRow(
  topic: string,
  t: { section: string; questions: number; targetSec: number },
  sum: { attempted: number; correct: number; timeMs: number } | undefined,
  marking: Marking,
): IdealRow {
  const hasHistory = (sum?.attempted ?? 0) > 0 && (sum?.timeMs ?? 0) > 0;
  const accuracy = hasHistory ? sum!.correct / sum!.attempted : NO_HISTORY_ACCURACY;
  const secPerQuestion = hasHistory ? sum!.timeMs / 1000 / sum!.attempted : t.targetSec / t.questions;
  const expectedPerQuestion = accuracy * marking.correct + (1 - accuracy) * marking.wrong;
  return {
    topic,
    section: t.section,
    questions: t.questions,
    hasHistory,
    attempted: sum?.attempted ?? 0,
    accuracy: accuracy * 100,
    secPerQuestion,
    expectedPerQuestion,
    marksPerMinute: expectedPerQuestion / (secPerQuestion / 60),
  };
}
