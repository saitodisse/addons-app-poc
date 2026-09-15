interface BrowserHttpExchange {
  source: string;
  method: string;
  url: string;
  request: unknown;
  response?: unknown;
  durationMs: number;
  error?: unknown;
}

export function headersToObject(headers: Headers | undefined): Record<string, string> {
  if (!headers) return {};
  const result: Record<string, string> = {};
  headers.forEach((value, name) => { result[name] = value; });
  return result;
}

/**
 * Keeps the HTTP exchange expandable in DevTools, with separate request and
 * response objects so the complete body is not hidden in a string.
 */
export function logBrowserHttpExchange(exchange: BrowserHttpExchange): void {
  const label = `[addons-poc][HTTP] ${exchange.method} ${exchange.url}`;
  const browserConsole = globalThis.console;
  browserConsole.groupCollapsed?.(label);
  browserConsole.log('Request sent by the page', exchange.request);
  if (exchange.response !== undefined) browserConsole.log('Response received by the page', exchange.response);
  if (exchange.error !== undefined) browserConsole.error('HTTP exchange error', exchange.error);
  browserConsole.log('Complete exchange', exchange);
  browserConsole.groupEnd?.();
}

export function logBrowserDebugPayload({
  url,
  status,
  ok,
  headers,
  body,
  bodyText,
  durationMs,
}: {
  url: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  bodyText: string;
  durationMs: number;
}): void {
  const browserConsole = globalThis.console;
  browserConsole.groupCollapsed?.(`[addons-poc][DEBUG] GET ${url}`);
  browserConsole.log('Debug received by the host', body);
  browserConsole.log('Raw debug body', bodyText);
  browserConsole.log('Debug HTTP response', { status, ok, headers, durationMs });
  browserConsole.groupEnd?.();
}
