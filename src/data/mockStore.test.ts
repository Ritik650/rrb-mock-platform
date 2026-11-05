import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addBundle, buildBank, ImportRejected, importBundleText } from './mockStore';
import { loadRealBundle } from '../test/bundle';

describe('mock store', () => {
  beforeEach(async () => {
    await db.mocks.clear();
  });

  it('stores the bundle and de-duplicates by mock_no on re-import', async () => {
    const bundle = loadRealBundle();
    const first = await addBundle(bundle);
    expect(first.added).toHaveLength(20);
    const second = await addBundle(bundle);
    expect(second.added).toHaveLength(0);
    expect(second.skipped).toHaveLength(20);
    expect(await db.mocks.count()).toBe(20);
  });

  it('adds only the new mocks from a partly overlapping file', async () => {
    const bundle = loadRealBundle();
    await addBundle({ ...bundle, mocks: bundle.mocks.slice(0, 2) });
    const r = await addBundle({ ...bundle, mocks: bundle.mocks.slice(1, 4) });
    expect(r.added).toEqual([3, 4]);
    expect(r.skipped).toEqual([2]);
  });

  it('does not store anything from a rejected file', async () => {
    await expect(importBundleText('{"mocks":[{"mock_no":1}]}')).rejects.toBeInstanceOf(ImportRejected);
    expect(await db.mocks.count()).toBe(0);
  });

  it('indexes every question and block in the bank', () => {
    const bank = buildBank(loadRealBundle().mocks);
    expect(bank.questions.size).toBe(1600);
    expect(bank.blocks.size).toBe(952);
    expect(bank.questions.get('M01-Q01')?.block.id).toBe('M01-R01');
  });
});
