import type { Bookmark, BookmarkStore } from './bookmarks';

export class MemoryBookmarkStore implements BookmarkStore {
  private items: Bookmark[] = [];
  private nextId = 1;
  async list(): Promise<Bookmark[]> { return [...this.items].sort((a, b) => b.createdAt - a.createdAt); }
  async save(input: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark> {
    const bookmark = { id: input.id ?? String(this.nextId++), createdAt: input.createdAt ?? Date.now(), title: input.title, url: input.url };
    this.items = [bookmark, ...this.items.filter((item) => item.id !== bookmark.id)];
    return bookmark;
  }
  async remove(id: string): Promise<boolean> { const before = this.items.length; this.items = this.items.filter((item) => item.id !== id); return this.items.length !== before; }
}
