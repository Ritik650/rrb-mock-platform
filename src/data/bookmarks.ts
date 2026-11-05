import { db } from './db';

export async function loadBookmarks(): Promise<Set<string>> {
  return new Set(await db.bookmarks.toCollection().primaryKeys());
}

/** Returns whether the question is bookmarked afterwards. */
export async function toggleBookmark(qid: string): Promise<boolean> {
  return db.transaction('rw', db.bookmarks, async () => {
    if (await db.bookmarks.get(qid)) {
      await db.bookmarks.delete(qid);
      return false;
    }
    await db.bookmarks.put({ qid, createdAt: Date.now() });
    return true;
  });
}
