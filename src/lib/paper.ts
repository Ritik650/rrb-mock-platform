import { targetScaleFor } from './sectionTiming';
import type { Block, Marking, Mock, Question } from '../types';

/** A sitting's questions in order. A full mock and a topic drill both become one of these. */
export interface PaperItem {
  q: Question;
  block: Block;
  /** The number on the palette: 1-80 in a mock, 1-n in a drill. */
  displayNo: number;
  section: string;
  index: number;
  /** Seconds to aim for: q.time fitted to its section's clock. Analysis judges against this. */
  targetSec: number;
}

export interface PaperSection {
  name: string;
  items: PaperItem[];
}

export interface Paper {
  title: string;
  durationSec: number;
  marking: Marking;
  sections: PaperSection[];
  items: PaperItem[];
  indexById: Map<string, number>;
}

function assemble(
  title: string,
  durationSec: number,
  marking: Marking,
  groups: { name: string; blocks: Block[] }[],
  displayNo: (q: Question, position: number) => number,
  targetScale: (block: Block, section: string) => number,
): Paper {
  const items: PaperItem[] = [];
  const sections: PaperSection[] = [];
  for (const group of groups) {
    const section: PaperSection = { name: group.name, items: [] };
    for (const block of group.blocks) {
      const scale = targetScale(block, group.name);
      for (const q of block.qs) {
        const index = items.length;
        const item: PaperItem = {
          q,
          block,
          displayNo: displayNo(q, index + 1),
          section: group.name,
          index,
          targetSec: q.time * scale,
        };
        items.push(item);
        section.items.push(item);
      }
    }
    sections.push(section);
  }
  return {
    title,
    durationSec,
    marking,
    sections,
    items,
    indexById: new Map(items.map((item) => [item.q.id, item.index])),
  };
}

export function paperFromMock(mock: Mock): Paper {
  const scale = targetScaleFor(mock);
  return assemble(
    mock.title,
    mock.duration_min * 60,
    mock.marking,
    mock.sections,
    (q) => q.no,
    (_block, section) => scale(section),
  );
}

/**
 * Groups a drill's blocks by section in first-seen order and numbers them from 1. `targetScale`
 * gives each block the scale it has in its own mock, so a question's target is the same everywhere.
 */
export function paperFromBlocks(
  title: string,
  durationSec: number,
  marking: Marking,
  blocks: Block[],
  targetScale: (block: Block) => number = () => 1,
): Paper {
  const groups: { name: string; blocks: Block[] }[] = [];
  for (const block of blocks) {
    const name = block.qs[0].section;
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, blocks: [] };
      groups.push(group);
    }
    group.blocks.push(block);
  }
  return assemble(title, durationSec, marking, groups, (_q, position) => position, targetScale);
}
