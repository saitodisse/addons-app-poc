import type { LoggerPort } from '../ports/logger';

export class SilentLogger implements LoggerPort {
  log(_level: 'info' | 'warn' | 'error', _message: string): void {
    // no-op: used in tests to avoid polluting stdout/stderr
  }
}
