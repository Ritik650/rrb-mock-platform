import { describe, expect, it } from 'vitest';
import { paperFromBlocks, paperFromMock } from './paper';
import { clockRanges, paperTimeLeftMs, sectionLimitsFor } from './sectionTiming';
import { loadRealBundle, makeQuestion } from '../test/bundle';
import type { Mock } from '../types';

const bundle = loadRealBundle();
const section = (name: string) => ({ name, blocks: [] });
const shape = (names: string[], duration_min: number): Pick<Mock, 'sections' | 'duration_min'> => ({
  sections: names.map(section),
  duration_min,
});

describe('sectionLimitsFor', () => {
  it('gives Reasoning 25 minutes and Quant 20 on every mock in the bank', () => {
    for (const mock of bundle.mocks) expect(sectionLimitsFor(mock), mock.title).toEqual([1500, 1200]);
  });

  it('follows the paper\'s own section order', () => {
    expect(sectionLimitsFor(shape(['Quantitative Aptitude', 'Reasoning Ability'], 45))).toEqual([1200, 1500]);
  });

  it('falls back to one clock for a section it has no limit for', () => {
    expect(sectionLimitsFor(shape(['Reasoning Ability', 'English'], 45))).toBeNull();
    expect(sectionLimitsFor(shape(['constructor'], 25))).toBeNull();
  });

  it('falls back to one clock when the limits do not add up to the paper\'s duration', () => {
    expect(sectionLimitsFor(shape(['Reasoning Ability', 'Quantitative Aptitude'], 60))).toBeNull();
    expect(sectionLimitsFor(shape(['Reasoning Ability'], 45))).toBeNull();
  });
});

describe('clockRanges', () => {
  const paper = paperFromMock(bundle.mocks[0]);

  it('gives each timed section its own run of questions', () => {
    expect(clockRanges(paper, [1500, 1200])).toEqual([
      { start: 0, end: 40 },
      { start: 40, end: 80 },
    ]);
  });

  it('uses one range for the whole paper without limits', () => {
    expect(clockRanges(paper, null)).toEqual([{ start: 0, end: 80 }]);
    expect(clockRanges(paper, undefined)).toEqual([{ start: 0, end: 80 }]);
  });

  it('uses one range when the limits do not match the sections', () => {
    expect(clockRanges(paper, [1500])).toEqual([{ start: 0, end: 80 }]);
  });

  it('keeps a mixed drill on one clock', () => {
    const q = (no: number, sec: string) => makeQuestion(no, { section: sec });
    const block = (no: number, sec: string) => ({ id: `B${no}`, kind: 'single' as const, topic: 't', sub: 's', qs: [q(no, sec)] });
    const drill = paperFromBlocks('D', 60, { correct: 1, wrong: -0.25 }, [block(1, 'A'), block(2, 'B')]);
    expect(drill.sections).toHaveLength(2);
    expect(clockRanges(drill, null)).toEqual([{ start: 0, end: 2 }]);
  });
});

describe('paperTimeLeftMs', () => {
  it('adds later sections\' limits to the running clock', () => {
    expect(paperTimeLeftMs({ remainingMs: 600_000, sectionLimitsSec: [1500, 1200], activeSection: 0 })).toBe(1_800_000);
  });

  it('counts only the running clock in the last section', () => {
    expect(paperTimeLeftMs({ remainingMs: 600_000, sectionLimitsSec: [1500, 1200], activeSection: 1 })).toBe(600_000);
  });

  it('handles an attempt on one clock', () => {
    expect(paperTimeLeftMs({ remainingMs: 42 })).toBe(42);
    expect(paperTimeLeftMs({ remainingMs: 42, sectionLimitsSec: null })).toBe(42);
  });
});
