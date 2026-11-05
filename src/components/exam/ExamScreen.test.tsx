import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamScreen } from './ExamScreen';
import { routeExamKey, type ExamKeyHandlers } from './useExamKeys';
import { createMockAttempt, loadAttempt } from '../../data/attemptStore';
import { db } from '../../data/db';
import { addBundle } from '../../data/mockStore';
import { loadRealBundle } from '../../test/bundle';
import { DEFAULT_SETTINGS, type Attempt, type Settings } from '../../types';

const bundle = loadRealBundle();
const MIN = 60_000;

async function mount(settings: Partial<Settings> = {}, attemptId?: string) {
  const id = attemptId ?? (await createMockAttempt(1));
  const loaded = await loadAttempt(id);
  const onFinished = vi.fn();
  const view = render(
    <ExamScreen loaded={loaded} settings={{ ...DEFAULT_SETTINGS, ...settings }} onFinished={onFinished} />,
  );
  return { id, onFinished, ...view };
}

/** A paper on one clock: how drills run, and how a mock begun before sections were timed carries on. */
async function singleClockAttempt(remainingMs = 45 * MIN) {
  const id = await createMockAttempt(1);
  await db.attempts.update(id, {
    sectionLimitsSec: undefined,
    activeSection: undefined,
    remainingMs,
    visitStartRemainingMs: remainingMs,
  } as Partial<Attempt>);
  return id;
}

/** A sitting saved partway through the second section, with `remainingMs` on its clock. */
async function inSecondSection(remainingMs: number) {
  const id = await createMockAttempt(1);
  const now = Date.now();
  await db.attempts.update(id, {
    activeQid: 'M01-Q41',
    activeSection: 1,
    remainingMs,
    visitStartRemainingMs: remainingMs,
    visitEnteredAt: now,
    checkpointAt: now,
  });
  return id;
}

/** A new sitting with only `remainingMs` left on the first section's clock. */
async function withFirstClockAt(remainingMs: number) {
  const id = await createMockAttempt(1);
  await db.attempts.update(id, { remainingMs, visitStartRemainingMs: remainingMs });
  return id;
}

const paletteButton = (no: number) => screen.getByRole('button', { name: new RegExp(`^Question ${no},`) });
const legendCount = (state: string) => document.querySelector(`[data-legend="${state}"]`)?.textContent;
const saved = (id: string, qid: string) => db.responses.get([id, qid]);
const tab = (name: RegExp) => screen.getByRole('tab', { name }) as HTMLButtonElement;
const REASONING = /Reasoning Ability/;
const QUANT = /Quantitative Aptitude/;

/** IndexedDB's own scheduling stays real. Only the app's clock and tick are faked. */
const fakeClock = () => vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });

/**
 * Waits for queued IndexedDB writes without moving the clock, which vi.waitFor would do while
 * polling. Each faked second queues a checkpoint, so the number of writes varies by test.
 */
