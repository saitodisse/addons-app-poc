import type { Bookmark, BookmarkStore } from '../domain/bookmarks';
import { MemoryBookmarkStore } from './memory-bookmark-store';

/**
 * Adapter that persists in the browser's localStorage.
 *
 * The `window.localStorage` reference is read lazily and safely, so the adapter
 * falls back to memory in browserless environments (Node and tests) without
 * breaking, following the same spirit as registry degradation.
 */
export class LocalStorageBookmarkStore implements BookmarkStore {
  private readonly key: string;
  private memory = new MemoryBookmarkStore();
  private storage: Storage | null = null;

  constructor(key = 'addons:bookmarks') {
    this.key = key;
    this.storage = typeof window !== 'undefined' ? window.localStorage : null;
    this.migrate();
  }

  /** Loads content saved in localStorage into working memory. */
  private migrate(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return;
      const items = JSON.parse(raw) as Bookmark[];
      for (const item of items) {
        void this.memory.save({ id: item.id, title: item.title, url: item.url, createdAt: item.createdAt });
      }
    } catch {
      // Corrupt payload: ignore it and start with clean memory.
    }
  }

  private async persist(): Promise<void> {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(await this.memory.list()));
    } catch {
      // Full or blocked localStorage: the session continues in memory.
    }
  }

  list(): Promise<Bookmark[]> {
    return this.memory.list();
  }

  save(
    bookmark: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>,
  ): Promise<Bookmark> {
    const saved = this.memory.save(bookmark);
    void this.persist();
    return saved;
  }

  async remove(id: string): Promise<boolean> {
    const removed = await this.memory.remove(id);
    if (removed) await this.persist();
    return removed;
  }
}
