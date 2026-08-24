import type { Bookmark, BookmarkStore } from '../domain/bookmarks';

/**
 * Implementación en memoria de BookmarkStore (pure, sin I/O).
 * Útil para pruebas y como fallback cuando no hay localStorage (entorno Node).
 */
export class MemoryBookmarkStore implements BookmarkStore {
  private items = new Map<string, Bookmark>();
  private counter = 1;

  async list(): Promise<Bookmark[]> {
    return [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async save(bookmark: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark> {
    const now = Date.now();
    const id = bookmark.id ?? String(this.counter++);
    const created: Bookmark = {
      id,
      title: bookmark.title,
      url: bookmark.url,
      createdAt: bookmark.createdAt ?? now,
    };
    this.items.set(id, created);
    return created;
  }

  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
