import type { AttemptSummary, Marking, QuestionProgress, Question, Tally, TopicStat } from '../types';
import type { Paper } from './paper';

export type Outcome = 'correct' | 'wrong' | 'blank';

export function outcomeOf(q: Question, selected: number | null | undefined): Outcome {
  if (selected === null || selected === undefined) return 'blank';
  return selected === q.ans ? 'correct' : 'wrong';
}

/**
 * Evaluation looks only at the stored answer, so "answered & marked" counts
 * and "marked" on its own (no answer) does not.
 */
export function tallyQuestions(
  questions: Question[],
  progress: Record<string, QuestionProgress | undefined>,
  marking: Marking,
): Tally {
  let correct = 0;
  let wrong = 0;
  let timeMs = 0;
  for (const q of questions) {
    const p = progress[q.id];
    timeMs += p?.timeMs ?? 0;
    const outcome = outcomeOf(q, p?.selected);
    if (outcome === 'correct') correct += 1;
    if (outcome === 'wrong') wrong += 1;
  }
  const attempted = correct + wrong;
  return {
    total: questions.length,
    attempted,
    correct,
    wrong,
    blank: questions.length - attempted,
    accuracy: attempted === 0 ? 0 : (correct / attempted) * 100,
    net: correct * marking.correct + wrong * marking.wrong,
    timeMs,
  };
}

function topicStats(paper: Paper, progress: Record<string, QuestionProgress | undefined>): TopicStat[] {
  const byTopic = new Map<string, TopicStat>();
  for (const { q, section, targetSec } of paper.items) {
    let stat = byTopic.get(q.topic);
    if (!stat) {
      stat = { topic: q.topic, section, total: 0, attempted: 0, correct: 0, timeMs: 0, targetSec: 0 };
      byTopic.set(q.topic, stat);
    }
    const p = progress[q.id];
    const outcome = outcomeOf(q, p?.selected);
    stat.total += 1;
    stat.targetSec += targetSec;
    stat.timeMs += p?.timeMs ?? 0;
    if (outcome !== 'blank') stat.attempted += 1;
    if (outcome === 'correct') stat.correct += 1;
  }
  return [...byTopic.values()];
}

export function summarize(paper: Paper, progress: Record<string, QuestionProgress | undefined>): AttemptSummary {
  return {
    overall: tallyQuestions(
      paper.items.map((i) => i.q),
      progress,
      paper.marking,
    ),
    sections: paper.sections.map((s) => ({
      name: s.name,
      tally: tallyQuestions(
        s.items.map((i) => i.q),
        progress,
        paper.marking,
      ),
    })),
    topics: topicStats(paper, progress),
  };
}