async function until(condition: () => Promise<boolean>) {
  for (let i = 0; i < 20_000; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Condition was not met');
}
const remainingIs = (id: string, ms: number) => async () => (await db.attempts.get(id))?.remainingMs === ms;

function stubAudio() {
  const oscillators: unknown[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
    createGain: () => ({
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect: (x: unknown) => x,
    }),
    createOscillator: () => {
      const o = { frequency: {}, connect: (x: unknown) => x, start() {}, stop() {} };
      oscillators.push(o);
      return o;
    },
  };
  vi.stubGlobal('AudioContext', function AudioContext() {
    return ctx;
  });
  return oscillators;
}

beforeEach(async () => {
  await Promise.all([db.mocks.clear(), db.attempts.clear(), db.responses.clear(), db.visits.clear()]);
  await addBundle({ ...bundle, mocks: bundle.mocks.slice(0, 1) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('exam screen', () => {
  it('shows the paper title, both sections, candidate and the first section\'s clock', async () => {
    await mount();
    expect(screen.getByRole('heading', { name: 'RRB PO Prelims Predicted Mock 01' })).toBeTruthy();
    expect(tab(REASONING).getAttribute('aria-selected')).toBe('true');
    expect(tab(REASONING).textContent).toContain('25 min');
    expect(tab(QUANT).getAttribute('aria-selected')).toBe('false');
    expect(tab(QUANT).textContent).toContain('20 min');
    expect(screen.getByText('Ritik')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toContain('25:00');
    expect(screen.getByRole('timer').textContent).toContain('Section time left');
  });

  it('applies the official states through the real buttons, with live legend counts', async () => {
    await mount();
    expect(paletteButton(1).dataset.state).toBe('not_answered');
    expect(paletteButton(2).dataset.state).toBe('not_visited');

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    expect(paletteButton(1).dataset.state).toBe('answered');
    expect(screen.getByRole('heading', { name: 'Question No. 2' })).toBeTruthy();
    expect(paletteButton(2).dataset.state).toBe('not_answered');

    fireEvent.click(screen.getByRole('button', { name: /^Mark for Review & Next/ }));
    expect(paletteButton(2).dataset.state).toBe('marked');

    fireEvent.click(paletteButton(1));
    fireEvent.click(screen.getByRole('button', { name: /^Mark for Review & Next/ }));
    expect(paletteButton(1).dataset.state).toBe('answered_marked');

    expect(legendCount('answered_marked')).toContain('1');
    expect(legendCount('marked')).toContain('1');
    expect(legendCount('not_visited')).toContain('37');

    fireEvent.click(paletteButton(1));
    fireEvent.click(screen.getByRole('button', { name: /^Clear Response/ }));
    expect(paletteButton(1).dataset.state).toBe('marked');
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(false);
  });

  it('drives the same actions from the keyboard', async () => {
    await mount();
    fireEvent.keyDown(window, { key: '3' });
    expect((screen.getAllByRole('radio')[2] as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(window, { key: 'b' });
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(window, { key: 'n' });
    expect(paletteButton(1).dataset.state).toBe('answered');
    fireEvent.keyDown(window, { key: 'm' });
    expect(paletteButton(2).dataset.state).toBe('marked');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Question No. 2' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Question No. 3' })).toBeTruthy();
  });

  it('clears a saved answer with C', async () => {
    await mount();
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.click(paletteButton(1));
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(window, { key: 'c' });
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(false);
    expect(paletteButton(1).dataset.state).toBe('not_answered');
  });

  it('warns about an unsaved selection and drops it when leaving', async () => {
    await mount();
    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByRole('status').textContent).toMatch(/Not saved yet/);
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(paletteButton(1).dataset.state).toBe('not_answered');
  });

  it('keeps the set panel pinned across a set and drops it for single questions', async () => {
    await mount();
    const panel = screen.getByTestId('set-panel');
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByTestId('set-panel')).toBe(panel);
    const firstSingle = bundle.mocks[0].sections[0].blocks.find((b) => b.kind === 'single');
    fireEvent.click(paletteButton(firstSingle!.qs[0].no));
    expect(screen.queryByTestId('set-panel')).toBeNull();
  });

  it('warns on the summary when the current selection is unsaved', async () => {
    await mount({}, await singleClockAttempt());
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('alert').textContent).toMatch(/question 1 is not saved/);
  });
});

describe('clicking the chosen option again', () => {
  const radio = (i: number) => screen.getAllByRole('radio')[i] as HTMLInputElement;

  it('deselects it, leaving nothing to save', async () => {
    await mount();
    fireEvent.click(radio(1));
    expect(radio(1).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Not saved yet/);

    fireEvent.click(radio(1));
    expect(radio(1).checked).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    expect(paletteButton(1).dataset.state).toBe('not_answered');
  });

  it('works by clicking the option\'s row as well as its button', async () => {
    await mount();
    const row = radio(2).closest('label')!;
    fireEvent.click(row);
    expect(radio(2).checked).toBe(true);
    fireEvent.click(row);
    expect(radio(2).checked).toBe(false);
  });

  it('removes a saved answer, the same as Clear Response', async () => {
    const { id } = await mount();
    fireEvent.click(radio(1));
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    fireEvent.click(paletteButton(1));
    expect(radio(1).checked).toBe(true);

    fireEvent.click(radio(1));
    expect(radio(1).checked).toBe(false);
    expect(paletteButton(1).dataset.state).toBe('not_answered');
    await until(async () => (await saved(id, 'M01-Q01'))?.selected === null);
  });

  it('leaves switching to a different option alone', async () => {
    await mount();
    fireEvent.click(radio(1));
    fireEvent.click(radio(3));
    expect(radio(1).checked).toBe(false);
    expect(radio(3).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    expect(paletteButton(1).dataset.state).toBe('answered');
  });

  it('keeps a saved answer when a different option is clicked but never saved', async () => {
    const { id } = await mount();
    fireEvent.click(radio(1));
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    fireEvent.click(paletteButton(1));

    fireEvent.click(radio(3));
    fireEvent.click(paletteButton(2));
    expect(paletteButton(1).dataset.state).toBe('answered');
    fireEvent.click(paletteButton(1));
    expect(radio(1).checked).toBe(true);
    await until(async () => (await saved(id, 'M01-Q01'))?.selected === 1);
  });

  it('does not apply to the number keys, so a repeated press cannot lose an answer', async () => {
    await mount();
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '2' });
    expect(radio(1).checked).toBe(true);
  });
});

describe('section clocks', () => {
  it('shows only the running section and locks the other', async () => {
    await mount();
    expect(screen.getAllByRole('button', { name: /^Question \d+,/ })).toHaveLength(40);
    expect(screen.queryByRole('button', { name: /^Question 41,/ })).toBeNull();
    expect(tab(QUANT).disabled).toBe(true);
    fireEvent.click(tab(QUANT));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
    expect(screen.getByText('Section 1 of 2')).toBeTruthy();
  });

  it('keeps every way of moving inside the section', async () => {
    await mount();
    expect((screen.getByRole('button', { name: /^Previous/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();

    fireEvent.click(paletteButton(40));
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();

    fireEvent.click(paletteButton(40));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();

    fireEvent.click(paletteButton(40));
    fireEvent.click(screen.getByRole('button', { name: /^Mark for Review & Next/ }));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
  });

  it('moves on by itself at 0:00, on a fresh clock, with no way back', async () => {
    fakeClock();
    const id = await withFirstClockAt(3000);
    const { onFinished } = await mount({}, id);
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'n' });

    act(() => void vi.advanceTimersByTime(3000));

    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toContain('20:00');
    expect(screen.getByRole('timer').dataset.phase).toBe('normal');
    expect(screen.getByRole('status').textContent).toMatch(/Time is up for Reasoning Ability/);
    expect(onFinished).not.toHaveBeenCalled();

    expect(tab(QUANT).getAttribute('aria-selected')).toBe('true');
    expect(tab(REASONING).disabled).toBe(true);
    expect(screen.getByText('Section 2 of 2')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Question \d+,/ })).toHaveLength(40);
    expect(screen.queryByRole('button', { name: /^Question 1,/ })).toBeNull();
    expect((screen.getByRole('button', { name: /^Previous/ }) as HTMLButtonElement).disabled).toBe(true);

    await until(async () => (await db.attempts.get(id))?.activeSection === 1);
    expect((await db.attempts.get(id))?.status).toBe('in_progress');
    expect((await saved(id, 'M01-Q01'))?.selected).toBe(1);
  });

  it('clears the time-up notice on the next action', async () => {
    fakeClock();
    await mount({}, await withFirstClockAt(1000));
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status').textContent).toMatch(/Time is up/);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('discards an unsaved selection when the section\'s time runs out', async () => {
    fakeClock();
    const id = await withFirstClockAt(2000);
    await mount({}, id);
    fireEvent.keyDown(window, { key: '2' });
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    await until(async () => (await db.attempts.get(id))?.activeSection === 1);
    expect((await saved(id, 'M01-Q01'))?.selected).toBeNull();
  });

  it('offers no way out of a section before its time ends', async () => {
    fakeClock();
    await mount();
    act(() => void vi.advanceTimersByTime(MIN));
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull();
    expect(screen.getByText('Quantitative Aptitude opens when time runs out.')).toBeTruthy();

    for (const key of ['s', 'Enter', 'Escape']) fireEvent.keyDown(window, { key });
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toContain('24:00');
  });

  it('offers no Submit in the last section either', async () => {
    fakeClock();
    const { onFinished } = await mount({}, await withFirstClockAt(1000));
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull();
    expect(screen.getByText('The test ends when time runs out.')).toBeTruthy();
    expect(screen.queryByText(/opens when time runs out/)).toBeNull();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('auto-submits when the last section\'s clock reaches 0:00', async () => {
    fakeClock();
    const id = await inSecondSection(2000);
    const { onFinished } = await mount({}, id);
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2000));
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledWith(id));
    const attempt = await db.attempts.get(id);
    expect(attempt?.status).toBe('submitted');
    expect(attempt?.submitReason).toBe('timeout');
    expect(attempt?.remainingMs).toBe(0);
  });

  it('times questions across the handover, with no time lost or doubled', async () => {
    fakeClock();
    const id = await withFirstClockAt(10_000);
    await db.attempts.update(id, { sectionLimitsSec: [1500, 7] });
    const { onFinished } = await mount({}, id);
    act(() => void vi.advanceTimersByTime(4000));
    fireEvent.click(paletteButton(2));
    act(() => void vi.advanceTimersByTime(6000)); // section ends on Q2
    act(() => void vi.advanceTimersByTime(7000)); // the paper ends on Q41
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalled());

    expect((await saved(id, 'M01-Q01'))?.timeMs).toBe(4000);
    expect((await saved(id, 'M01-Q02'))?.timeMs).toBe(6000);
    expect((await saved(id, 'M01-Q41'))?.timeMs).toBe(7000);
    const attempt = await db.attempts.get(id);
    expect(attempt?.summary?.sections.map((s) => s.tally.timeMs)).toEqual([10_000, 7000]);
    const visits = await db.visits.where('attemptId').equals(id).sortBy('seq');
    expect(visits.map((v) => [v.qid, v.durationMs])).toEqual([
      ['M01-Q01', 4000],
      ['M01-Q02', 6000],
      ['M01-Q41', 7000],
    ]);
  });

  it('warns and beeps on each section\'s clock', async () => {
    fakeClock();
    const oscillators = stubAudio();
    const { unmount } = await mount({}, await withFirstClockAt(61_000));
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByRole('timer').dataset.phase).toBe('critical');
    expect(oscillators).toHaveLength(1);
    unmount();

    await mount({}, await inSecondSection(5 * MIN + 1000));
    expect(screen.getByRole('timer').dataset.phase).toBe('normal');
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer').dataset.phase).toBe('warning');
    act(() => void vi.advanceTimersByTime(4 * MIN));
    expect(screen.getByRole('timer').dataset.phase).toBe('critical');
    expect(oscillators).toHaveLength(2);
  });

  it('does not beep on arriving in the next section', async () => {
    fakeClock();
    const oscillators = stubAudio();
    await mount({}, await withFirstClockAt(1000));
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(oscillators).toHaveLength(0);
  });
});

