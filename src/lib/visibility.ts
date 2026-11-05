import type { Block, Derived, Visual } from '../types';

export type ViewMode = 'test' | 'review';

export const DI_TOPIC = 'Data interpretation';

/**
 * The one gate between the question bank and the test screen. During a test only Data
 * interpretation visuals are question data. Every other visual is the answer: puzzle arrangements,
 * caselet totals, coding tables and family trees.
 */
export function visualFor(block: Block, mode: ViewMode): Visual | null {
  if (!block.visual) return null;
  if (mode === 'review') return block.visual;
  return block.topic === DI_TOPIC ? block.visual : null;
}

/** `derived` is a solution helper, so it never appears during a test. */
export function derivedFor(block: Block, mode: ViewMode): Derived | null {
  return mode === 'review' ? (block.derived ?? null) : null;
}
