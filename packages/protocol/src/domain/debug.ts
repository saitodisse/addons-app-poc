export type AddonLogLevel = 'info' | 'warn' | 'error';

/** Structured event an add-on can send to the debug add-on. */
export interface DebugEntry {
  addonId: string;
  level: AddonLogLevel;
  message: string;
  details?: unknown;
  timestamp: number;
}

/** Optional runtime observability service. */
export interface DebugLog {
  record(entry: DebugEntry): void;
  list(): DebugEntry[];
  clear(): void;
  subscribe(listener: () => void): () => void;
}
