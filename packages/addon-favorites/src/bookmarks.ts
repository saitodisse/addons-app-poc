export interface Bookmark {
  id: string;
  title: string;
  url?: string;
  createdAt: number;
}

export interface BookmarkStore {
  list(): Promise<Bookmark[]>;
  save(bookmark: Omit<Bookmark, 'id' | 'createdAt'> & Partial<Pick<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark>;
  remove(id: string): Promise<boolean>;
}
