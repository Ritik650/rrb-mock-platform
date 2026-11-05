const pad = (n: number) => String(n).padStart(2, '0');

/** Countdown text. Rounds up, so a fresh 45-minute paper reads 45:00 and 0:00 means time is up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Elapsed time such as 2:40. Rounds to the nearest second. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}:${pad(total % 60)}`;
}

/** Scores move in quarter marks: 37.5, 58.25, 64. */
export function formatScore(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function formatGap(net: number, cutOff: number): string {
  const gap = net - cutOff;
  if (gap === 0) return 'At the cut-off';
  return gap > 0 ? `${formatScore(gap)} above cut-off` : `${formatScore(-gap)} short of cut-off`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const optionLetter = (i: number) => 'abcde'[i] ?? '?';
