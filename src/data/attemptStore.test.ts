import { beforeEach, describe, expect, it } from 'vitest';
import { attemptsForProgress, createDrillAttempt, createMockAttempt, paperForAttempt } from './attemptStore';
import { db } from './db';
import { addBundle, loadBank } from './mockStore';
import { planDrill } from '../lib/drill';
import { summarize } from '../lib/scoring';
import { topicTimes } from '../lib/progress';
import { loadRealBundle } from '../test/bundle';
import type { Attempt, AttemptSummary } from '../types';

const bundle = loadRealBundle();

beforeEach(async () => {
  await Promise.all([db.mocks.clear(), db.attempts.clear(), db.responses.clear(), db.visits.clear()]);
  await addBundle({ ...bundle, mocks: bundle.mocks.slice(0, 2) });
});

async function attempt(id: string): Promise<Attempt> {
  const found = await db.attempts.get(id);
  if (!found) throw new Error(`No attempt ${id}`);
  return found;
}

/** What a mock's summary held before targets were fitted: the question file's times. */
function summaryWithFileTargets(paper: ReturnType<typeof paperForAttempt>): AttemptSummary {
  const summary = summarize(paper, {});
  return {
    ...summary,
    topics: summary.topics.map((t) => ({
      ...t,
      targetSec: paper.items.filter((i) => i.q.topic === t.topic).reduce((sum, i) => sum + i.q.time, 0),
    })),
  };
}

describe('targets in a drill', () => {
  it('match the same question\'s target in its own mock, across mocks', async () => {
    const bank = await loadBank();
    const quant = bank.mocks.map((m) => m.sections[1].blocks[0]);
    const reasoning = bank.mocks[0].sections[0].blocks[0];
    const id = await createDrillAttempt('Drill', [quant[0], quant[1], reasoning], 600);
    const drill = paperForAttempt(await attempt(id), bank);

    const inMock = new Map<string, number>();
    for (const mockNo of [1, 2]) {
      const mockAttempt = await attempt(await createMockAttempt(mockNo));
      for (const item of paperForAttempt(mockAttempt, bank).items) inMock.set(item.q.id, item.targetSec);
    }
    for (const item of drill.items) expect(item.targetSec, item.q.id).toBe(inMock.get(item.q.id));

    const firstQuant = drill.items.find((i) => i.section === 'Quantitative Aptitude')!;
    expect(firstQuant.targetSec).toBeLessThan(firstQuant.q.time);
  });

  it('set a Quant drill\'s clock, so it runs at exam pace', async () => {
    const bank = await loadBank();
    const blocks = [...bank.blocks.values()].map((b) => b.block);
    const scale = (block: (typeof blocks)[number]) => bank.blocks.get(block.id)?.targetScale ?? 1;
    const plan = planDrill(blocks, new Set(['Arithmetic']), 10, new Map(), Math.random, scale);
    const paper = paperForAttempt(await attempt(await createDrillAttempt('Drill', plan.blocks, plan.durationSec)), bank);

    const targets = paper.items.reduce((sum, i) => sum + i.targetSec, 0);
    const fileTimes = paper.items.reduce((sum, i) => sum + i.q.time, 0);
    expect(paper.durationSec).toBe(Math.ceil(targets));
    expect(paper.durationSec).toBeLessThan(fileTimes);
  });

  it('leave a drill begun on a longer clock with the clock it started on', async () => {
    const bank = await loadBank();
    const block = bank.mocks[0].sections[1].blocks[0];
    const fileTime = block.qs.reduce((sum, q) => sum + q.time, 0);
    const id = await createDrillAttempt('Drill', [block], fileTime);
    expect(paperForAttempt(await attempt(id), bank).durationSec).toBe(fileTime);
  });
});

describe('attemptsForProgress', () => {
  async function finishedMock(mockNo: number) {
    const bank = await loadBank();
    const id = await createMockAttempt(mockNo);
    const a = await attempt(id);
    const summary = summaryWithFileTargets(paperForAttempt(a, bank));
    await db.attempts.update(id, { status: 'submitted', submittedAt: 1, summary });
    return { id, summary };
  }

  const sectionTarget = (a: Attempt, section: string) =>
    a.summary!.topics.filter((t) => t.section === section).reduce((sum, t) => sum + t.targetSec, 0);

  it('brings a summary filed before fitting into line, without changing what is stored', async () => {
    const { id, summary } = await finishedMock(1);
    const [fresh] = await attemptsForProgress();
    expect(sectionTarget(fresh, 'Quantitative Aptitude')).toBeCloseTo(1200, 6);
    expect((await attempt(id)).summary).toEqual(summary);
    expect(fresh.summary!.overall).toEqual(summary.overall);
  });

  it('feeds fitted targets through to the progress chart', async () => {
    const { id, summary } = await finishedMock(1);
    const topic = summary.topics.find((t) => t.section === 'Quantitative Aptitude')!;
    await db.attempts.update(id, {
      summary: { ...summary, topics: summary.topics.map((t) => (t === topic ? { ...t, attempted: 1, timeMs: 1000 } : t)) },
    });
    const [row] = topicTimes(await attemptsForProgress());
    expect(row.topic).toBe(topic.topic);
    expect(row.targetSec).toBeLessThan(topic.targetSec / topic.total);
  });

  it('keeps what was filed once the attempt\'s questions have left the library', async () => {
    const { id, summary } = await finishedMock(1);
    await db.attempts.update(id, { mockNo: 99 });
    const [kept] = await attemptsForProgress();
    expect(kept.summary).toEqual(summary);
  });
});
