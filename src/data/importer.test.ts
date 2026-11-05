import { describe, expect, it } from 'vitest';
import { parseBundle, validateBundle } from './importer';
import { loadRealBundle, makeQuestion } from '../test/bundle';

function bundleWith(qs: unknown[], mockNo = 1) {
  return {
    exam: 'x',
    n_mocks: 1,
    pattern: {},
    notes: '',
    mocks: [
      {
        mock_no: mockNo,
        title: 'T',
        level: 'Hard',
        duration_min: 45,
        marking: { correct: 1, wrong: -0.25 },
        sections: [
          { name: 'Reasoning Ability', blocks: [{ id: 'B1', kind: 'single', topic: 'X', sub: 'Y', qs }] },
        ],
      },
    ],
  };
}

const errorsOf = (raw: unknown): string[] => {
  const r = validateBundle(raw);
  if (r.ok) throw new Error('expected rejection');
  return r.errors;
};

describe('importer', () => {
  it('accepts the real 20-mock bundle', () => {
    const r = validateBundle(loadRealBundle());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bundle.mocks).toHaveLength(20);
  });

  it('rejects a missing ans and names the question', () => {
    const q: Record<string, unknown> = { ...makeQuestion(7) };
    delete q.ans;
    expect(errorsOf(bundleWith([q])).join('\n')).toMatch(/Mock 1 › Q7 \(T-Q7\): missing "ans"/);
  });

  it('rejects fewer than 5 options and says how many it found', () => {
    const errors = errorsOf(bundleWith([makeQuestion(3, { options: ['a', 'b', 'c', 'd'] })]));
    expect(errors.join('\n')).toMatch(/Q3 \(T-Q3\): has 4 options, needs exactly 5/);
  });

  it('rejects a duplicate no within a mock and names both questions', () => {
    const errors = errorsOf(bundleWith([makeQuestion(5, { id: 'A' }), makeQuestion(5, { id: 'B' })]));
    expect(errors.join('\n')).toMatch(/Mock 1: duplicate question no 5 \(A and B\)/);
  });

  it('rejects an ans that disagrees with the answer letter', () => {
    const errors = errorsOf(bundleWith([makeQuestion(1, { ans: 2, answer: 'A' })]));
    expect(errors.join('\n')).toMatch(/"ans" is 2 but "answer" is "A"/);
  });

  it('rejects an out-of-range ans', () => {
    const errors = errorsOf(bundleWith([makeQuestion(1, { ans: 5, answer: 'F' })]));
    expect(errors.join('\n')).toMatch(/"ans" must be 0-4/);
  });

  it('reports every problem, not only the first', () => {
    const errors = errorsOf(
      bundleWith([makeQuestion(1, { options: ['a'] }), makeQuestion(2, { options: ['a', 'b'] })]),
    );
    expect(errors).toHaveLength(2);
  });

  it('rejects an unknown visual type, which no renderer could draw', () => {
    const raw = bundleWith([makeQuestion(1)]);
    (raw.mocks[0].sections[0].blocks[0] as Record<string, unknown>).visual = { type: 'radar' };
    expect(errorsOf(raw).join('\n')).toMatch(/unknown visual type "radar"/);
  });

  it('rejects a chart series whose length does not match its categories', () => {
    const raw = bundleWith([makeQuestion(1)]);
    (raw.mocks[0].sections[0].blocks[0] as Record<string, unknown>).visual = {
      type: 'bar',
      categories: ['a', 'b'],
      series: [{ name: 's', values: [1] }],
      unit: 'n',
    };
    expect(errorsOf(raw).join('\n')).toMatch(/series without 2 values/);
  });

  it('explains invalid JSON and a file with no mocks', () => {
    const bad = parseBundle('{ nope');
    expect(bad.ok === false && bad.errors[0]).toMatch(/Not valid JSON/);
    const empty = parseBundle('{"mocks":[]}');
    expect(empty.ok === false && empty.errors[0]).toMatch(/no "mocks" array/);
  });

  it('keeps the first copy when a file repeats a mock_no', () => {
    const one = bundleWith([makeQuestion(1)]);
    const r = validateBundle({ ...one, mocks: [one.mocks[0], one.mocks[0]] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bundle.mocks).toHaveLength(1);
      expect(r.warnings[0]).toMatch(/appears more than once/);
    }
  });
});