describe('a paper on one clock', () => {
  it('still allows free switching between sections', async () => {
    await mount({}, await singleClockAttempt());
    expect(screen.getByRole('timer').textContent).toContain('45:00');
    expect(screen.getByRole('timer').textContent).toContain('Time left');
    expect(screen.queryByText('Section 1 of 2')).toBeNull();
    expect(tab(QUANT).disabled).toBe(false);
    fireEvent.click(tab(QUANT));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(paletteButton(80)).toBeTruthy();
    fireEvent.click(tab(REASONING));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
  });

  it('moves from the last Reasoning question straight into Quant', async () => {
    await mount({}, await singleClockAttempt());
    fireEvent.click(paletteButton(40));
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
  });

  it('can be submitted early, with both sections on the summary, and only on confirm', async () => {
    const { onFinished, id } = await mount({}, await singleClockAttempt());
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const dialog = screen.getByRole('dialog', { name: 'Submit this test?' });
    expect(dialog.textContent).toContain('Reasoning Ability');
    expect(dialog.textContent).toContain('Quantitative Aptitude');
    expect(dialog.textContent).toContain('Total');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to the test' }));
    expect(onFinished).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(id));
    const attempt = await db.attempts.get(id);
    expect(attempt?.status).toBe('submitted');
    expect(attempt?.submitReason).toBe('manual');
    expect(attempt?.summary?.overall.attempted).toBe(1);
    expect(await db.responses.where('attemptId').equals(id).count()).toBe(80);
  });

  it('turns orange at 5:00, red at 1:00 and beeps once, then auto-submits at 0:00', async () => {
    fakeClock();
    const oscillators = stubAudio();
    const id = await singleClockAttempt(5 * MIN + 2000);
    const { onFinished } = await mount({}, id);
    const timer = () => screen.getByRole('timer');
    expect(timer().dataset.phase).toBe('normal');

    act(() => void vi.advanceTimersByTime(2000));
    expect(timer().dataset.phase).toBe('warning');
    expect(timer().textContent).toContain('05:00');

    act(() => void vi.advanceTimersByTime(4 * MIN));
    expect(timer().dataset.phase).toBe('critical');
    expect(timer().textContent).toContain('01:00');
    expect(oscillators).toHaveLength(1);

    act(() => void vi.advanceTimersByTime(30_000));
    expect(oscillators).toHaveLength(1);

    act(() => void vi.advanceTimersByTime(30_000));
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledWith(id));
    const attempt = await db.attempts.get(id);
    expect(attempt?.status).toBe('submitted');
    expect(attempt?.submitReason).toBe('timeout');
    expect(attempt?.remainingMs).toBe(0);
  });
});

