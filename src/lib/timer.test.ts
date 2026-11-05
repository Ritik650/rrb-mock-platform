import { describe, expect, it, vi } from 'vitest';
import {
  createClockStore,
  createTimer,
  crossedCritical,
  pauseTimer,
  remainingAt,
  startTimer,
  timerPhase,
} from './timer';
import { formatClock } from './format';

const MIN = 60_000;

describe('timer', () => {
  it('counts down from wall-clock time, however rarely it is read', () => {
    const t = startTimer(createTimer(45 * MIN), 1000);
    expect(remainingAt(t, 1000)).toBe(45 * MIN);
    // A throttled tab may read the clock once a minute. The value must still be exact.
    expect(remainingAt(t, 1000 + 10 * MIN)).toBe(35 * MIN);
  });

  it('never goes below zero', () => {
    const t = startTimer(createTimer(1000), 0);
    expect(remainingAt(t, 999_999)).toBe(0);
  });

  it('does not run while stopped, which is how a closed tab keeps its remaining time', () => {
    const running = startTimer(createTimer(10 * MIN), 0);
    const closedAt = pauseTimer(running, 2 * MIN);
    expect(closedAt.remainingMs).toBe(8 * MIN);
    // Reopened an hour later.
    const reopened = startTimer(createTimer(closedAt.remainingMs), 60 * MIN);
    expect(remainingAt(reopened, 60 * MIN)).toBe(8 * MIN);
    expect(remainingAt(reopened, 61 * MIN)).toBe(7 * MIN);
  });

  it('pause and start are safe to repeat', () => {
    const t = startTimer(createTimer(MIN), 0);
    expect(startTimer(t, 500)).toBe(t);
    const paused = pauseTimer(t, 1000);
    expect(pauseTimer(paused, 5000)).toBe(paused);
    expect(paused.remainingMs).toBe(MIN - 1000);
  });

  it('ignores a clock that jumps backwards', () => {
    const t = startTimer(createTimer(MIN), 5000);
    expect(remainingAt(t, 1000)).toBe(MIN);
  });

  it('turns orange at 5:00 and red at 1:00', () => {
    expect(timerPhase(5 * MIN + 1)).toBe('normal');
    expect(timerPhase(5 * MIN)).toBe('warning');
    expect(timerPhase(MIN + 1)).toBe('warning');
    expect(timerPhase(MIN)).toBe('critical');
    expect(timerPhase(0)).toBe('critical');
  });

  it('flags the 1:00 crossing once, and not when resuming below it', () => {
    expect(crossedCritical(MIN + 1, MIN)).toBe(true);
    expect(crossedCritical(MIN, MIN - 1000)).toBe(false);
    expect(crossedCritical(30_000, 30_000)).toBe(false);
  });

  it('formats the countdown', () => {
    expect(formatClock(45 * MIN)).toBe('45:00');
    expect(formatClock(45 * MIN - 1)).toBe('45:00');
    expect(formatClock(5 * MIN)).toBe('05:00');
    expect(formatClock(999)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('only notifies the on-screen clock when the shown second changes', () => {
    const store = createClockStore(10_000);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(9_500); // still shows 00:10
    expect(listener).not.toHaveBeenCalled();
    store.set(9_000); // now 00:09
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set(1_000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
