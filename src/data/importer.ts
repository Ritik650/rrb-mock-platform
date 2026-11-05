import type { Bundle, Mock } from '../types';

export type ImportResult =
  | { ok: true; bundle: Bundle; warnings: string[] }
  | { ok: false; errors: string[] };

const LETTERS = 'ABCDE';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/** Array fields each renderer dereferences. A bad visual would otherwise crash the page mid-test. */
const VISUAL_ARRAYS: Record<string, string[]> = {
  table: ['headers', 'rows'],
  pie: ['labels', 'values'],
  bar: ['categories', 'series'],
  line: ['categories', 'series'],
  linear: ['seats'],
  circle: ['seats'],
  stack: ['levels'],
  schedule: ['rows'],
  floorflat: ['floors'],
  parallel: ['row1', 'row2'],
  tree: ['gens'],
  coords: [],
};

function visualProblem(v: unknown): string | null {
  if (!isRec(v)) return 'visual is not an object';
  const type = String(v.type);
  if (!Object.hasOwn(VISUAL_ARRAYS, type)) return `unknown visual type "${type}"`;
  for (const key of VISUAL_ARRAYS[type]) {
    if (!Array.isArray(v[key])) return `${type} visual is missing "${key}"`;
  }
  if (type === 'coords' && !isRec(v.points)) return 'coords visual is missing "points"';
  if (type === 'pie' && (v.labels as unknown[]).length !== (v.values as unknown[]).length) {
    return 'pie visual has different numbers of labels and values';
  }
  if (type === 'bar' || type === 'line') {
    const n = (v.categories as unknown[]).length;
    for (const s of v.series as unknown[]) {
      if (!isRec(s) || !Array.isArray(s.values) || s.values.length !== n) {
        return `${type} visual has a series without ${n} values`;
      }
    }
  }
  return null;
}

function checkQuestion(q: unknown, where: string, errors: string[]): void {
  if (!isRec(q)) {
    errors.push(`${where}: question is not an object`);
    return;
  }
  const label = `${where} › Q${String(q.no ?? '?')}${isStr(q.id) ? ` (${q.id})` : ''}`;
  if (!isStr(q.id)) errors.push(`${label}: missing "id"`);
  if (!isPosInt(q.no)) errors.push(`${label}: missing or invalid "no"`);
  if (!isStr(q.stem)) errors.push(`${label}: missing "stem"`);
  if (!isStr(q.section)) errors.push(`${label}: missing "section"`);
  if (!isStr(q.topic)) errors.push(`${label}: missing "topic"`);
  if (typeof q.sub !== 'string') errors.push(`${label}: missing "sub"`);
  if (typeof q.time !== 'number' || q.time <= 0) {
    errors.push(`${label}: "time" must be a positive number of seconds`);
  }
  if (!Array.isArray(q.sol)) errors.push(`${label}: missing "sol"`);

  if (!Array.isArray(q.options)) {
    errors.push(`${label}: missing "options"`);
  } else if (q.options.length !== 5) {
    errors.push(`${label}: has ${q.options.length} options, needs exactly 5`);
  }

  if (q.ans === undefined || q.ans === null) {
    errors.push(`${label}: missing "ans"`);
  } else if (!Number.isInteger(q.ans) || (q.ans as number) < 0 || (q.ans as number) > 4) {
    errors.push(`${label}: "ans" must be 0-4, got ${JSON.stringify(q.ans)}`);
  } else if (q.answer !== LETTERS[q.ans as number]) {
    errors.push(`${label}: "ans" is ${String(q.ans)} but "answer" is ${JSON.stringify(q.answer)}`);
  }
}

function checkBlockHeader(b: Rec, where: string, errors: string[]): void {
  if (!isStr(b.id)) errors.push(`${where}: missing "id"`);
  if (b.kind !== 'set' && b.kind !== 'single') errors.push(`${where}: "kind" must be "set" or "single"`);
  if (!isStr(b.topic)) errors.push(`${where}: missing "topic"`);
  if (b.visual != null) {
    const problem = visualProblem(b.visual);
    if (problem) errors.push(`${where}: ${problem}`);
  }
}

function checkMock(m: unknown, index: number, errors: string[]): void {
  if (!isRec(m)) {
    errors.push(`mocks[${index}]: not an object`);
    return;
  }
  if (!isPosInt(m.mock_no)) {
    errors.push(`mocks[${index}]: missing or invalid "mock_no"`);
    return;
  }
  const where = `Mock ${m.mock_no}`;
  if (!isStr(m.title)) errors.push(`${where}: missing "title"`);
  if (m.level !== 'Exam level' && m.level !== 'Hard') {
    errors.push(`${where}: "level" must be "Exam level" or "Hard"`);
  }
  if (typeof m.duration_min !== 'number' || m.duration_min <= 0) {
    errors.push(`${where}: invalid "duration_min"`);
  }
  if (!isRec(m.marking) || typeof m.marking.correct !== 'number' || typeof m.marking.wrong !== 'number') {
    errors.push(`${where}: invalid "marking"`);
  }
  if (!Array.isArray(m.sections) || m.sections.length === 0) {
    errors.push(`${where}: missing "sections"`);
    return;
  }

  const seenNo = new Map<number, string>();
  const seenId = new Set<string>();
  m.sections.forEach((s: unknown, si: number) => {
    if (!isRec(s) || !isStr(s.name) || !Array.isArray(s.blocks)) {
      errors.push(`${where} › section ${si + 1}: needs a "name" and "blocks"`);
      return;
    }
    s.blocks.forEach((b: unknown, bi: number) => {
      const bWhere = `${where} › ${s.name} block ${bi + 1}`;
      if (!isRec(b)) {
        errors.push(`${bWhere}: not an object`);
        return;
      }
      checkBlockHeader(b, bWhere, errors);
      if (!Array.isArray(b.qs) || b.qs.length === 0) {
        errors.push(`${bWhere}: missing "qs"`);
        return;
      }
      for (const q of b.qs as unknown[]) {
        checkQuestion(q, where, errors);
        if (!isRec(q)) continue;
        if (isPosInt(q.no)) {
          const prior = seenNo.get(q.no);
          if (prior !== undefined) {
            errors.push(`${where}: duplicate question no ${q.no} (${prior} and ${String(q.id)})`);
          } else {
            seenNo.set(q.no, String(q.id));
          }
        }
        if (isStr(q.id)) {
          if (seenId.has(q.id)) errors.push(`${where}: duplicate question id ${q.id}`);
          seenId.add(q.id);
        }
      }
    });
  });
}

/** Validates an already-parsed bundle. Collects every problem rather than stopping at the first. */
export function validateBundle(raw: unknown): ImportResult {
  if (!isRec(raw)) return { ok: false, errors: ['File is not a JSON object.'] };
  if (!Array.isArray(raw.mocks) || raw.mocks.length === 0) {
    return { ok: false, errors: ['File has no "mocks" array.'] };
  }
  const errors: string[] = [];
  raw.mocks.forEach((m, i) => checkMock(m, i, errors));
  if (errors.length > 0) return { ok: false, errors };

  const seen = new Set<number>();
  const warnings: string[] = [];
  const mocks = (raw.mocks as Mock[]).filter((m) => {
    if (seen.has(m.mock_no)) {
      warnings.push(`Mock ${m.mock_no} appears more than once in this file; kept the first copy.`);
      return false;
    }
    seen.add(m.mock_no);
    return true;
  });
  return { ok: true, bundle: { ...(raw as unknown as Bundle), mocks }, warnings };
}

export function parseBundle(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  return validateBundle(raw);
}
