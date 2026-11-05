import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamScreen } from './ExamScreen';
import { routeExamKey, type ExamKeyHandlers } from './useExamKeys';
import { createMockAttempt, loadAttempt } from '../../data/attemptStore';
import { db } from '../../data/db';
import { addBundle } from '../../data/mockStore';
import { loadRealBundle } from '../../test/bundle';
import { DEFAULT_SETTINGS, type Settings } from '../../types';

const bundle = loadRealBundle();

async function mount(settings: Partial<Settings> = {}, attemptId?: string) {
  const id = attemptId ?? (await createMockAttempt(1));
  const loaded = await loadAttempt(id);
  const onFinished = vi.fn();
  const view = render(
    <ExamScreen loaded={loaded} settings={{ ...DEFAULT_SETTINGS, ...settings }} onFinished={onFinished} />,
  );
  return { id, onFinished, ...view };
}

const paletteButton = (no: number) => screen.getByRole('button', { name: new RegExp(`^Question ${no},`) });
const legendCount = (state: string) => document.querySelector(`[data-legend="${state}"]`)?.textContent;
const saved = (id: string, qid: string) => db.responses.get([id, qid]);

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

beforeEach(async () => {
  await Promise.all([db.mocks.clear(), db.attempts.clear(), db.responses.clear(), db.visits.clear()]);
  await addBundle({ ...bundle, mocks: bundle.mocks.slice(0, 1) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('exam screen', () => {
  it('shows the paper title, both section tabs, candidate and a 45:00 clock', async () => {
    await mount();
    expect(screen.getByRole('heading', { name: 'RRB PO Prelims Predicted Mock 01' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Reasoning Ability', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Quantitative Aptitude', selected: false })).toBeTruthy();
    expect(screen.getByText('Ritik')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toContain('45:00');
  });

  it('filters the palette to the active section and switches freely', async () => {
    await mount();
    expect(screen.getAllByRole('button', { name: /^Question \d+,/ })).toHaveLength(40);
    expect(screen.queryByRole('button', { name: /^Question 41,/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Quantitative Aptitude' }));
    expect(screen.getByRole('heading', { name: 'Question No. 41' })).toBeTruthy();
    expect(paletteButton(80)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Reasoning Ability' }));
    expect(screen.getByRole('heading', { name: 'Question No. 1' })).toBeTruthy();
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

  it('summarises per section before submitting, and only submits on confirm', async () => {
    const { onFinished, id } = await mount();
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Save & Next/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const dialog = screen.getByRole('dialog', { name: 'Submit this test?' });
    expect(dialog.textContent).toContain('Reasoning Ability');
    expect(dialog.textContent).toContain('Quantitative Aptitude');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the test' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onFinished).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Submit' }).at(-1)!);
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(id));
    const attempt = await db.attempts.get(id);
    expect(attempt?.status).toBe('submitted');
    expect(attempt?.submitReason).toBe('manual');
    expect(attempt?.summary?.overall.attempted).toBe(1);
    expect(await db.responses.where('attemptId').equals(id).count()).toBe(80);
  });

  it('warns on the summary when the current selection is unsaved', async () => {
    await mount();
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('alert').textContent).toMatch(/question 1 is not saved/);
  });
});

describe('timer behaviour', () => {
  it('turns orange at 5:00, red at 1:00 and beeps once, then auto-submits at 0:00', async () => {
    fakeClock();
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

    const id = await createMockAttempt(1);
    await db.attempts.update(id, { remainingMs: 5 * 60_000 + 2000, visitStartRemainingMs: 5 * 60_000 + 2000 });
    const { onFinished } = await mount({}, id);
    const timer = () => screen.getByRole('timer');
    expect(timer().dataset.phase).toBe('normal');

    act(() => void vi.advanceTimersByTime(2000));
    expect(timer().dataset.phase).toBe('warning');
    expect(timer().textContent).toContain('05:00');

    act(() => void vi.advanceTimersByTime(4 * 60_000));
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

  it('stays silent at 1:00 when the beep is switched off', async () => {
    fakeClock();
    const AudioStub = vi.fn();
    vi.stubGlobal('AudioContext', AudioStub);
    const id = await createMockAttempt(1);
    await db.attempts.update(id, { remainingMs: 61_000, visitStartRemainingMs: 61_000 });
    await mount({ beepEnabled: false }, id);
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
    act(() => void vi.advanceTimersByTime(60_000));
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
    const atClose = 45 * 60_000 - 40_000;
    await until(remainingIs(id, atClose));
    expect((await saved(id, 'M01-Q02'))?.marked).toBe(true);

    // The tab stays closed for ten minutes. That time must not come off the clock.
    vi.advanceTimersByTime(10 * 60_000);
    expect((await db.attempts.get(id))?.remainingMs).toBe(atClose);
    await mount({}, id);

    expect(screen.getByRole('timer').textContent).toContain('44:20');
    expect(screen.getByRole('heading', { name: 'Question No. 3' })).toBeTruthy();
    expect(paletteButton(1).dataset.state).toBe('answered');
    expect(paletteButton(2).dataset.state).toBe('marked');
    fireEvent.click(paletteButton(1));
    expect((screen.getAllByRole('radio')[2] as HTMLInputElement).checked).toBe(true);
  });

  it('logs time across revisits and across the reload', async () => {
    fakeClock();
    const { id, unmount } = await mount();
    act(() => void vi.advanceTimersByTime(20_000));
    fireEvent.click(paletteButton(2));
    act(() => void vi.advanceTimersByTime(5_000));
    fireEvent.click(paletteButton(1));
    act(() => void vi.advanceTimersByTime(7_000));
    unmount();
    await until(remainingIs(id, 45 * 60_000 - 32_000));
    const { onFinished } = await mount({}, id);
    act(() => void vi.advanceTimersByTime(3_000));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Submit' }).at(-1)!);
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalled());

    expect((await saved(id, 'M01-Q01'))?.timeMs).toBe(30_000);
    expect((await saved(id, 'M01-Q02'))?.timeMs).toBe(5_000);
    const visits = await db.visits.where('attemptId').equals(id).sortBy('seq');
    expect(visits.map((v) => [v.qid, v.durationMs])).toEqual([
      ['M01-Q01', 20_000],
      ['M01-Q02', 5_000],
      ['M01-Q01', 7_000],
      ['M01-Q01', 3_000],
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
  const press = (key: string, shiftKey = false) => {
    const h = handlers();
    return { handled: routeExamKey({ key, shiftKey }, h), h };
  };

  it('maps 1-5 and A-E to options, upper or lower case', () => {
    expect(press('1').h.select).toHaveBeenCalledWith(0);
    expect(press('5').h.select).toHaveBeenCalledWith(4);
    expect(press('a').h.select).toHaveBeenCalledWith(0);
    expect(press('E').h.select).toHaveBeenCalledWith(4);
  });

  it('keeps plain C as option (c) and uses Shift+C for Clear Response', () => {
    const plain = press('c');
    expect(plain.h.select).toHaveBeenCalledWith(2);
    expect(plain.h.clear).not.toHaveBeenCalled();
    const shifted = press('C', true);
    expect(shifted.h.clear).toHaveBeenCalled();
    expect(shifted.h.select).not.toHaveBeenCalled();
  });

  it('ignores keys it does not own, leaving browser shortcuts alone', () => {
    for (const key of ['6', 'f', 'Tab', 'Enter', 'F5', 'Escape']) expect(press(key).handled).toBe(false);
  });
});
