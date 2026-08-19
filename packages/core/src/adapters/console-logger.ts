import type { LoggerPort } from '../ports/logger';

export class ConsoleLogger implements LoggerPort {
  log(level: 'info' | 'warn' | 'error', message: string): void {
    const prefix = level === 'info' ? 'ℹ️' : level === 'warn' ? '⚠️' : '❌';
    console[level](`${prefix} ${message}`);
  }
}