describe('timer settings', () => {
  it('stays silent at 1:00 when the beep is switched off', async () => {
    fakeClock();
    const AudioStub = vi.fn();
    vi.stubGlobal('AudioContext', AudioStub);
    await mount({ beepEnabled: false }, await withFirstClockAt(61_000));
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByRole('timer').dataset.phase).toBe('critical');
    expect(AudioStub).not.toHaveBeenCalled();
  });

  it('shows no Pause button by default, and a working one when allowed', async () => {
    fakeClock();
    const first = await mount();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    first.unmount();

    await mount({ allowPause: true });
    act(() => void vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const frozen = screen.getByRole('timer').textContent;
    expect(screen.queryByRole('radio')).toBeNull(); // the paper is hidden while paused
    act(() => void vi.advanceTimersByTime(MIN));
    expect(screen.getByRole('timer').textContent).toBe(frozen);
    fireEvent.click(screen.getByRole('button', { name: 'Resume the test' }));
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer').textContent).not.toBe(frozen);
  });
});

describe('resume after reload', () => {
  it('restores the remaining time, answers, palette and active question', async () => {
    fakeClock();
    const { id, unmount } = await mount();
    act(() => void vi.advanceTimersByTime(30_000));
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Mark for Review & Next/ }));
    act(() => void vi.advanceTimersByTime(10_000));
    unmount();
    const atClose = 25 * MIN - 40_000;
    await until(remainingIs(id, atClose));
    expect((await saved(id, 'M01-Q02'))?.marked).toBe(true);

    // The tab stays closed for ten minutes. That time must not come off the clock.
    vi.advanceTimersByTime(10 * MIN);
    expect((await db.attempts.get(id))?.remainingMs).toBe(atClose);
    await mount({}, id);

    expect(screen.getByRole('timer').textContent).toContain('24:20');
    expect(screen.getByRole('heading', { name: 'Question No. 3' })).toBeTruthy();
    expect(paletteButton(1).dataset.state).toBe('answered');
    expect(paletteButton(2).dataset.state).toBe('marked');
    fireEvent.click(paletteButton(1));
    expect((screen.getAllByRole('radio')[2] as HTMLInputElement).checked).toBe(true);
  });

  it('comes back to the second section, still locked, with the first section\'s answers kept', async () => {
    fakeClock();
    const { id, unmount } = await mount({}, await withFirstClockAt(1000));
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'n' });
    act(() => void vi.advanceTimersByTime(1000));
    act(() => void vi.advanceTimersByTime(3 * MIN));
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: 'n' });
    unmount();
    await until(async () => {
      const a = await db.attempts.get(id);
      return a?.activeQid === 'M01-Q42' && a.remainingMs === 17 * MIN;
    });

    const { onFinished } = await mount({}, id);
    expect(screen.getByRole('timer').textContent).toContain('17:00');
    expect(screen.getByRole('heading', { name: 'Question No. 42' })).toBeTruthy();
    expect(paletteButton(41).dataset.state).toBe('answered');
    expect(tab(REASONING).disabled).toBe(true);
    expect(tab(QUANT).getAttribute('aria-selected')).toBe('true');

    act(() => void vi.advanceTimersByTime(17 * MIN));
    await until(async () => onFinished.mock.calls.length > 0);
    expect((await db.attempts.get(id))?.summary?.overall.attempted).toBe(2);
  });

  it('moves on straight away if a section\'s clock had already run out', async () => {
    fakeClock();
    const id = await createMockAttempt(1);
    const now = Date.now();
    await db.attempts.update(id, {
      activeQid: 'M01-Q05',
      activeSection: 0,
      remainingMs: 0,
      visitStartRemainingMs: 3000,
      visitEnteredAt: now,
      checkpointAt: now,
    });
    await mount({}, id);
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toContain('20:00');
  });

  it('lets a mock begun before sections were timed finish on its one clock', async () => {
    fakeClock();
    const id = await singleClockAttempt(30 * MIN);
    const now = Date.now();
    await db.attempts.update(id, {
      activeQid: 'M01-Q60',
      visitEnteredAt: now,
      checkpointAt: now,
    });
    await mount({}, id);
    expect(screen.getByRole('timer').textContent).toContain('30:00');
    expect(screen.getByRole('heading', { name: 'Question No. 60' })).toBeTruthy();
    expect(tab(REASONING).disabled).toBe(false);
    fireEvent.click(tab(REASONING));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
  });

  it('logs time across revisits and across the reload', async () => {
    fakeClock();
    const id = await withFirstClockAt(35_000);
    await db.attempts.update(id, { sectionLimitsSec: [1500, 1] });
    const { unmount } = await mount({}, id);
    act(() => void vi.advanceTimersByTime(20_000));
    fireEvent.click(paletteButton(2));
    act(() => void vi.advanceTimersByTime(5_000));
    fireEvent.click(paletteButton(1));
    act(() => void vi.advanceTimersByTime(7_000));
    unmount();
    await until(remainingIs(id, 3_000));
    const { onFinished } = await mount({}, id);
    act(() => void vi.advanceTimersByTime(3_000)); // the section's clock ends on Q1
    act(() => void vi.advanceTimersByTime(1_000)); // the paper ends on Q41
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalled());

    expect((await saved(id, 'M01-Q01'))?.timeMs).toBe(30_000);
    expect((await saved(id, 'M01-Q02'))?.timeMs).toBe(5_000);
    const visits = await db.visits.where('attemptId').equals(id).sortBy('seq');
    expect(visits.map((v) => [v.qid, v.durationMs])).toEqual([
      ['M01-Q01', 20_000],
      ['M01-Q02', 5_000],
      ['M01-Q01', 7_000],
      ['M01-Q01', 3_000],
      ['M01-Q41', 1_000],
    ]);
    for (const v of visits) expect(v.leftAt).toBeGreaterThanOrEqual(v.enteredAt);
  });
});

