import type { Attempt, Mock } from '../types';
import type { QuestionRange } from './examState';
import type { Paper } from './paper';

/** The RRB PO Prelims pattern. Each section runs on its own clock, in paper order. */
const SECTION_MINUTES = new Map([
  ['Reasoning Ability', 25],
  ['Quantitative Aptitude', 20],
]);

/**
 * Seconds per section in paper order, or null when a mock must run on one clock: an imported paper
 * with a section we have no limit for, or limits that do not add up to its stated duration.
 */
export function sectionLimitsFor(mock: Pick<Mock, 'sections' | 'duration_min'>): number[] | null {
  const minutes = mock.sections.map((s) => SECTION_MINUTES.get(s.name));
  if (minutes.some((m) => m === undefined)) return null;
  const known = minutes as number[];
  if (known.reduce((a, b) => a + b, 0) !== mock.duration_min) return null;
  return known.map((m) => m * 60);
}

/**
 * How far to shorten a section's target times so they add up to its clock. The bank's Quant targets
 * total 28-30 minutes against a 20 minute limit, so that pace could not finish the section. Targets
 * that already fit stay as written, and a mock with no section clocks has no limit to fit.
 */
export function targetScaleFor(mock: Pick<Mock, 'sections' | 'duration_min'>): (section: string) => number {
  const limits = sectionLimitsFor(mock);
  const scales = new Map(
    mock.sections.map((s, i) => {
      const total = s.blocks.flatMap((b) => b.qs).reduce((sum, q) => sum + q.time, 0);
      return [s.name, limits && total > limits[i] ? limits[i] / total : 1];
    }),
  );
  return (section) => scales.get(section) ?? 1;
}

/**
 * The stretch of questions each clock covers. Without section limits that is the whole paper, which
 * is how drills run, along with any mock begun before sections were timed.
 */
export function clockRanges(paper: Paper, limitsSec: number[] | null | undefined): QuestionRange[] {
  const whole = [{ start: 0, end: paper.items.length }];
  if (!limitsSec || limitsSec.length !== paper.sections.length) return whole;
  let start = 0;
  return paper.sections.map((s) => {
    const range = { start, end: start + s.items.length };
    start = range.end;
    return range;
  });
}

/** Time still to come on the whole paper: this section's clock plus every later section's limit. */
export function paperTimeLeftMs(
  attempt: Pick<Attempt, 'remainingMs' | 'sectionLimitsSec' | 'activeSection'>,
): number {
  const later = (attempt.sectionLimitsSec ?? []).slice((attempt.activeSection ?? 0) + 1);
  return attempt.remainingMs + later.reduce((sum, sec) => sum + sec * 1000, 0);
}
