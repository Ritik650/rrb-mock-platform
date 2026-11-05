import { useEffect, useRef } from 'react';

export interface ExamKeyHandlers {
  select: (option: number) => void;
  saveNext: () => void;
  markNext: () => void;
  clear: () => void;
  next: () => void;
  previous: () => void;
}

const LETTERS = 'abcde';

/**
 * 1-5 or A-E choose an option, N saves, M marks, arrows navigate. C already means option (c),
 * so Clear Response is Shift+C: a stray C must never wipe a saved answer.
 */
export function routeExamKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey'>, h: ExamKeyHandlers): boolean {
  const key = e.key.toLowerCase();
  if (e.key === 'ArrowRight') h.next();
  else if (e.key === 'ArrowLeft') h.previous();
  else if (key === 'c' && e.shiftKey) h.clear();
  else if (key === 'n') h.saveNext();
  else if (key === 'm') h.markNext();
  else if (key >= '1' && key <= '5' && key.length === 1) h.select(Number(key) - 1);
  else if (key.length === 1 && LETTERS.includes(key)) h.select(LETTERS.indexOf(key));
  else return false;
  return true;
}

export function useExamKeys(handlers: ExamKeyHandlers, enabled: boolean): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA' || (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'radio')) {
        return;
      }
      // Capture phase, so an arrow key on a focused radio cannot also change the option.
      if (routeExamKey(e, latest.current)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
