import { db } from './db';
import { loadBank, type Bank } from './mockStore';
import { closeVisit, type Clock, type ExamState } from '../lib/examState';
import { paperFromBlocks, paperFromMock, type Paper } from '../lib/paper';
import { sectionLimitsFor } from '../lib/sectionTiming';
import { summarize } from '../lib/scoring';
import type { Attempt, Block, Marking, QuestionProgress, ResponseRow, VisitRow } from '../types';

export interface MockStats {
  best: number | null;
  attempts: Attempt[];
  inProgress: Attempt | null;
}

export interface LoadedAttempt {
  attempt: Attempt;
  paper: Paper;
  responses: Record<string, QuestionProgress>;
  visits: VisitRow[];
}

/** Works on any origin. crypto.randomUUID needs HTTPS, which a LAN address would not have. */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function newAttempt(
  fields: Pick<Attempt, 'kind' | 'mockNo' | 'blockIds' | 'title' | 'durationSec' | 'sectionLimitsSec'>,
): Attempt {
  const now = Date.now();
  const firstClockMs = (fields.sectionLimitsSec?.[0] ?? fields.durationSec) * 1000;
  return {
    ...fields,
    id: newId(),
    status: 'in_progress',
    startedAt: now,
    submittedAt: null,
    submitReason: null,
    activeSection: 0,
    remainingMs: firstClockMs,
    checkpointAt: now,
    activeQid: null,
    visitStartRemainingMs: firstClockMs,
    visitEnteredAt: now,
    nextVisitSeq: 0,
    summary: null,
  };
}

export async function createMockAttempt(mockNo: number): Promise<string> {
  const mock = await db.mocks.get(mockNo);
  if (!mock) throw new Error(`Mock ${mockNo} is not in your library.`);
  const attempt = newAttempt({
    kind: 'mock',
    mockNo,
    blockIds: null,
    title: mock.title,
    durationSec: mock.duration_min * 60,
    sectionLimitsSec: sectionLimitsFor(mock),
  });
  await db.attempts.add(attempt);
  return attempt.id;
}

export async function createDrillAttempt(title: string, blocks: Block[], durationSec: number): Promise<string> {
  const attempt = newAttempt({
    kind: 'drill',
    mockNo: null,
    blockIds: blocks.map((b) => b.id),
    title,
    durationSec,
    sectionLimitsSec: null,
  });
  await db.attempts.add(attempt);
  return attempt.id;
}

const DEFAULT_MARKING: Marking = { correct: 1, wrong: -0.25 };

export function paperForAttempt(attempt: Attempt, bank: Bank): Paper {
  if (attempt.kind === 'mock') {
    const mock = bank.mocks.find((m) => m.mock_no === attempt.mockNo);
    if (!mock) throw new Error(`Mock ${attempt.mockNo} is no longer in your library. Import it again to open this attempt.`);
    return paperFromMock(mock);
  }
  const found = (attempt.blockIds ?? []).map((id) => bank.blocks.get(id));
  const entries = found.filter((f) => f !== undefined);
  if (entries.length === 0 || entries.length !== found.length) {
    throw new Error('Some questions from this drill are no longer in your library.');
  }
  const marking = entries[0]?.mock.marking ?? DEFAULT_MARKING;
  return paperFromBlocks(attempt.title, attempt.durationSec, marking, entries.map((e) => e.block));
}

export async function loadAttempt(id: string): Promise<LoadedAttempt> {
  const attempt = await db.attempts.get(id);
  if (!attempt) throw new Error('This attempt no longer exists.');
  const [bank, rows, visits] = await Promise.all([
    loadBank(),
    db.responses.where('attemptId').equals(id).toArray(),
    db.visits.where('attemptId').equals(id).sortBy('seq'),
  ]);
  const responses: Record<string, QuestionProgress> = {};
  for (const { attemptId: _attemptId, qid, ...progress } of rows) responses[qid] = progress;
  return { attempt, paper: paperForAttempt(attempt, bank), responses, visits };
}

export interface ExamDelta {
  rows: { qid: string; progress: QuestionProgress }[];
  visits: Omit<VisitRow, 'attemptId'>[];
  patch: Partial<Attempt>;
}

export async function saveExamDelta(attemptId: string, delta: ExamDelta): Promise<void> {
  await db.transaction('rw', db.attempts, db.responses, db.visits, async () => {
    if (delta.rows.length > 0) {
      const rows: ResponseRow[] = delta.rows.map((r) => ({ attemptId, qid: r.qid, ...r.progress }));
      await db.responses.bulkPut(rows);
    }
    if (delta.visits.length > 0) await db.visits.bulkPut(delta.visits.map((v) => ({ attemptId, ...v })));
    await db.attempts.update(attemptId, delta.patch);
  });
}

export async function checkpointAttempt(attemptId: string, remainingMs: number, at: number): Promise<void> {
  await db.attempts.update(attemptId, { remainingMs, checkpointAt: at });
}

/** Closes the open visit and files the final answers and score, all or nothing. */
export async function submitAttempt(
  attemptId: string,
  paper: Paper,
  state: ExamState,
  clock: Clock,
  reason: 'manual' | 'timeout',
): Promise<void> {
  const closed = closeVisit(state, clock);
  const summary = summarize(paper, closed.progress);
  const rows: ResponseRow[] = closed.order.map((qid) => ({ attemptId, qid, ...closed.progress[qid] }));
  await db.transaction('rw', db.attempts, db.responses, db.visits, async () => {
    await db.responses.bulkPut(rows);
    await db.visits.bulkPut(closed.visitLog.map((v) => ({ attemptId, ...v })));
    await db.attempts.update(attemptId, {
      status: 'submitted',
      submittedAt: clock.now,
      submitReason: reason,
      remainingMs: clock.remainingMs,
      checkpointAt: clock.now,
      nextVisitSeq: closed.nextVisitSeq,
      summary,
    });
  });
}

export async function discardAttempt(id: string): Promise<void> {
  await db.transaction('rw', db.attempts, db.responses, db.visits, async () => {
    await db.responses.where('attemptId').equals(id).delete();
    await db.visits.where('attemptId').equals(id).delete();
    await db.attempts.delete(id);
  });
}

/** Best score, finished attempts (newest first) and any open attempt, per mock. */
export async function mockStats(): Promise<Map<number, MockStats>> {
  const rows = await db.attempts.where('kind').equals('mock').toArray();
  const stats = new Map<number, MockStats>();
  for (const a of rows.sort((x, y) => y.startedAt - x.startedAt)) {
    if (a.mockNo === null) continue;
    let s = stats.get(a.mockNo);
    if (!s) {
      s = { best: null, attempts: [], inProgress: null };
      stats.set(a.mockNo, s);
    }
    if (a.status === 'in_progress') {
      s.inProgress = a;
    } else {
      s.attempts.push(a);
      const net = a.summary?.overall.net;
      if (net !== undefined && (s.best === null || net > s.best)) s.best = net;
    }
  }
  return stats;
}

export async function submittedAttempts(): Promise<Attempt[]> {
  const rows = await db.attempts.where('status').equals('submitted').toArray();
  return rows.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
}

/** Every answer from every finished attempt, oldest attempt first, for ranking drill questions. */
export async function historyRows(): Promise<ResponseRow[]> {
  const [attempts, rows] = await Promise.all([submittedAttempts(), db.responses.toArray()]);
  const rank = new Map(attempts.map((a, i) => [a.id, i]));
  return rows
    .filter((r) => rank.has(r.attemptId))
    .sort((a, b) => (rank.get(a.attemptId) ?? 0) - (rank.get(b.attemptId) ?? 0));
}
