import { afterEach, describe, expect, it, vi } from 'vitest';
import { logBrowserDebugPayload } from './http-observability';

describe('logBrowserDebugPayload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('imprime o payload parseado e o corpo bruto recebido pelo host', () => {
    const groupCollapsed = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    const body = { addon: 'text-wikipedia', entries: [{ sequence: 1 }] };
    const bodyText = JSON.stringify(body);

    logBrowserDebugPayload({
      url: 'http://localhost:5294/debug/traffic.json',
      status: 200,
      ok: true,
      headers: { 'content-type': 'application/json' },
      body,
      bodyText,
      durationMs: 12,
    });

    expect(groupCollapsed).toHaveBeenCalledWith('[addons-poc][DEBUG] GET http://localhost:5294/debug/traffic.json');
    expect(log).toHaveBeenCalledWith('Debug recebido pelo host', body);
    expect(log).toHaveBeenCalledWith('Corpo bruto do debug', bodyText);
    expect(log).toHaveBeenCalledWith('Resposta HTTP do debug', {
      status: 200,
      ok: true,
      headers: { 'content-type': 'application/json' },
      durationMs: 12,
    });
    expect(groupEnd).toHaveBeenCalledOnce();
  });
});
