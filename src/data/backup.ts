import { db } from './db';
import type { Attempt, Bookmark, ResponseRow, VisitRow } from '../types';

const FORMAT = 'rrb-po-attempts';

export interface Backup {
  format: typeof FORMAT;
  version: 1;
  exportedAt: number;
  attempts: Attempt[];
  responses: ResponseRow[];
  visits: VisitRow[];
  bookmarks: Bookmark[];
}

export async function exportBackup(): Promise<Backup> {
  const [attempts, responses, visits, bookmarks] = await Promise.all([
    db.attempts.toArray(),
    db.responses.toArray(),
    db.visits.toArray(),
    db.bookmarks.toArray(),
  ]);
  return { format: FORMAT, version: 1, exportedAt: Date.now(), attempts, responses, visits, bookmarks };
}

export type BackupCheck = { ok: true; backup: Backup } | { ok: false; errors: string[] };

export function parseBackup(text: string): BackupCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const b = raw as Partial<Backup> | null;
  if (typeof b !== 'object' || b === null || b.format !== FORMAT) {
    return { ok: false, errors: ['This is not an attempts backup. Question files go through Import JSON on the Mocks page.'] };
  }
  const errors: string[] = [];
  for (const key of ['attempts', 'responses', 'visits', 'bookmarks'] as const) {
    if (!Array.isArray(b[key])) errors.push(`Backup is missing "${key}".`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const ids = new Set<string>();
  b.attempts!.forEach((a, i) => {
    if (typeof a?.id !== 'string' || !['mock', 'drill'].includes(a.kind) || !['in_progress', 'submitted'].includes(a.status)) {
      errors.push(`attempts[${i}] is not a valid attempt.`);
    } else {
      ids.add(a.id);
    }
  });
  const orphan = (rows: { attemptId: string }[], name: string) => {
    if (rows.some((r) => !ids.has(r?.attemptId))) errors.push(`Some ${name} belong to an attempt that is not in this file.`);
  };
  orphan(b.responses!, 'responses');
  orphan(b.visits!, 'visits');
  return errors.length > 0 ? { ok: false, errors } : { ok: true, backup: b as Backup };
}

export interface RestoreReport {
  added: number;
  skipped: number;
  bookmarksAdded: number;
}

/** Merges a backup. An attempt already here is kept as it is, so restoring twice changes nothing. */
export async function restoreBackup(backup: Backup): Promise<RestoreReport> {
  return db.transaction('rw', [db.attempts, db.responses, db.visits, db.bookmarks], async () => {
    const existing = new Set(await db.attempts.toCollection().primaryKeys());
    const fresh = backup.attempts.filter((a) => !existing.has(a.id));
    const freshIds = new Set(fresh.map((a) => a.id));
    await db.attempts.bulkPut(fresh);
    await db.responses.bulkPut(backup.responses.filter((r) => freshIds.has(r.attemptId)));
    await db.visits.bulkPut(backup.visits.filter((v) => freshIds.has(v.attemptId)));

    const marked = new Set(await db.bookmarks.toCollection().primaryKeys());
    const newMarks = backup.bookmarks.filter((b) => !marked.has(b.qid));
    await db.bookmarks.bulkPut(newMarks);
    return { added: fresh.length, skipped: backup.attempts.length - fresh.length, bookmarksAdded: newMarks.length };
  });
}
