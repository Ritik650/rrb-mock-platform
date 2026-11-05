import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionPane } from '../components/exam/QuestionPane';
import { paperFromMock } from './paper';
import { derivedFor, DI_TOPIC, visualFor } from './visibility';
import { loadRealBundle } from '../test/bundle';

const bundle = loadRealBundle();
const papers = bundle.mocks.map(paperFromMock);
const allBlocks = bundle.mocks.flatMap((m) => m.sections.flatMap((s) => s.blocks));

const renderTestPane = (item: (typeof papers)[number]['items'][number]) =>
  renderToStaticMarkup(
    <QuestionPane
      item={item}
      draft={null}
      unsaved={false}
      marking={{ correct: 1, wrong: -0.25 }}
      onSelect={() => undefined}
    />,
  );

describe('test mode shows no answers', () => {
  it('covers the whole bank', () => {
    expect(papers.flatMap((p) => p.items)).toHaveLength(1600);
    expect(allBlocks.filter((b) => b.visual && b.topic !== DI_TOPIC).length).toBeGreaterThan(100);
  });

  it('never hands a non-DI visual to the test screen', () => {
    for (const block of allBlocks) {
      if (block.topic === DI_TOPIC) continue;
      expect(visualFor(block, 'test'), block.id).toBeNull();
    }
  });

  it('renders no diagram or table for any of the questions outside DI', () => {
    for (const paper of papers) {
      for (const item of paper.items) {
        if (item.block.topic === DI_TOPIC) continue;
        const html = renderTestPane(item);
        expect(html, item.q.id).not.toContain('<svg');
        expect(html, item.q.id).not.toContain('<table');
        expect(html, item.q.id).not.toContain('data-visual');
      }
    }
  });

  it('renders exactly one visual for every DI question', () => {
    let checked = 0;
    for (const paper of papers) {
      for (const item of paper.items) {
        if (item.block.topic !== DI_TOPIC) continue;
        const html = renderTestPane(item);
        expect(html.match(/data-visual=/g), item.q.id).toHaveLength(1);
        checked += 1;
      }
    }
    expect(checked).toBe(200);
  });

  it('never shows the DI "derived" helper table or any solution text', () => {
    for (const paper of papers) {
      for (const item of paper.items) {
        const html = renderTestPane(item);
        for (const step of item.q.sol) {
          // Short steps such as "J owns BMW." can coincide with passage wording, so test long ones.
          if (step.length > 25) expect(html, item.q.id).not.toContain(step);
        }
        if (item.block.derived) {
          expect(derivedFor(item.block, 'test')).toBeNull();
          const onlyInDerived = item.block.derived.headers.filter(
            (h) => h.length > 3 && !JSON.stringify(item.block.visual).includes(h) && !item.block.intro?.includes(h),
          );
          for (const h of onlyInDerived) expect(html, item.q.id).not.toContain(h);
        }
      }
    }
  });

  it('returns every visual and derived table in review mode', () => {
    for (const block of allBlocks) {
      expect(visualFor(block, 'review')).toBe(block.visual ?? null);
      expect(derivedFor(block, 'review')).toBe(block.derived ?? null);
    }
  });
});
