import { truncateDescription } from '../search';
import type { SearchProviderError, SearchResultRow } from '../search';
import { href, rotaDoResultado } from '../router';

interface SearchResultsTableProps {
  query: string;
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
export function SearchResultsTable({ query, results, errors, loading, providerCount, page, canGoPrevious, canGoNext, onPreviousPage, onNextPage }: SearchResultsTableProps) {
  const hasVisualColumn = results.some((result) => result.emoji || result.image);
  const emptyMessage = query
    ? providerCount === 0
      ? 'Ative um add-on que declare o recurso de busca para preencher esta listagem.'
      : 'Nenhum resultado foi encontrado nos add-ons ativos.'
    : 'Os resultados da sua pesquisa aparecerão aqui.';
  const renderPagination = (ariaLabel: string, placement: 'top' | 'bottom') => {
    if (!query || results.length === 0) return null;
    return (
      <nav aria-label={ariaLabel} style={{ display: 'flex', justifyContent: placement === 'bottom' ? 'flex-end' : undefined }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={loading || !canGoPrevious}
            aria-label="Página anterior"
            style={{ padding: '6px 10px', border: '1px solid rgba(165,180,252,0.45)', borderRadius: 7, background: 'rgba(99,102,241,0.16)', color: '#c7d2fe', cursor: loading || !canGoPrevious ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 12, opacity: loading || !canGoPrevious ? 0.45 : 1 }}
          >
            Página anterior
          </button>
          <span aria-current="page" style={{ minWidth: 74, color: '#e2e8f0', fontSize: 12, fontWeight: 650, textAlign: 'center' }}>
            {loading ? 'Carregando…' : `Página ${page}`}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={loading || !canGoNext}
            aria-label="Próxima página"
            style={{ padding: '6px 10px', border: '1px solid rgba(165,180,252,0.45)', borderRadius: 7, background: 'rgba(99,102,241,0.16)', color: '#c7d2fe', cursor: loading || !canGoNext ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 12, opacity: loading || !canGoNext ? 0.45 : 1 }}
          >
            Próxima página
          </button>
        </div>
      </nav>
    );
  };

  return (
    <section aria-label="Resultados da pesquisa" style={{
      marginBottom: 24,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 20 }}>Resultados</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            {query ? `Busca por “${query}”` : 'A listagem principal dos add-ons ativos.'}
          </p>
        </div>
        {query && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span role="status" style={{ color: loading ? '#fbbf24' : '#94a3b8', fontSize: 12 }}>{loading ? 'Pesquisando…' : `${results.length} resultado(s)`}</span>
            {renderPagination('Paginação dos resultados', 'top')}
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <p role="status" style={{ margin: '0 0 12px', padding: '9px 11px', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, background: 'rgba(251,191,36,0.08)', color: '#fde68a', fontSize: 12 }}>
          {errors.length === 1 ? 'Um add-on não respondeu: ' : `${errors.length} add-ons não responderam: `}
          {errors.map((error) => `${error.addonName} (${error.message})`).join('; ')}
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', color: '#cbd5e1', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.14)', color: '#94a3b8', textAlign: 'left' }}>
              {hasVisualColumn && <th scope="col" style={{ padding: '9px 10px', width: 44 }}> </th>}
              <th scope="col" style={{ padding: '9px 10px' }}>Tipo</th>
              <th scope="col" style={{ padding: '9px 10px' }}>ID</th>
              <th scope="col" style={{ padding: '9px 10px' }}>Nome</th>
              <th scope="col" className="host-search-results-description" style={{ padding: '9px 10px', width: '50%', maxWidth: '50vw' }}>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top' }}>
                {hasVisualColumn && (
                  <td style={{ padding: '11px 10px' }}>
                    {result.image ? <img src={result.image} alt="" width={28} height={28} style={{ display: 'block', borderRadius: 6, objectFit: 'cover' }} /> : <span aria-hidden="true" style={{ fontSize: 20 }}>{result.emoji ?? '•'}</span>}
                  </td>
                )}
                <td style={{ padding: '11px 10px', whiteSpace: 'nowrap' }}><code style={{ color: '#c4b5fd' }}>{result.type}</code></td>
                <td style={{ padding: '11px 10px', maxWidth: 180, overflowWrap: 'anywhere' }}><code style={{ color: '#e2e8f0' }}>{result.id}</code></td>
                <td style={{ padding: '11px 10px', minWidth: 170, color: '#f1f5f9', fontWeight: 600 }}>
                  <a
                    href={href(rotaDoResultado(result.url))}
                    aria-label={`Abrir ${result.name}`}
                    style={{ color: '#93c5fd', textDecoration: 'none' }}
                  >
                    {result.name}
                  </a>
                  <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: 400 }}>{result.sourceAddonName}</span>
                </td>
                <td className="host-search-results-description" style={{ padding: '11px 10px', width: '50%', maxWidth: '50vw', color: '#cbd5e1', lineHeight: 1.45 }}>{truncateDescription(result.description)}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={hasVisualColumn ? 5 : 4} style={{ padding: '28px 10px', color: '#64748b', textAlign: 'center' }}>
                  {loading ? 'Consultando os add-ons ativos…' : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {renderPagination('Paginação dos resultados no fim da lista', 'bottom')}
    </section>
  );
}
