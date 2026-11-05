import type { LoadedAttempt } from '../../data/attemptStore';
import { resumeExam, startExam, type Clock, type ExamState } from '../../lib/examState';
import { clockRanges } from '../../lib/sectionTiming';

/** A new paper opens on its first question. A saved one carries on from where it was left. */
export function restoreExamState(loaded: LoadedAttempt, clock: Clock): ExamState {
  const { attempt, paper, responses } = loaded;
  const order = paper.items.map((i) => i.q.id);
  const ranges = clockRanges(paper, attempt.sectionLimitsSec);
  if (attempt.activeQid === null) return startExam(order, clock, ranges);
  return resumeExam(
    order,
    {
      progress: responses,
      activeQid: attempt.activeQid,
      visitStartRemainingMs: attempt.visitStartRemainingMs,
      visitEnteredAt: attempt.visitEnteredAt,
      nextVisitSeq: attempt.nextVisitSeq,
      activeStage: attempt.activeSection,
      remainingMs: attempt.remainingMs,
      checkpointAt: attempt.checkpointAt,
    },
    clock,
    ranges,
  );
}
