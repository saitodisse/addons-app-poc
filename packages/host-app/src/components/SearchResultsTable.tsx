import { truncateDescription } from '../search';
import type { SearchProviderError, SearchResultRow } from '../search';
import { href, resultRoute } from '../router';

interface SearchResultsTableProps {
  query: string;
  /** True while the table lists the catalogues instead of a search term. */
  browsing?: boolean;
  results: SearchResultRow[];
  errors: SearchProviderError[];
  loading: boolean;
  providerCount: number;
  page: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}
export function SearchResultsTable({ query, browsing = false, results, errors, loading, providerCount, page, canGoPrevious, canGoNext, onPreviousPage, onNextPage }: SearchResultsTableProps) {
  const proposedFields = results[0]?.displayFields;
  const displayFields = proposedFields?.length === 3 && results.every((result) => result.displayFields?.length === proposedFields.length
    && result.displayFields.every((field, index) => field.id === proposedFields[index]?.id && field.label === proposedFields[index]?.label))
    ? proposedFields
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
  const renderPagination = (ariaLabel: string, placement: 'top' | 'bottom') => {
    if (!listsSomething || results.length === 0) return null;
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
              ? `Search for “${query}”`
              : browsing
                ? `Everything published by ${providerCount} active add-on${providerCount === 1 ? '' : 's'}, page by page. Type a query to search instead.`
                : 'Type a query to search every active add-on, or leave the field empty to list what they publish.'}
          </p>
        </div>
        {listsSomething && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span role="status" style={{ color: loading ? '#fbbf24' : '#94a3b8', fontSize: 12 }}>
              {loading ? (query ? 'Searching…' : 'Loading…') : `${results.length} item(s) on page ${page}`}
            </span>
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
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', color: '#cbd5e1', fontSize: 13 }}>
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
            {results.map((result) => (
              <tr key={result.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top' }}>
                {displayFields ? displayFields.map((column) => {
                  const field = result.displayFields?.find((item) => item.id === column.id);
                  return (
                    <td key={column.id} style={{ padding: '11px 10px', minWidth: column.id === displayFields[0]?.id ? 180 : 170, color: '#f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {field?.image && <img src={field.image} alt="" width={48} height={48} loading="lazy" style={{ display: 'block', flex: '0 0 48px', borderRadius: '50%', objectFit: 'cover' }} />}
                        <div style={{ minWidth: 0 }}>
                          {field?.url
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
