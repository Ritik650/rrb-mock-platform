import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkpointAttempt, saveExamDelta, submitAttempt, type LoadedAttempt } from '../../data/attemptStore';
import { softBeep } from '../../lib/beep';
import {
  clearResponse,
  goNext,
  goPrevious,
  goTo,
  markAndNext,
  resumeExam,
  saveAndNext,
  selectOption,
  startExam,
  type Clock,
  type ExamState,
} from '../../lib/examState';
import {
  createClockStore,
  createTimer,
  crossedCritical,
  pauseTimer,
  remainingAt,
  startTimer,
  type ClockStore,
  type TimerState,
} from '../../lib/timer';

const TICK_MS = 250;
const CHECKPOINT_MS = 1000;

export interface ExamSession {
  state: ExamState;
  clock: ClockStore;
  paused: boolean;
  actions: {
    select: (option: number) => void;
    saveNext: () => void;
    markNext: () => void;
    clear: () => void;
    next: () => void;
    previous: () => void;
    goToIndex: (index: number) => void;
    togglePause: () => void;
    submit: () => void;
  };
}

function initialState(loaded: LoadedAttempt, clock: Clock): ExamState {
  const { attempt, paper, responses } = loaded;
  const order = paper.items.map((i) => i.q.id);
  if (attempt.activeQid === null) return startExam(order, clock);
  return resumeExam(
    order,
    {
      progress: responses,
      activeQid: attempt.activeQid,
      visitStartRemainingMs: attempt.visitStartRemainingMs,
      visitEnteredAt: attempt.visitEnteredAt,
      nextVisitSeq: attempt.nextVisitSeq,
      remainingMs: attempt.remainingMs,
      checkpointAt: attempt.checkpointAt,
    },
    clock,
  );
}

/**
 * Owns a sitting: the running clock, autosave and submission. Writes never block a question
 * change, because the screen updates first and IndexedDB catches up behind it.
 */
export function useExamSession(
  loaded: LoadedAttempt,
  beepEnabled: boolean,
  onFinished: (attemptId: string) => void,
): ExamSession {
  const { attempt, paper } = loaded;
  const attemptId = attempt.id;

  const timer = useRef<TimerState>(createTimer(attempt.remainingMs));
  const clock = useMemo(() => createClockStore(attempt.remainingMs), [attempt.remainingMs]);
  const [state, setState] = useState<ExamState>(() =>
    initialState(loaded, { now: Date.now(), remainingMs: attempt.remainingMs }),
  );
  const stateRef = useRef(state);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const finished = useRef(false);
  const savedVisits = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const beepOn = useRef(beepEnabled);
  beepOn.current = beepEnabled;

  const enqueue = useCallback((write: () => Promise<unknown>) => {
    writes.current = writes.current.then(write).catch((e: unknown) => {
      console.error('Could not save progress', e);
    });
  }, []);

  const persist = useCallback(
    (prev: ExamState | null, next: ExamState, at: Clock) => {
      const rows = next.order
        .filter((qid) => !prev || prev.progress[qid] !== next.progress[qid])
        .map((qid) => ({ qid, progress: next.progress[qid] }));
      const visits = next.visitLog.slice(savedVisits.current);
      savedVisits.current = next.visitLog.length;
      enqueue(() =>
        saveExamDelta(attemptId, {
          rows,
          visits,
          patch: {
            remainingMs: at.remainingMs,
            checkpointAt: at.now,
            activeQid: next.order[next.activeIndex],
            visitStartRemainingMs: next.visitStartRemainingMs,
            visitEnteredAt: next.visitEnteredAt,
            nextVisitSeq: next.nextVisitSeq,
          },
        }),
      );
    },
    [attemptId, enqueue],
  );

  const readClock = useCallback((): Clock => {
    const now = Date.now();
    return { now, remainingMs: remainingAt(timer.current, now) };
  }, []);

  const apply = useCallback(
    (change: (s: ExamState, at: Clock) => ExamState) => {
      if (finished.current || pausedRef.current) return;
      const at = readClock();
      const prev = stateRef.current;
      const next = change(prev, at);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      persist(prev, next, at);
    },
    [persist, readClock],
  );

  const finish = useCallback(
    (reason: 'manual' | 'timeout') => {
      if (finished.current) return;
      finished.current = true;
      const at = readClock();
      const final = stateRef.current;
      const closing = { ...final, visitLog: final.visitLog.slice(savedVisits.current) };
      enqueue(() => submitAttempt(attemptId, paper, closing, at, reason));
      void writes.current.then(() => onFinished(attemptId));
    },
    [attemptId, enqueue, onFinished, paper, readClock],
  );

  // Save the opening state once: the first question counts as visited as soon as it appears.
  useEffect(() => {
    persist(null, stateRef.current, readClock());
    // Runs once per sitting by design.
  }, []);

  useEffect(() => {
    if (!pausedRef.current) timer.current = startTimer(timer.current, Date.now());
    let previousMs = remainingAt(timer.current, Date.now());
    let lastCheckpoint = 0;

    const checkpoint = () => {
      if (finished.current) return;
      const at = readClock();
      lastCheckpoint = at.now;
      enqueue(() => checkpointAttempt(attemptId, at.remainingMs, at.now));
    };

    const tick = () => {
      if (finished.current) return;
      const at = readClock();
      clock.set(at.remainingMs);
      if (crossedCritical(previousMs, at.remainingMs) && beepOn.current) softBeep();
      previousMs = at.remainingMs;
      if (at.remainingMs <= 0) finish('timeout');
      else if (at.now - lastCheckpoint >= CHECKPOINT_MS) checkpoint();
    };

    tick();
    const interval = window.setInterval(tick, TICK_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') checkpoint();
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', onHide);
      checkpoint();
      timer.current = pauseTimer(timer.current, Date.now());
    };
  }, [attemptId, clock, enqueue, finish, readClock]);

  const togglePause = useCallback(() => {
    if (finished.current) return;
    const now = Date.now();
    const pausing = !pausedRef.current;
    timer.current = pausing ? pauseTimer(timer.current, now) : startTimer(timer.current, now);
    pausedRef.current = pausing;
    setPaused(pausing);
  }, []);

  const actions = useMemo<ExamSession['actions']>(
    () => ({
      select: (option) => apply((s) => selectOption(s, option)),
      saveNext: () => apply(saveAndNext),
      markNext: () => apply(markAndNext),
      clear: () => apply(clearResponse),
      next: () => apply(goNext),
      previous: () => apply(goPrevious),
      goToIndex: (index) => apply((s, at) => goTo(s, index, at)),
      togglePause,
      submit: () => finish('manual'),
    }),
    [apply, finish, togglePause],
  );

  return { state, clock, paused, actions };
}
