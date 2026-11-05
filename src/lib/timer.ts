/**
 * The paper's single countdown. It is computed from wall-clock time rather than by counting ticks,
 * so a throttled background tab cannot make it drift. Time only runs while the attempt is open:
 * reopening a closed tab resumes from the saved remaining time.
 */
export interface TimerState {
  remainingMs: number;
  /** Wall-clock start of the current run, or null while stopped. */
  runningSince: number | null;
}

export const WARNING_MS = 5 * 60 * 1000;
export const CRITICAL_MS = 60 * 1000;

export type TimerPhase = 'normal' | 'warning' | 'critical';

export function createTimer(remainingMs: number): TimerState {
  return { remainingMs: Math.max(0, remainingMs), runningSince: null };
}

export function remainingAt(t: TimerState, now: number): number {
  if (t.runningSince === null) return t.remainingMs;
  return Math.max(0, t.remainingMs - Math.max(0, now - t.runningSince));
}

export function startTimer(t: TimerState, now: number): TimerState {
  return t.runningSince === null ? { ...t, runningSince: now } : t;
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  return t.runningSince === null ? t : { remainingMs: remainingAt(t, now), runningSince: null };
}

/** Orange from 5:00 left, red from 1:00 left. */
export function timerPhase(remainingMs: number): TimerPhase {
  if (remainingMs <= CRITICAL_MS) return 'critical';
  if (remainingMs <= WARNING_MS) return 'warning';
  return 'normal';
}

/** True only on the tick that crosses 1:00, so the warning beep sounds once. */
export function crossedCritical(prevMs: number, nextMs: number): boolean {
  return prevMs > CRITICAL_MS && nextMs <= CRITICAL_MS;
}

/** Fan-out for the on-screen clock, so only the clock re-renders each second. */
export interface ClockStore {
  get: () => number;
  set: (ms: number) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createClockStore(initialMs: number): ClockStore {
  let ms = initialMs;
  const listeners = new Set<() => void>();
  return {
    get: () => ms,
    set(next) {
      const changed = Math.ceil(next / 1000) !== Math.ceil(ms / 1000);
      ms = next;
      if (changed) listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
