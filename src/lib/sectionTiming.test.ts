import { describe, expect, it } from 'vitest';
import { paperFromBlocks, paperFromMock, type Paper } from './paper';
import { clockRanges, paperTimeLeftMs, sectionLimitsFor, targetScaleFor } from './sectionTiming';
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

describe('fitting targets to the section clocks', () => {
  const targetTotal = (paper: Paper, name: string) =>
    paper.sections.find((s) => s.name === name)!.items.reduce((sum, i) => sum + i.targetSec, 0);
  const fileTotal = (paper: Paper, name: string) =>
    paper.sections.find((s) => s.name === name)!.items.reduce((sum, i) => sum + i.q.time, 0);
  const oneQuestionSection = (name: string, time: number) => ({
    name,
    blocks: [{ id: `B-${name}`, kind: 'single' as const, topic: 't', sub: 's', qs: [makeQuestion(1, { section: name, time })] }],
  });

  it('makes every mock\'s Quant targets total its 20 minute clock', () => {
    for (const mock of bundle.mocks) {
      const paper = paperFromMock(mock);
      expect(fileTotal(paper, 'Quantitative Aptitude'), mock.title).toBeGreaterThan(1200);
      expect(targetTotal(paper, 'Quantitative Aptitude'), mock.title).toBeCloseTo(1200, 6);
    }
  });

  it('leaves Reasoning as written wherever it already fits', () => {
    for (const mock of bundle.mocks) {
      const paper = paperFromMock(mock);
      const total = fileTotal(paper, 'Reasoning Ability');
      if (total <= 1500) expect(targetTotal(paper, 'Reasoning Ability'), mock.title).toBe(total);
      else expect(targetTotal(paper, 'Reasoning Ability'), mock.title).toBeCloseTo(1500, 6);
    }
  });

  it('keeps the proportions between questions and leaves the question file alone', () => {
    const paper = paperFromMock(bundle.mocks[0]);
    const items = paper.sections[1].items;
    const scale = items[0].targetSec / items[0].q.time;
    expect(scale).toBeCloseTo(1200 / fileTotal(paper, 'Quantitative Aptitude'), 9);
    for (const item of items) expect(item.targetSec).toBeCloseTo(item.q.time * scale, 9);
    expect(items[0].q.time).toBe(bundle.mocks[0].sections[1].blocks[0].qs[0].time);
  });

  it('never stretches a section that comes in under its clock', () => {
    const scale = targetScaleFor({
      duration_min: 45,
      sections: [oneQuestionSection('Reasoning Ability', 60), oneQuestionSection('Quantitative Aptitude', 60)],
    });
    expect(scale('Reasoning Ability')).toBe(1);
    expect(scale('Quantitative Aptitude')).toBe(1);
  });

  it('shortens an imported paper on the same rule', () => {
    const scale = targetScaleFor({
      duration_min: 45,
      sections: [oneQuestionSection('Reasoning Ability', 3000), oneQuestionSection('Quantitative Aptitude', 60)],
    });
    expect(scale('Reasoning Ability')).toBe(0.5);
    expect(scale('Quantitative Aptitude')).toBe(1);
  });

  it('has no limit to fit on a paper with no section clocks', () => {
    const scale = targetScaleFor({ duration_min: 30, sections: [oneQuestionSection('English', 9000)] });
    expect(scale('English')).toBe(1);
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