describe('key routing', () => {
  const handlers = (): ExamKeyHandlers => ({
    select: vi.fn(),
    saveNext: vi.fn(),
    markNext: vi.fn(),
    clear: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
  });
  const press = (key: string) => {
    const h = handlers();
    return { handled: routeExamKey({ key }, h), h };
  };

  it('maps 1-5 and A, B, D, E to options, upper or lower case', () => {
    expect(press('1').h.select).toHaveBeenCalledWith(0);
    expect(press('3').h.select).toHaveBeenCalledWith(2);
    expect(press('5').h.select).toHaveBeenCalledWith(4);
    expect(press('a').h.select).toHaveBeenCalledWith(0);
    expect(press('B').h.select).toHaveBeenCalledWith(1);
    expect(press('d').h.select).toHaveBeenCalledWith(3);
    expect(press('E').h.select).toHaveBeenCalledWith(4);
  });

  it('makes C Clear Response, in either case, and never an option', () => {
    for (const key of ['c', 'C']) {
      const { h } = press(key);
      expect(h.clear).toHaveBeenCalled();
      expect(h.select).not.toHaveBeenCalled();
    }
  });

  it('ignores keys it does not own, leaving browser shortcuts alone', () => {
    for (const key of ['6', 'f', 'Tab', 'Enter', 'F5', 'Escape', 'constructor']) expect(press(key).handled).toBe(false);
  });
});
