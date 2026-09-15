/**
 * Favorites/reading: pure domain for the `bookmarks` service.
 *
 * Defined as in Phase 2: typed interfaces that add-ons explicitly implement
 * with `withFallback` when there are multiple implementations.
 */

/** A bookmark saved by the favorites service. */
export interface Bookmark {
  id: string;
  title: string;
  /** Optional source (URL of the content read). */
  url?: string;
  /** Creation timestamp (ms). */
  createdAt: number;
}

/** Persistent bookmark storage port. */
export interface BookmarkStore {
  /** Returns all bookmarks, newest first. */
  list(): Promise<Bookmark[]>;
  /** Saves a bookmark; assigns id and createdAt when absent. */
  save(bookmark: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark>;
  /** Removes a bookmark by ID; returns true if it existed. */
  remove(id: string): Promise<boolean>;
}

/** Contract for the `favorites` service registered by `addon-favorites`. */
export interface FavoritesService {
  list(): Promise<Bookmark[]>;
  add(title: string, url?: string): Promise<Bookmark>;
  remove(id: string): Promise<boolean>;
}
