import { useCallback, useEffect } from 'react';
import type { AddonInstance } from '@addons-poc/protocol';
import { headersToObject, logBrowserDebugPayload, logBrowserHttpExchange } from '../http-observability';

function trafficEndpoint(addon: AddonInstance): string | null {
  const route = addon.manifest.contract.http.find((entry) => entry.id === 'debug-traffic' && entry.direction === 'incoming' && entry.method === 'GET');
  if (!route || route.path.includes('{')) return null;
  try {
    return new URL(route.path, addon.manifestUrl).href;
  } catch {
    return null;
  }
}

function errorDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
}

export function HttpTrafficPanel({ addon }: { addon: AddonInstance }) {
  const url = trafficEndpoint(addon);

  const refresh = useCallback(async () => {
    if (!url) return;
    const startedAt = Date.now();
    const request = { method: 'GET', url, headers: { Accept: 'application/json' }, body: null };
    let response: Response | undefined;
    let exchangeLogged = false;
    try {
      response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const bodyText = await response.text();
      let body: unknown = bodyText;
      try {
        body = JSON.parse(bodyText);
      } catch {
        // O corpo bruto ainda precisa aparecer no console quando o debug falhar.
      }
      const responseHeaders = headersToObject(response.headers);
      const durationMs = Date.now() - startedAt;
      logBrowserHttpExchange({
        source: 'host-http-traffic-panel',
        method: 'GET',
        url,
        request,
        response: { status: response.status, ok: response.ok, headers: responseHeaders, body, bodyText },
        durationMs,
      });
      logBrowserDebugPayload({
        url,
        status: response.status,
        ok: response.ok,
        headers: responseHeaders,
        body,
        bodyText,
        durationMs,
      });
      exchangeLogged = true;
      if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar o histórico`);
    } catch (refreshError) {
      if (!exchangeLogged) {
        logBrowserHttpExchange({
          source: 'host-http-traffic-panel',
          method: 'GET',
          url,
          request,
          ...(response ? { response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers) } } : {}),
          durationMs: Date.now() - startedAt,
          error: errorDetails(refreshError),
        });
      }
    }
  }, [url]);

  useEffect(() => {
    if (!url) return undefined;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1500);
    return () => window.clearInterval(timer);
  }, [refresh, url]);

  if (!url) return null;

  return (
    <section className="host-http-traffic" aria-label={`Tráfego HTTP de ${addon.manifest.name}`}>
      <a className="host-http-traffic-link" href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    </section>
  );
}
