export type AddonLogLevel = 'info' | 'warn' | 'error';

/** Evento estruturado que uma extensão pode enviar para a extensão de debug. */
export interface DebugEntry {
  addonId: string;
  level: AddonLogLevel;
  message: string;
  details?: unknown;
  timestamp: number;
}

/** Serviço opcional de observabilidade em tempo de execução. */
export interface DebugLog {
  record(entry: DebugEntry): void;
  list(): DebugEntry[];
  clear(): void;
  subscribe(listener: () => void): () => void;
}
