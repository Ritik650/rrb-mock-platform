import { db } from './db';
import { parseBundle } from './importer';
import type { Block, Bundle, Mock, Question } from '../types';
import bundleUrl from '../../data/rrb_po_prelims_20_mocks.json?url';

export interface ImportReport {
  added: number[];
  skipped: number[];
  warnings: string[];
}

export interface BankEntry {
  q: Question;
  block: Block;
  mock: Mock;
}

export interface Bank {
  mocks: Mock[];
  blocks: Map<string, { block: Block; mock: Mock }>;
  questions: Map<string, BankEntry>;
}

let bankCache: Promise<Bank> | null = null;

/** Adds mocks whose mock_no is new. Existing mocks stay, so past attempts keep their questions. */
export async function addBundle(bundle: Bundle, warnings: string[] = []): Promise<ImportReport> {
  const report = await db.transaction('rw', db.mocks, async () => {
    const existing = new Set(await db.mocks.toCollection().primaryKeys());
    const fresh = bundle.mocks.filter((m) => !existing.has(m.mock_no));
    await db.mocks.bulkAdd(fresh);
    return {
      added: fresh.map((m) => m.mock_no),
      skipped: bundle.mocks.filter((m) => existing.has(m.mock_no)).map((m) => m.mock_no),
      warnings,
    };
  });
  bankCache = null;
  return report;
}

/** Thrown with every validation message, so the UI can show the user what is wrong. */
export class ImportRejected extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors[0] ?? 'Import rejected');
    this.errors = errors;
  }
}

export async function importBundleText(text: string): Promise<ImportReport> {
  const result = parseBundle(text);
  if (!result.ok) throw new ImportRejected(result.errors);
  return addBundle(result.bundle, result.warnings);
}

let seeding: Promise<void> | null = null;

/** First run: loads the bundled question bank into IndexedDB. Later runs never touch the network. */
export function ensureSeeded(): Promise<void> {
  seeding ??= (async () => {
    if ((await db.mocks.count()) > 0) return;
    const res = await fetch(bundleUrl);
    if (!res.ok) throw new Error(`Could not load the question bank (HTTP ${res.status}).`);
    await importBundleText(await res.text());
  })().catch((e: unknown) => {
    seeding = null;
    throw e;
  });
  return seeding;
}

export function buildBank(mocks: Mock[]): Bank {
  const blocks = new Map<string, { block: Block; mock: Mock }>();
  const questions = new Map<string, BankEntry>();
  for (const mock of mocks) {
    for (const section of mock.sections) {
      for (const block of section.blocks) {
        blocks.set(block.id, { block, mock });
        for (const q of block.qs) questions.set(q.id, { q, block, mock });
      }
    }
  }
  return { mocks, blocks, questions };
}

/** Every question indexed by id. Built once per session and rebuilt after an import. */
export function loadBank(): Promise<Bank> {
  bankCache ??= db.mocks.orderBy('mock_no').toArray().then(buildBank);
  return bankCache;
}
