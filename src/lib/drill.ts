import type { Block, Question } from '../types';
import { outcomeOf } from './scoring';

/** How a question stands, from most to least worth drilling. */
export type QuestionStanding = 'wrong' | 'never_seen' | 'skipped' | 'correct';

const PRIORITY: QuestionStanding[] = ['wrong', 'never_seen', 'skipped', 'correct'];

export interface HistoryRow {
  qid: string;
  selected: number | null;
  visited: boolean;
}

/**
 * The latest answer to a question decides its standing, so fixing a mistake takes it off the top of
 * the list. Rows must run oldest first. A later skip does not erase an earlier answer.
 */
export function questionStandings(
  rows: HistoryRow[],
  questionById: (qid: string) => Question | undefined,
): Map<string, QuestionStanding> {
  const standing = new Map<string, QuestionStanding>();
  for (const row of rows) {
    if (!row.visited) continue;
    const q = questionById(row.qid);
    if (!q) continue;
    const outcome = outcomeOf(q, row.selected);
    if (outcome === 'blank') {
      if (!standing.has(row.qid)) standing.set(row.qid, 'skipped');
    } else {
      standing.set(row.qid, outcome);
    }
  }
  return standing;
}

export interface DrillPlan {
  blocks: Block[];
  questionCount: number;
  /** The sum of the target times. */
  durationSec: number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The first block that fits the space left, or failing that the highest-priority block, which overshoots. */
function takeNext(bands: Block[][], remaining: number): Block | null {
  for (const band of bands) {
    const fitting = band.findIndex((b) => b.qs.length <= remaining);
    if (fitting !== -1) return band.splice(fitting, 1)[0];
  }
  return bands.find((band) => band.length > 0)?.shift() ?? null;
}

/**
 * Picks whole blocks for the chosen topics. Questions you got wrong or never saw come first, wrong
 * ahead of new. A set is only ever taken whole, so a paper can run over the requested count, but a
 * block that fits exactly is taken over one that would overshoot. Skipped and correct questions are
 * used only once nothing wrong or new is left.
 */
export function planDrill(
  candidates: Block[],
  topics: Set<string>,
  count: number,
  standings: Map<string, QuestionStanding>,
  random: () => number = Math.random,
): DrillPlan {
  const standingOf = (q: Question): QuestionStanding => standings.get(q.id) ?? 'never_seen';
  const rank = (block: Block) => Math.min(...block.qs.map((q) => PRIORITY.indexOf(standingOf(q))));

  const bands = PRIORITY.map((_, band) =>
    shuffled(
      candidates.filter((b) => topics.has(b.topic) && rank(b) === band),
      random,
    ),
  );
  const preferred = bands.slice(0, 2);
  const rest = bands.slice(2);

  const picked: Block[] = [];
  let remaining = count;
  while (remaining > 0) {
    const block = takeNext(preferred, remaining) ?? takeNext(rest, remaining);
    if (!block) break;
    picked.push(block);
    remaining -= block.qs.length;
  }

  const questions = picked.flatMap((b) => b.qs);
  return {
    blocks: picked,
    questionCount: questions.length,
    durationSec: questions.reduce((sum, q) => sum + q.time, 0),
  };
}

export function drillTitle(topics: string[], questionCount: number): string {
  const what = topics.length <= 3 ? topics.join(', ') : `${topics.length} topics`;
  return `Drill: ${what} (${questionCount} Q)`;
}
