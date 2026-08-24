/**
 * Favoritos/lectura: dominio puro del servicio `bookmarks`.
 *
 * Definido como en Fase 2 — interfaces tipadas que los add-ons implementan
 * explícitamente con `withFallback` cuando hay varias implementaciones.
 */

/** Un marcador guardado por el servicio de favoritos. */
export interface Bookmark {
  id: string;
  title: string;
  /** Origen opcional (URL del contenido leído). */
  url?: string;
  /** Marca de tiempo de creación (ms). */
  createdAt: number;
}

/** Puerto de almacenamiento persistente de marcadores. */
export interface BookmarkStore {
  /** Devuelve todos los marcadores (orden de más reciente a más antiguo). */
  list(): Promise<Bookmark[]>;
  /** Guarda un marcador; asigna id y createdAt si faltan. */
  save(bookmark: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark>;
  /** Elimina un marcador por id; devuelve true si existía. */
  remove(id: string): Promise<boolean>;
}

/** Contrato del servicio `favorites` que registra `addon-favorites`. */
export interface FavoritesService {
  list(): Promise<Bookmark[]>;
  add(title: string, url?: string): Promise<Bookmark>;
  remove(id: string): Promise<boolean>;
}
