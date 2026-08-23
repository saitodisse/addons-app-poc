import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, ClassAttributes } from 'react';

/**
 * Mini-router baseado em hash (`#/rota`) — sem dependências externas.
 *
 * Cada página resolve uma única rota a partir do fragmento da URL.
 */

export type Ruta = string;

function parseHash(): string {
  const h = window.location.hash;
  if (!h || h === '#') return '/';
  const w = h.startsWith('#') ? h.slice(1) : h;
  return w.startsWith('/') ? w : `/${w}`;
}

function normalizeRuta(r: string): string {
  if (!r) return '/';
  const seg = r.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  return `/${seg.join('/')}`;
}

/** Rotas predefinidas do host. */
export const RUTAS = {
  inicio: '/',
  settings: '/settings',
} as const;

const ADDON_ROUTE_PREFIX = '/addons/';

/**
 * Cria uma rota estável para uma extensão a partir da sua identidade canônica.
 * A URL do manifesto é codificada para continuar sendo um único segmento da rota.
 */
export function rotaDoAddon(manifestUrl: string): string {
  return `${ADDON_ROUTE_PREFIX}${encodeURIComponent(manifestUrl)}`;
}

/** Extrai a URL do manifesto de uma rota de extensão válida. */
export function manifestUrlDaRota(ruta: string): string | null {
  if (!ruta.startsWith(ADDON_ROUTE_PREFIX)) return null;

  const encodedManifestUrl = ruta.slice(ADDON_ROUTE_PREFIX.length);
  if (!encodedManifestUrl || encodedManifestUrl.includes('/')) return null;

  try {
    return decodeURIComponent(encodedManifestUrl);
  } catch {
    return null;
  }
}

/** Observa o hash atual; atualiza em mudanças de fragmento. */
export function useRuta(): string {
  const [ruta, setRuta] = useState(parseHash);
  useEffect(() => {
    const listener = () => setRuta(parseHash());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  return ruta;
}

/** Navega a uma rota dada (reescreve o fragmento da URL). */
export function navegar(ruta: string): void {
  window.location.hash = normalizeRuta(ruta);
}

/** Constrói um href para uma rota (com #). */
export function href(ruta: string): string {
  return `#${normalizeRuta(ruta)}`;
}

interface LinkProps extends Omit<ClassAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
  style?: CSSProperties;
  onNavigate?: () => void;
}

/** Atalho de <a href="#/rota"> compatível, para não depender de react-router. */
export function Link({ to, children, onNavigate, style, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // nova pestaña
    onNavigate?.();
  };
  return (
    <a href={href(to)} onClick={handleClick} style={style} {...rest}>
      {children}
    </a>
  );
}
