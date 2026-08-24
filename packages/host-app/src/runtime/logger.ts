interface LoggerPort { log(level: 'info' | 'warn' | 'error', message: string): void; }

export class ConsoleLogger implements LoggerPort {
  log(level: 'info' | 'warn' | 'error', message: string): void {
    console[level](message);
  }
}
