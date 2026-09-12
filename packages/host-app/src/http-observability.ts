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
 * Mantém a troca HTTP expandível no DevTools, com request e response
 * separados para que o corpo completo não fique escondido em uma string.
 */
export function logBrowserHttpExchange(exchange: BrowserHttpExchange): void {
  const label = `[addons-poc][HTTP] ${exchange.method} ${exchange.url}`;
  const browserConsole = globalThis.console;
  browserConsole.groupCollapsed?.(label);
  browserConsole.log('Request enviado pela página', exchange.request);
  if (exchange.response !== undefined) browserConsole.log('Response recebido pela página', exchange.response);
  if (exchange.error !== undefined) browserConsole.error('Erro na troca HTTP', exchange.error);
  browserConsole.log('Troca completa', exchange);
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
  browserConsole.log('Debug recebido pelo host', body);
  browserConsole.log('Corpo bruto do debug', bodyText);
  browserConsole.log('Resposta HTTP do debug', { status, ok, headers, durationMs });
  browserConsole.groupEnd?.();
}
