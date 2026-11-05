import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { db } from './db';
import type { Attempt, ResponseRow, VisitRow } from '../types';

const attempt = (id: string, net = 10) =>
  ({
    id,
    kind: 'mock',
    mockNo: 1,
    status: 'submitted',
    title: id,
    startedAt: 1,
    submittedAt: 2,
    summary: { overall: { net } },
  }) as unknown as Attempt;

const response = (attemptId: string, qid: string): ResponseRow => ({
  attemptId,
  qid,
  selected: 1,
  marked: false,
  visited: true,
  timeMs: 5,
  visitCount: 1,
});

const visit = (attemptId: string, seq: number): VisitRow => ({
  attemptId,
  seq,
  qid: 'q',
  enteredAt: 1,
  leftAt: 2,
  durationMs: 1,
});

async function seed() {
  await db.attempts.bulkPut([attempt('a1'), attempt('a2')]);
  await db.responses.bulkPut([response('a1', 'q1'), response('a2', 'q1')]);
  await db.visits.bulkPut([visit('a1', 0), visit('a2', 0)]);
  await db.bookmarks.put({ qid: 'q1', createdAt: 1 });
}

beforeEach(async () => {
  await Promise.all([db.attempts.clear(), db.responses.clear(), db.visits.clear(), db.bookmarks.clear()]);
});

describe('attempts backup', () => {
  it('round-trips through JSON into an empty database', async () => {
    await seed();
    const text = JSON.stringify(await exportBackup());
    await Promise.all([db.attempts.clear(), db.responses.clear(), db.visits.clear(), db.bookmarks.clear()]);

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.errors.join());
    expect(await restoreBackup(parsed.backup)).toEqual({ added: 2, skipped: 0, bookmarksAdded: 1 });
    expect(await db.attempts.count()).toBe(2);
    expect(await db.responses.get(['a2', 'q1'])).toMatchObject({ selected: 1, timeMs: 5 });
    expect(await db.visits.count()).toBe(2);
    expect(await db.bookmarks.get('q1')).toBeTruthy();
  });

  it('restoring twice changes nothing', async () => {
    await seed();
    const backup = await exportBackup();
    expect(await restoreBackup(backup)).toEqual({ added: 0, skipped: 2, bookmarksAdded: 0 });
    expect(await db.attempts.count()).toBe(2);
    expect(await db.responses.count()).toBe(2);
  });

  it('keeps a local attempt rather than overwriting it, and its rows too', async () => {
    await seed();
    const backup = await exportBackup();
    backup.attempts[0] = attempt('a1', 99);
    backup.responses[0] = { ...response('a1', 'q1'), selected: 4 };
    await restoreBackup(backup);
    expect((await db.attempts.get('a1'))?.summary?.overall.net).toBe(10);
    expect((await db.responses.get(['a1', 'q1']))?.selected).toBe(1);
  });

  it('adds only what is new from a backup that partly overlaps', async () => {
    await seed();
    const backup = await exportBackup();
    await db.attempts.delete('a2');
    await db.responses.delete(['a2', 'q1']);
    expect(await restoreBackup(backup)).toMatchObject({ added: 1, skipped: 1 });
    expect(await db.responses.get(['a2', 'q1'])).toBeTruthy();
  });

  it('rejects other files and says why', () => {
    const errorsOf = (text: string) => {
      const r = parseBackup(text);
      if (r.ok) throw new Error('expected rejection');
      return r.errors.join(' ');
    };
    expect(errorsOf('{ nope')).toMatch(/Not valid JSON/);
    expect(errorsOf('{"mocks":[]}')).toMatch(/not an attempts backup/);
    expect(errorsOf('{"format":"rrb-po-attempts","attempts":[]}')).toMatch(/missing "responses"/);
    expect(
      errorsOf('{"format":"rrb-po-attempts","attempts":[{"id":1}],"responses":[],"visits":[],"bookmarks":[]}'),
    ).toMatch(/attempts\[0\] is not a valid attempt/);
    expect(
      errorsOf(
        JSON.stringify({ format: 'rrb-po-attempts', attempts: [], responses: [response('x', 'q')], visits: [], bookmarks: [] }),
      ),
    ).toMatch(/not in this file/);
  });
});
