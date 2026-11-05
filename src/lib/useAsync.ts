import { useCallback, useEffect, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  reload: () => void;
}

/** Runs a loader on mount and when deps change. Late results from an old run are dropped. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    load().then(
      (value) => {
        if (live) setData(value);
      },
      (e: unknown) => {
        if (live) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      live = false;
    };
    // The caller's deps decide when to reload; `load` is recreated on every render.
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}
