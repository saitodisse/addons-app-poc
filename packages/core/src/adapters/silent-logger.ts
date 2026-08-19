import type { LoggerPort } from '../ports/logger';

export class SilentLogger implements LoggerPort {
  log(_level: 'info' | 'warn' | 'error', _message: string): void {
    // no-op — usado em testes para não poluir stdout/stderr
  }
}