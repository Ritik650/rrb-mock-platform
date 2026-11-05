import Dexie, { type Table } from 'dexie';
import type { Attempt, Bookmark, Mock, ResponseRow, VisitRow } from '../types';

export interface SettingRow {
  key: string;
  value: unknown;
}

class AppDB extends Dexie {
  mocks!: Table<Mock, number>;
  attempts!: Table<Attempt, string>;
  responses!: Table<ResponseRow, [string, string]>;
  visits!: Table<VisitRow, [string, number]>;
  bookmarks!: Table<Bookmark, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('rrb-po-mocks');
    this.version(1).stores({
      mocks: 'mock_no',
      attempts: 'id, mockNo, kind, status, startedAt',
      responses: '[attemptId+qid], attemptId, qid',
      visits: '[attemptId+seq], attemptId',
      bookmarks: 'qid, createdAt',
      settings: 'key',
    });
  }
}

export const db = new AppDB();
