import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Bundle, Question } from '../types';

/** The real question bank, used by tests that must hold for every mock. */
export function loadRealBundle(): Bundle {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'data/rrb_po_prelims_20_mocks.json'), 'utf8'));
}

export function makeQuestion(no: number, over: Partial<Question> = {}): Question {
  return {
    id: `T-Q${no}`,
    no,
    section: 'Reasoning Ability',
    set_id: null,
    stem: `Question ${no}`,
    options: ['a', 'b', 'c', 'd', 'e'],
    ans: 0,
    answer: 'A',
    sol: ['Because.'],
    topic: 'Syllogism',
    sub: 'Syllogism',
    time: 40,
    ...over,
  };
}
