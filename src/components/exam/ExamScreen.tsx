import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadedAttempt } from '../../data/attemptStore';
import { hasNextStage, hasUnsavedDraft } from '../../lib/examState';
import type { Settings } from '../../types';
import { Button, Kbd } from '../common/ui';
import { ExamTopBar, SectionTabs } from './ExamTopBar';
import { Palette } from './Palette';
import { QuestionPane } from './QuestionPane';
import { SubmitModal } from './SubmitModal';
import { useExamKeys } from './useExamKeys';
import { useExamSession } from './useExamSession';

interface Props {
  loaded: LoadedAttempt;
  settings: Settings;
  onFinished: (attemptId: string) => void;
}

export function ExamScreen({ loaded, settings, onFinished }: Props) {
  const { paper } = loaded;
  const { state, clock, paused, notice, actions } = useExamSession(loaded, settings.beepEnabled, onFinished);
  const [confirming, setConfirming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastInSection = useRef(new Map<string, number>());

  const item = paper.items[state.activeIndex];
  lastInSection.current.set(item.section, item.index);
  const section = paper.sections.find((s) => s.name === item.section) ?? paper.sections[0];
  const unsaved = hasUnsavedDraft(state);
  const sectional = state.ranges.length > 1;
  const firstInRange = state.ranges[state.activeStage].start;
  const nextSection = hasNextStage(state) ? paper.sections[state.activeStage + 1] : null;

  // A section's time can run out while its dialog is open. The dialog no longer applies then.
  useEffect(() => {
    setConfirming(false);
    setDrawerOpen(false);
  }, [state.activeStage]);

  useExamKeys(actions, !confirming && !paused);

  const { goToIndex } = actions;
  const openSection = useCallback(
    (name: string) => {
      const target = paper.sections.find((s) => s.name === name);
      if (!target) return;
      goToIndex(lastInSection.current.get(name) ?? target.items[0].index);
    },
    [goToIndex, paper.sections],
  );
  const pick = useCallback(
    (index: number) => {
      goToIndex(index);
      setDrawerOpen(false);
    },
    [goToIndex],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <ExamTopBar
        title={paper.title}
        candidate={settings.candidateName}
        clock={clock}
        timerLabel={sectional ? 'Section time left' : 'Time left'}
        allowPause={settings.allowPause}
        paused={paused}
        onTogglePause={actions.togglePause}
      />
      <SectionTabs
        sections={paper.sections}
        activeSection={item.section}
        onSelect={openSection}
        limitsSec={sectional ? loaded.attempt.sectionLimitsSec : null}
        runningIndex={state.activeStage}
      />
      {notice && (
        <p role="status" className="shrink-0 border-b border-amber bg-[#fff4e0] px-3 py-1 text-[13px] font-medium">
          {notice}
        </p>
      )}

      {paused ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-panel">
          <p className="text-[15px] font-semibold">Test paused. The clock has stopped.</p>
          <Button variant="primary" onClick={actions.togglePause}>
            Resume the test
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <QuestionPane
              item={item}
              draft={state.draft}
              unsaved={unsaved}
              marking={paper.marking}
              onSelect={actions.select}
            />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
              <div className="flex flex-wrap gap-2">
                <Button onClick={actions.markNext}>
                  Mark for Review &amp; Next<Kbd>M</Kbd>
                </Button>
                <Button variant="danger" onClick={actions.clear}>
                  Clear Response<Kbd>C</Kbd>
                </Button>
                <Button onClick={actions.previous} disabled={state.activeIndex === firstInRange}>
                  Previous<Kbd>←</Kbd>
                </Button>
                <Button onClick={actions.next}>
                  Next<Kbd>→</Kbd>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button className="lg:hidden" onClick={() => setDrawerOpen(true)}>
                  Palette
                </Button>
                <Button variant="primary" onClick={actions.saveNext}>
                  Save &amp; Next<Kbd>N</Kbd>
                </Button>
              </div>
            </div>
          </div>

          {drawerOpen && (
            <button
              type="button"
              aria-label="Close palette"
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          )}
          <aside
            aria-label="Question palette"
            className={`fixed inset-y-0 right-0 z-40 w-[300px] flex-col border-l border-line bg-white lg:static lg:z-auto lg:flex lg:w-[320px] lg:shrink-0 ${drawerOpen ? 'flex' : 'hidden'}`}
          >
            <Palette section={section} activeQid={item.q.id} progress={state.progress} onPick={pick} />
            <div className="shrink-0 border-t border-line p-2">
              <Button variant="submit" className="w-full" onClick={() => setConfirming(true)}>
                {nextSection ? 'Submit section' : 'Submit'}
              </Button>
            </div>
          </aside>
        </div>
      )}

      {confirming && (
        <SubmitModal
          paper={paper}
          progress={state.progress}
          unsavedQuestionNo={unsaved ? item.displayNo : null}
          moveOn={nextSection ? { section, next: nextSection } : null}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            actions.submit();
          }}
        />
      )}
    </div>
  );
}
