import { useCallback, useEffect, useState } from 'react';
import { db } from './db';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const KEY = 'app';

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get(KEY);
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(next: Settings): Promise<void> {
  await db.settings.put({ key: KEY, value: next });
}

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let live = true;
    void loadSettings().then((s) => {
      if (live) setSettings(s);
    });
    return () => {
      live = false;
    };
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((cur) => {
      const next = { ...(cur ?? DEFAULT_SETTINGS), ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);
  return [settings, update];
}
