import type { SearchProviderError, SearchResultRow } from '../search';

interface SearchResultsTableProps {
  query: string;
  results: SearchResultRow[];
  errors: SearchProviderError[];
  loading: boolean;
  providerCount: number;
}
export function SearchResultsTable({ query, results, errors, loading, providerCount }: SearchResultsTableProps) {
  const hasVisualColumn = results.some((result) => result.emoji || result.image);
  const emptyMessage = query
    ? providerCount === 0
      ? 'Ative um add-on que declare o recurso de busca para preencher esta listagem.'
      : 'Nenhum resultado foi encontrado nos add-ons ativos.'
    : 'Os resultados da sua pesquisa aparecerão aqui.';

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
        {query && <span role="status" style={{ color: loading ? '#fbbf24' : '#94a3b8', fontSize: 12 }}>{loading ? 'Pesquisando…' : `${results.length} resultado(s)`}</span>}
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
              <th scope="col" style={{ padding: '9px 10px' }}>URL</th>
              <th scope="col" style={{ padding: '9px 10px' }}>Nome</th>
              <th scope="col" style={{ padding: '9px 10px' }}>Descrição</th>
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
                <td style={{ padding: '11px 10px', maxWidth: 260, overflowWrap: 'anywhere' }}><a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{result.url}</a></td>
                <td style={{ padding: '11px 10px', minWidth: 170, color: '#f1f5f9', fontWeight: 600 }}>
                  {result.name}
                  <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: 400 }}>{result.sourceAddonName}</span>
                </td>
                <td style={{ padding: '11px 10px', minWidth: 190, color: '#cbd5e1', lineHeight: 1.45 }}>{result.description}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={hasVisualColumn ? 6 : 5} style={{ padding: '28px 10px', color: '#64748b', textAlign: 'center' }}>
                  {loading ? 'Consultando os add-ons ativos…' : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
