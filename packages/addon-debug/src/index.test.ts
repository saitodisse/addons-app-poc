import { describe, expect, it, vi } from 'vitest';
import { createDebugLog } from './index';

describe('Debug Add-on', () => {
  it('mantém eventos recentes e notifica inscritos', () => {
    const log = createDebugLog(2);
    const listener = vi.fn();
    log.subscribe(listener);

    log.record({ addonId: 'hello', level: 'info', message: 'Executou', timestamp: 1 });
    log.record({ addonId: 'counter', level: 'warn', message: 'Atenção', timestamp: 2 });
    log.record({ addonId: 'health', level: 'error', message: 'Falhou', timestamp: 3 });

    expect(log.list().map((entry) => entry.addonId)).toEqual(['health', 'counter']);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
