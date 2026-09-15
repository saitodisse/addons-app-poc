import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, ClassAttributes } from 'react';

/**
 * Hash-based mini-router (`#/route`) with no external dependencies.
 *
 * Each page resolves one route from the URL fragment.
 */

export type Route = string;

function parseHash(): string {
  const h = window.location.hash;
  if (!h || h === '#') return '/';
  const w = h.startsWith('#') ? h.slice(1) : h;
  return w.startsWith('/') ? w : `/${w}`;
}

function normalizeRoute(route: string): string {
  if (!route) return '/';
  const seg = route.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  return `/${seg.join('/')}`;
}

/** Predefined host routes. */
export const ROUTES = {
  home: '/',
  settings: '/settings',
} as const;

const ADDON_ROUTE_PREFIX = '/addons/';
const SEARCH_RESULT_ROUTE_PREFIX = '/article/';

/**
 * Creates a stable add-on route from its canonical identity.
 * The manifest URL is encoded so it remains one route segment.
 */
export function addonRoute(manifestUrl: string): string {
  return `${ADDON_ROUTE_PREFIX}${encodeURIComponent(manifestUrl)}`;
}

/** Extracts the manifest URL from a valid add-on route. */
export function manifestUrlFromRoute(route: string): string | null {
  if (!route.startsWith(ADDON_ROUTE_PREFIX)) return null;

  const encodedManifestUrl = route.slice(ADDON_ROUTE_PREFIX.length);
  if (!encodedManifestUrl || encodedManifestUrl.includes('/')) return null;

  try {
    return decodeURIComponent(encodedManifestUrl);
  } catch {
    return null;
  }
}

/** Creates a dedicated result route without losing the add-on URL. */
export function resultRoute(contentUrl: string): string {
  return `${SEARCH_RESULT_ROUTE_PREFIX}${encodeURIComponent(contentUrl)}`;
}

/** Identifies article routes, including incomplete ones so the UI can show an error. */
export function isResultRoute(route: string): boolean {
  return route.startsWith(SEARCH_RESULT_ROUTE_PREFIX);
}

/** Extracts a valid HTTP URL from an article route. */
export function resultUrlFromRoute(route: string): string | null {
  if (!isResultRoute(route)) return null;

  const encodedContentUrl = route.slice(SEARCH_RESULT_ROUTE_PREFIX.length);
  if (!encodedContentUrl || encodedContentUrl.includes('/')) return null;

  try {
    const contentUrl = new URL(decodeURIComponent(encodedContentUrl));
    if (contentUrl.protocol !== 'http:' && contentUrl.protocol !== 'https:') return null;
    return contentUrl.href;
  } catch {
    return null;
  }
}

/** Observes the current hash and updates on fragment changes. */
export function useRoute(): string {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const listener = () => setRoute(parseHash());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  return route;
}

/** Navigates to a route by rewriting the URL fragment. */
export function navigate(route: string): void {
  window.location.hash = normalizeRoute(route);
}

/** Builds an href for a route (with #). */
export function href(route: string): string {
  return `#${normalizeRoute(route)}`;
}

interface LinkProps extends Omit<ClassAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
  style?: CSSProperties;
  onNavigate?: () => void;
}

/** Compatible <a href="#/route"> shortcut that avoids a react-router dependency. */
export function Link({ to, children, onNavigate, style, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // new tab
    onNavigate?.();
  };
  return (
    <a href={href(to)} onClick={handleClick} style={style} {...rest}>
      {children}
    </a>
  );
}
