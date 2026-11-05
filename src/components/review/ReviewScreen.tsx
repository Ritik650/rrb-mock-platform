import { useCallback, useEffect, useState } from 'react';
import type { LoadedAttempt } from '../../data/attemptStore';
import { toggleBookmark } from '../../data/bookmarks';
import { blankProgress } from '../../lib/examState';
import { navigate } from '../../router';
import { Button, Kbd } from '../common/ui';
import { SetPanel } from '../exam/SetPanel';
import { SectionTabs } from '../exam/ExamTopBar';
import { BookmarkStar, ReviewOptions, SolutionBlock, YourTime } from './ReviewedQuestion';
import { ReviewPalette } from './ReviewPalette';

interface Props {
  loaded: LoadedAttempt;
  initialBookmarks: Set<string>;
  initialQid: string | null;
}

/** The exam layout again, now showing answers, solutions and how long each question took. */
export function ReviewScreen({ loaded, initialBookmarks, initialQid }: Props) {
  const { paper, responses, attempt } = loaded;
  const [index, setIndex] = useState(() => (initialQid ? (paper.indexById.get(initialQid) ?? 0) : 0));
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const item = paper.items[index];
  const { q, block } = item;
  const progress = responses[q.id] ?? blankProgress();
  const section = paper.sections.find((s) => s.name === item.section) ?? paper.sections[0];

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(paper.items.length - 1, Math.max(0, i + delta))),
    [paper.items.length],
  );
  const pick = useCallback((i: number) => {
    setIndex(i);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const toggle = () => {
    void toggleBookmark(q.id).then((on) =>
      setBookmarks((cur) => {
        const next = new Set(cur);
        if (on) next.add(q.id);
        else next.delete(q.id);
        return next;
      }),
    );
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-navy-deep bg-navy px-3 text-white">
        <h1 className="truncate text-[15px] font-semibold">{paper.title}: Solutions</h1>
        <Button variant="ghost" onClick={() => navigate(`/result/${attempt.id}`)}>
          Back to analysis
        </Button>
      </header>
      <SectionTabs
        sections={paper.sections}
        activeSection={item.section}
        onSelect={(name) => {
          const target = paper.sections.find((s) => s.name === name);
          if (target) setIndex(target.items[0].index);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
            <h2 className="flex items-center gap-1 text-[13px] font-semibold">
              Question No. {item.displayNo}
              <BookmarkStar on={bookmarks.has(q.id)} onToggle={toggle} />
              <span className="font-normal text-ink-2">
                {q.topic}: {q.sub}
              </span>
            </h2>
            <YourTime q={q} targetSec={item.targetSec} timeMs={progress.timeMs} selected={progress.selected} />
          </div>
          {block.kind === 'set' && <SetPanel key={block.id} block={block} />}
          <div
            key={q.id}
            className="min-h-0 flex-1 gap-3 overflow-auto px-3 py-2 lg:grid lg:grid-cols-2 lg:items-start"
          >
            <div>
              <p className="whitespace-pre-line text-[15px] leading-[21px]">{q.stem}</p>
              <ReviewOptions q={q} selected={progress.selected} />
            </div>
            <SolutionBlock q={q} block={block} />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2">
            <div className="flex gap-2">
              <Button onClick={() => go(-1)} disabled={index === 0}>
                Previous<Kbd>←</Kbd>
              </Button>
              <Button onClick={() => go(1)} disabled={index === paper.items.length - 1}>
                Next<Kbd>→</Kbd>
              </Button>
            </div>
            <Button className="lg:hidden" onClick={() => setDrawerOpen(true)}>
              Palette
            </Button>
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
          aria-label="Question results"
          className={`fixed inset-y-0 right-0 z-40 w-[300px] flex-col border-l border-line bg-white lg:static lg:z-auto lg:flex lg:w-[320px] lg:shrink-0 ${drawerOpen ? 'flex' : 'hidden'}`}
        >
          <ReviewPalette
            section={section}
            activeQid={q.id}
            responses={responses}
            bookmarks={bookmarks}
            onPick={pick}
          />
        </aside>
      </div>
    </div>
  );
}
