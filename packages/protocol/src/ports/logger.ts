export interface LoggerPort {
  log(level: 'info' | 'warn' | 'error', message: string): void;
}