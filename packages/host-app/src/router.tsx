import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, ClassAttributes } from 'react';

/**
 * Mini-router baseado em hash (`#/rota`) — sem dependências externas.
 *
 * Cada página/add-on resolve a uma única ruta a partir do fragmento da URL,
 * o que permite que cada concepto (gestão, greeter, counter, fallback, textos,
 * inspector, extras) tenha uma URL própria em vez de se misturar em pestañas.
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
  gestao: '/gestion',
  greeter: '/greeter',
  counter: '/counter',
  fallback: '/fallback',
  textos: '/textos',
  inspector: '/inspector',
  extras: '/extras',
} as const;

/** Observa o hash actual; atualiza em mudanças de fragmento. */
export function useRuta(): string {
  const [ruta, setRuta] = useState(parseHash);
  useEffect(() => {
    const listener = () => setRuta(parseHash());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  return ruta;
}

/** Navega a uma ruta dada (reescribe o fragmento da URL). */
export function navegar(ruta: string): void {
  window.location.hash = normalizeRuta(ruta);
}

/** Construe um href para uma ruta (com #). */
export function href(ruta: string): string {
  return `#${normalizeRuta(ruta)}`;
}

interface LinkProps extends Omit<ClassAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
  style?: CSSProperties;
  onNavigate?: () => void;
}

/** Atajo de <a href="#/rota"> compatível, para não depender de react-router. */
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