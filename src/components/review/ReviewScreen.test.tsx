import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewScreen } from './ReviewScreen';
import { db } from '../../data/db';
import { paperFromMock } from '../../lib/paper';
import { summarize } from '../../lib/scoring';
import { loadRealBundle } from '../../test/bundle';
import type { Attempt, QuestionProgress } from '../../types';

const mock = loadRealBundle().mocks[0];
const paper = paperFromMock(mock);

const answer = (selected: number | null, timeMs = 0): QuestionProgress => ({
  selected,
  marked: false,
  visited: true,
  timeMs,
  visitCount: 1,
});

function setup(responses: Record<string, QuestionProgress>, qid: string | null = null) {
  const attempt = {
    id: 'A1',
    kind: 'mock',
    mockNo: 1,
    status: 'submitted',
    title: mock.title,
    summary: summarize(paper, responses),
  } as Attempt;
  return render(
    <ReviewScreen loaded={{ attempt, paper, responses, visits: [] }} initialBookmarks={new Set()} initialQid={qid} />,
  );
}

const q1 = paper.items[0].q;
const puzzleQuestion = paper.items.find((i) => i.block.topic === 'Puzzle' && i.block.visual)!;
const diWithDerived = paper.items.find((i) => i.block.topic === 'Data interpretation' && i.block.derived)!;

const row = (optionIndex: number) => screen.getAllByRole('listitem').filter((li) => li.dataset.correct !== undefined)[optionIndex];

beforeEach(async () => {
  await db.bookmarks.clear();
});

describe('review screen', () => {
  it('marks the correct option green and a wrong pick red, in words as well', () => {
    const wrong = (q1.ans + 1) % 5;
    setup({ [q1.id]: answer(wrong, 95_000) });
    expect(row(q1.ans).dataset.correct).toBe('true');
    expect(row(q1.ans).className).toContain('border-ans');
    expect(row(q1.ans).textContent).toContain('Correct answer');
    expect(row(wrong).dataset.mine).toBe('true');
    expect(row(wrong).className).toContain('border-nans');
    expect(row(wrong).textContent).toContain('Your answer');
  });

  it('shows one row as both correct and mine when the answer was right', () => {
    setup({ [q1.id]: answer(q1.ans) });
    expect(row(q1.ans).textContent).toContain('Correct answer');
    expect(row(q1.ans).textContent).toContain('Your answer');
    expect(screen.getByText('✓ Correct')).toBeTruthy();
  });

  it('numbers the solution steps', () => {
    setup({});
    const solution = screen.getByRole('region', { name: 'Solution' });
    const steps = within(solution).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent)).toEqual(q1.sol);
    expect(within(solution).getByRole('list').tagName).toBe('OL');
  });

  it('shows my time against the target', () => {
    setup({ [q1.id]: answer(q1.ans, 95_000) });
    const time = screen.getByTestId('review-time').textContent;
    expect(time).toContain('1:35');
    expect(time).toContain(`0:${q1.time}`);
  });

  it('shows a Quant question against its target fitted to the 20 minute clock', () => {
    const item = paper.sections[1].items[0];
    setup({ [item.q.id]: answer(item.q.ans, 1000) }, item.q.id);
    const seconds = Math.round(item.targetSec);
    expect(seconds).toBeLessThan(item.q.time);
    expect(screen.getByTestId('review-time').textContent).toContain(
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    );
  });

  it('reveals the puzzle arrangement in the solution', () => {
    setup({}, puzzleQuestion.q.id);
    const visual = within(screen.getByTestId('solution-visual')).getByRole('img');
    expect(visual.getAttribute('data-visual')).toBe(puzzleQuestion.block.visual!.type);
  });

  it('keeps the DI chart in the panel, and adds the derived table to the solution', () => {
    setup({}, diWithDerived.q.id);
    expect(within(screen.getByTestId('set-panel')).getByRole('img')).toBeTruthy();
    expect(screen.queryByTestId('solution-visual')).toBeNull();
    expect(within(screen.getByTestId('solution-derived')).getByRole('img')).toBeTruthy();
  });

  it('colours the palette by result', () => {
    const [a, b, c] = paper.items.map((i) => i.q);
    setup({ [a.id]: answer(a.ans), [b.id]: answer((b.ans + 1) % 5), [c.id]: answer(null) });
    const cell = (no: number) => screen.getByRole('button', { name: new RegExp(`^Question ${no},`) });
    expect(cell(1).dataset.result).toBe('correct');
    expect(cell(2).dataset.result).toBe('wrong');
    expect(cell(3).dataset.result).toBe('blank');
    expect(cell(4).dataset.result).toBe('not_visited');
  });

  it('navigates with buttons, arrow keys and section tabs', () => {
    setup({});
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByRole('heading', { name: /Question No\. 2/ })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: /Question No\. 1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Quantitative Aptitude' }));
    expect(screen.getByRole('heading', { name: /Question No\. 41/ })).toBeTruthy();
  });

  it('bookmarks and un-bookmarks with the star, saving to the Revision list', async () => {
    setup({});
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark this question' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove bookmark' })).toBeTruthy());
    expect(await db.bookmarks.get(q1.id)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Question 1, .*bookmarked/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bookmark this question' })).toBeTruthy());
    expect(await db.bookmarks.get(q1.id)).toBeUndefined();
  });
});
