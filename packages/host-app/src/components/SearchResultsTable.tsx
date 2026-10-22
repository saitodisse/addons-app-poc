import { useEffect, useRef } from 'react';
import { truncateDescription } from '../search';
import type { SearchProviderError, SearchResultRow } from '../search';
import { href, navigate, resultRoute } from '../router';

interface SearchResultsTableProps {
  query: string;
  artistFilter: string;
  /** True while the table lists the catalogues instead of a search term. */
  browsing?: boolean;
  results: SearchResultRow[];
  errors: SearchProviderError[];
  loading: boolean;
  providerCount: number;
  page: number;
  pageSize: number;
  pageSizes: readonly number[];
  keyboardActive?: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPageChange: (page: number) => void;
  onLastPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
  onClearSearch: () => void;
  onArtistSearch: (artist: string) => void;
  focusResultUrl?: string | null;
  onResultFocused?: () => void;
}
export function SearchResultsTable({ query, artistFilter, browsing = false, results, errors, loading, providerCount, page, pageSize, pageSizes, keyboardActive = false, canGoPrevious, canGoNext, onPageChange, onLastPage, onPreviousPage, onNextPage, onPageSizeChange, onClearSearch, onArtistSearch, focusResultUrl, onResultFocused }: SearchResultsTableProps) {
  const resultRowsRef = useRef(new Map<number, HTMLTableRowElement>());
  const pendingFocusRef = useRef<{ page: number; edge: 'first' | 'last'; sawLoading: boolean } | null>(null);
  const firstRowOnPageChangeRef = useRef<{ page: number; results: SearchResultRow[] } | null>(null);
  const proposedFields = results[0]?.displayFields;
  const displayFields = proposedFields?.length === 3 && results.every((result) => result.displayFields?.length === proposedFields.length
    && result.displayFields.every((field, index) => field.id === proposedFields[index]?.id && field.label === proposedFields[index]?.label))
    ? proposedFields.filter((field) => field.id !== 'album')
    : undefined;
  const hasVisualColumn = !displayFields && results.some((result) => result.emoji || result.image);
  const listsSomething = Boolean(query) || browsing;
  const emptyMessage = query
    ? providerCount === 0
      ? 'Enable an add-on that declares the search resource to populate this list.'
      : 'No results were found in active add-ons.'
    : providerCount === 0
      ? 'No active add-on publishes a catalogue yet.'
      : 'These add-ons publish no item.';

  useEffect(() => {
    const first = firstRowOnPageChangeRef.current;
    const firstRow = resultRowsRef.current.get(0);
    if (first && firstRow && !loading && page !== first.page && results !== first.results) {
      firstRow.focus();
      firstRowOnPageChangeRef.current = null;
    }
  }, [loading, page, results]);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || page !== pending.page) return;
    if (loading) {
      pending.sawLoading = true;
      return;
    }
    if (!pending.sawLoading) return;
    const index = pending.edge === 'first' ? 0 : results.length - 1;
    if (index >= 0) resultRowsRef.current.get(index)?.focus();
    pendingFocusRef.current = null;
  }, [loading, page, results.length]);

  useEffect(() => {
    if (!focusResultUrl || loading) return;
    const resultIndex = results.findIndex((result) => result.url === focusResultUrl);
    if (resultIndex < 0) return;
    const row = resultRowsRef.current.get(resultIndex);
    if (!row) return;
    row.focus();
    onResultFocused?.();
  }, [focusResultUrl, loading, onResultFocused, results]);

  useEffect(() => {
    if (!keyboardActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const searchField = target?.closest<HTMLInputElement>('#global-addon-search');

      if (event.key === 'Escape') {
        event.preventDefault();
        onClearSearch();
        window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#global-addon-search')?.focus());
        return;
      }

      if (event.key === 'Enter' && target?.closest('button, a')) return;

      const activeRowIndex = Number(target?.closest<HTMLTableRowElement>('[data-result-index]')?.dataset.resultIndex);
      if (event.key === 'Enter' && Number.isInteger(activeRowIndex) && activeRowIndex >= 0) {
        const result = results[activeRowIndex];
        if (result) {
          event.preventDefault();
          navigate(resultRoute(result.url));
        }
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
        event.preventDefault();
        if (loading) return;
        const staysOnPage = (['ArrowLeft', 'PageUp', 'Home'].includes(event.key) && page === 1)
          || (['ArrowRight', 'PageDown', 'End'].includes(event.key) && !canGoNext);
        if (staysOnPage) {
          firstRowOnPageChangeRef.current = null;
          resultRowsRef.current.get(0)?.focus();
          return;
        }
        pendingFocusRef.current = null;
        firstRowOnPageChangeRef.current = { page, results };
        if (event.key === 'End') { onLastPage(); return; }
        const destination = event.key === 'Home' ? 1
          : page + ({ ArrowLeft: -1, ArrowRight: 1, PageUp: -5, PageDown: 5 }[event.key] ?? 0);
        onPageChange(Math.max(1, destination));
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (loading) return;
      if (target?.closest('textarea, select, [contenteditable="true"]')) return;
      if (target?.closest('input') && !searchField) return;
      if (target?.closest('button')) return;

      event.preventDefault();
      const rows = [...resultRowsRef.current.entries()].sort(([left], [right]) => left - right).map(([, row]) => row);
      const activeIndex = Number.isInteger(activeRowIndex) && activeRowIndex >= 0 ? activeRowIndex : -1;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = activeIndex < 0 ? (direction > 0 ? 0 : rows.length - 1) : activeIndex + direction;

      if (nextIndex >= 0 && nextIndex < rows.length) {
        rows[nextIndex]?.focus();
        return;
      }

      if (direction > 0 && canGoNext) {
        pendingFocusRef.current = { page: page + 1, edge: 'first', sawLoading: false };
        onNextPage();
      } else if (direction < 0 && canGoPrevious) {
        pendingFocusRef.current = { page: page - 1, edge: 'last', sawLoading: false };
        onPreviousPage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrevious, keyboardActive, loading, onClearSearch, onPageChange, onLastPage, onNextPage, onPreviousPage, page, results]);

  const renderPagination = (ariaLabel: string, placement: 'top' | 'bottom') => {
    if (!listsSomething || (results.length === 0 && !canGoPrevious && !canGoNext)) return null;
    return (
      <nav aria-label={ariaLabel} style={{ display: 'flex', justifyContent: placement === 'bottom' ? 'flex-end' : undefined }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={loading || !canGoPrevious}
            aria-label="Previous page"
            style={{ padding: '6px 10px', border: '1px solid rgba(165,180,252,0.45)', borderRadius: 7, background: 'rgba(99,102,241,0.16)', color: '#c7d2fe', cursor: loading || !canGoPrevious ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 12, opacity: loading || !canGoPrevious ? 0.45 : 1 }}
          >
            Previous page
          </button>
          <span aria-current="page" style={{ minWidth: 74, color: '#e2e8f0', fontSize: 12, fontWeight: 650, textAlign: 'center' }}>
            {loading ? 'Loading…' : `Page ${page}`}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={loading || !canGoNext}
            aria-label="Next page"
            style={{ padding: '6px 10px', border: '1px solid rgba(165,180,252,0.45)', borderRadius: 7, background: 'rgba(99,102,241,0.16)', color: '#c7d2fe', cursor: loading || !canGoNext ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 12, opacity: loading || !canGoNext ? 0.45 : 1 }}
          >
            Next page
          </button>
        </div>
      </nav>
    );
  };

  return (
    <section aria-label="Search results" style={{
      marginBottom: 24,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 20 }}>{query ? 'Results' : 'Catalogue'}</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            {query
              ? artistFilter
                ? `Songs by “${artistFilter}”`
                : `Search for “${query}”`
              : browsing
                ? `Everything published by ${providerCount} active add-on${providerCount === 1 ? '' : 's'}, page by page. Type a query to search instead.`
                : 'Type a query to search every active add-on, or leave the field empty to list what they publish.'}
          </p>
          {listsSomething && <p className="host-search-keyboard-hint">Use ↑/↓ to move, ←/→ for previous/next page, Home/End for first/last page, Page Up/Page Down to jump 5 pages, Enter to open, and Esc to clear the search.</p>}
        </div>
        {listsSomething && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span role="status" style={{ color: loading ? '#fbbf24' : '#94a3b8', fontSize: 12 }}>
              {loading ? (query ? 'Searching…' : 'Loading…') : `${results.length} item(s) on page ${page}`}
            </span>
            <label className="host-search-page-size">
              <span>Items per page</span>
              <select aria-label="Items per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            {renderPagination('Results pagination', 'top')}
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <p role="status" style={{ margin: '0 0 12px', padding: '9px 11px', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, background: 'rgba(251,191,36,0.08)', color: '#fde68a', fontSize: 12 }}>
          {errors.length === 1 ? 'One add-on did not respond: ' : `${errors.length} add-ons did not respond: `}
          {errors.map((error) => `${error.addonName} (${error.message})`).join('; ')}
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, tableLayout: displayFields ? 'fixed' : 'auto', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: 13 }}>
          {displayFields && <colgroup>
            {displayFields.map((field, index) => <col key={field.id} style={index === 0 ? { width: 180 } : undefined} />)}
          </colgroup>}
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.14)', color: '#94a3b8', textAlign: 'left' }}>
              {displayFields ? displayFields.map((field) => (
                <th key={field.id} scope="col" style={{ padding: '9px 10px' }}>{field.label}</th>
              )) : <>
                {hasVisualColumn && <th scope="col" style={{ padding: '9px 10px', width: 44 }}> </th>}
                <th scope="col" style={{ padding: '9px 10px' }}>Type</th>
                <th scope="col" style={{ padding: '9px 10px' }}>ID</th>
                <th scope="col" style={{ padding: '9px 10px' }}>Name</th>
                <th scope="col" className="host-search-results-description" style={{ padding: '9px 10px', width: '50%', maxWidth: '50vw' }}>Description</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {results.map((result, resultIndex) => (
              <tr
                key={result.key}
                data-result-index={resultIndex}
                tabIndex={-1}
                aria-label={`Open ${result.name}`}
                aria-keyshortcuts="Enter"
                className="host-search-result-row"
                ref={(node) => { if (node) resultRowsRef.current.set(resultIndex, node); else resultRowsRef.current.delete(resultIndex); }}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top' }}
              >
                {displayFields ? displayFields.map((column) => {
                  const field = result.displayFields?.find((item) => item.id === column.id);
                  return (
                    <td key={column.id} style={{ padding: '11px 10px', overflowWrap: 'anywhere', color: '#f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {field?.image && <img src={field.image} alt="" width={48} height={48} loading="lazy" style={{ display: 'block', flex: '0 0 48px', borderRadius: '50%', objectFit: 'cover' }} />}
                        <div style={{ minWidth: 0 }}>
                          {field?.id === 'artist' && field.value && field.value !== 'Unknown artist'
                            ? <button
                              type="button"
                              className="host-search-artist-filter"
                              onClick={() => onArtistSearch(field.value)}
                              aria-label={`Show songs by ${field.value}`}
                              style={{ padding: 0, border: 0, background: 'transparent', color: '#93c5fd', cursor: 'pointer', font: 'inherit', fontWeight: 600, textAlign: 'left' }}
                            >{field.value}</button>
                            : field?.url
                            ? <a href={href(resultRoute(field.url))} aria-label={`Open ${field.value}`} style={{ color: '#93c5fd', fontWeight: 600, textDecoration: 'none' }}>{field.value}</a>
                            : <span style={{ fontWeight: 600 }}>{field?.value ?? '—'}</span>}
                          {field?.detail && <span style={{ display: 'block', marginTop: 3, color: '#94a3b8', fontSize: 11 }}>{field.detail}</span>}
                        </div>
                      </div>
                    </td>
                  );
                }) : hasVisualColumn && (
                  <td style={{ padding: '11px 10px' }}>
                    {result.image ? <img src={result.image} alt="" width={28} height={28} style={{ display: 'block', borderRadius: 6, objectFit: 'cover' }} /> : <span aria-hidden="true" style={{ fontSize: 20 }}>{result.emoji ?? '•'}</span>}
                  </td>
                )}
                {!displayFields && <>
                  <td style={{ padding: '11px 10px', whiteSpace: 'nowrap' }}><code style={{ color: '#c4b5fd' }}>{result.type}</code></td>
                  <td style={{ padding: '11px 10px', maxWidth: 180, overflowWrap: 'anywhere' }}><code style={{ color: '#e2e8f0' }}>{result.id}</code></td>
                  <td style={{ padding: '11px 10px', minWidth: 170, color: '#f1f5f9', fontWeight: 600 }}>
                    <a
                      href={href(resultRoute(result.url))}
                      aria-label={`Open ${result.name}`}
                      style={{ color: '#93c5fd', textDecoration: 'none' }}
                    >
                      {result.name}
                    </a>
                    <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: 400 }}>{result.sourceAddonName}</span>
                  </td>
                  <td className="host-search-results-description" style={{ padding: '11px 10px', width: '50%', maxWidth: '50vw', color: '#cbd5e1', lineHeight: 1.45 }}>{truncateDescription(result.description)}</td>
                </>}
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={displayFields?.length ?? (hasVisualColumn ? 5 : 4)} style={{ padding: '28px 10px', color: '#64748b', textAlign: 'center' }}>
                  {loading ? 'Querying active add-ons…' : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {renderPagination('Results pagination at the end of the list', 'bottom')}
    </section>
  );
}
