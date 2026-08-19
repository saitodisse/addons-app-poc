import type { Bookmark, BookmarkStore } from '../domain/bookmarks';
import { MemoryBookmarkStore } from './memory-bookmark-store';

/**
 * Adaptador que persiste en localStorage del navegador.
 *
 * La referencia a `window.localStorage` se lee de forma perezosa y protegida,
 * de modo que el adaptador degrada a memoria en entornos sin navegador (Node,
 * tests) sin romper — el mismo espíritu de la degradación del registry.
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

  /** Vuelca el contenido guardado en localStorage a la memoria de trabajo. */
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
      // payload corrupto: se ignora y se empieza con memoria limpia
    }
  }

  private async persist(): Promise<void> {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(await this.memory.list()));
    } catch {
      // localStorage lleno o bloqueado: la sesión sigue en memoria
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