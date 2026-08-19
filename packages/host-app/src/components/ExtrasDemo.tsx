import { useCallback, useState } from 'react';

interface Bookmark {
  id: string;
  title: string;
  url?: string;
  createdAt: number;
}

interface ExtrasDemoProps {
  formatter?: {
    format: (s: { title: string; content: string }) => { title: string; markdown: string; html: string };
  };
  searchProvider?: {
    search: (q: string, limit?: number) => Promise<{ title: string; snippet?: string }[]>;
  };
  favorites?: {
    list: () => Promise<Bookmark[]>;
    add: (title: string, url?: string) => Promise<Bookmark>;
    remove: (id: string) => Promise<boolean>;
  };
  healthCheck?: {
    checkAll: () => Promise<{ baseUrl: string; ok: boolean; latencyMs: number | null; error?: string }[]>;
  };
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  color: '#fff',
};

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

/**
 * Extras: demonstra os novos add-ons em processo que compõem serviços:
 * - addon-markdown  → serviço 'textFormatter' (Markdown/HTML)
 * - addon-aggregator → serviço 'searchProvider' (meta-search tolerante a falhas)
 * - addon-favorites  → serviço 'favorites' (persistência via BookmarkStore)
 */
export function ExtrasDemo({ formatter, searchProvider, favorites, healthCheck }: ExtrasDemoProps) {
  // Markdown
  const [mdTitle, setMdTitle] = useState('Meu Texto');
  const [mdBody, setMdBody] = useState('Um parágrafo qualquer.\n\n- item 1\n- item 2');
  const [mdOut, setMdOut] = useState<{ markdown: string; html: string } | null>(null);

  // Busca agregada
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ title: string; snippet?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Favoritos
  const [favTitle, setFavTitle] = useState('');
  const [favUrl, setFavUrl] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [favMsg, setFavMsg] = useState<string | null>(null);

  // Health check
  const [health, setHealth] = useState<{ baseUrl: string; ok: boolean; latencyMs: number | null; error?: string }[]>([]);
  const [checking, setChecking] = useState(false);

  const runHealth = async () => {
    if (!healthCheck) return;
    setChecking(true);
    try {
      setHealth(await healthCheck.checkAll());
    } catch {
      setHealth([]);
    } finally {
      setChecking(false);
    }
  };

  const refreshBookmarks = useCallback(async () => {
    if (!favorites) return;
    try {
      setBookmarks(await favorites.list());
    } catch (error) {
      setFavMsg('Erro ao listar favoritos: ' + (error as Error).message);
    }
  }, [favorites]);

  const handleFormat = () => {
    if (!formatter) return;
    const out = formatter.format({ title: mdTitle, content: mdBody });
    setMdOut({ markdown: out.markdown, html: out.html });
  };

  const handleSearch = async () => {
    if (!searchProvider || !query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchProvider.search(query.trim(), 20));
    } catch (error) {
      setSearchError((error as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!favorites || !favTitle.trim()) return;
    try {
      await favorites.add(favTitle.trim(), favUrl.trim() || undefined);
      setFavTitle('');
      setFavUrl('');
      setFavMsg(null);
      await refreshBookmarks();
    } catch (error) {
      setFavMsg('Erro ao adicionar: ' + (error as Error).message);
    }
  };

  const handleRemove = async (id: string) => {
    if (!favorites) return;
    await favorites.remove(id);
    await refreshBookmarks();
  };

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Os add-ons em processo também podem <strong>compor serviços</strong>: o markdown formata
        textos, o aggregator busca em vários servidores remotos com tolerância a falhas e o
        favorites persiste marcadores consumindo um <code>bookmarkStore</code> fornecido pelo host.
      </p>

      {/* Markdown */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>
          📝 Formatador Markdown <span style={{ color: '#64748b', fontWeight: 400 }}>(serviço textFormatter)</span>
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={mdTitle}
            onChange={(e) => setMdTitle(e.target.value)}
            placeholder="Título"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleFormat} style={buttonStyle} disabled={!formatter}>
            Formatar
          </button>
        </div>
        <textarea
          value={mdBody}
          onChange={(e) => setMdBody(e.target.value)}
          placeholder="Conteúdo em texto puro..."
          rows={5}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
        />
        {!formatter && (
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Add-on markdown não está ativo.</div>
        )}
        {mdOut && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Markdown</div>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{mdOut.markdown}</pre>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>HTML</div>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 8, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: mdOut.html }} />
            </div>
          </div>
        )}
      </div>

      {/* Busca agregada */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>
          🔎 Busca Agregada <span style={{ color: '#64748b', fontWeight: 400 }}>(serviço searchProvider)</span>
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar em todos os add-ons de texto (5291–5294)…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleSearch} style={buttonStyle} disabled={!searchProvider || searching}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {searchError && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>❌ {searchError}</div>}
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                <strong style={{ fontSize: 13 }}>{r.title}</strong>
                {r.snippet && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{r.snippet}</div>}
              </div>
            ))}
          </div>
        )}
        {!searchProvider && (
          <div style={{ color: '#64748b', fontSize: 12 }}>Add-on aggregator não está ativo.</div>
        )}
      </div>

      {/* Favoritos */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>
          ⭐ Favoritos <span style={{ color: '#64748b', fontWeight: 400 }}>(serviço favorites)</span>
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={favTitle}
            onChange={(e) => setFavTitle(e.target.value)}
            placeholder="Título do favorito"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={favUrl}
            onChange={(e) => setFavUrl(e.target.value)}
            placeholder="URL (opcional)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleAdd} style={buttonStyle} disabled={!favorites}>
            Adicionar
          </button>
        </div>
        {favMsg && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{favMsg}</div>}
        {!favorites && (
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Add-on favorites não está ativo.</div>
        )}
        {bookmarks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bookmarks.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{b.title}</strong>
                  {b.url && <div style={{ color: '#64748b', fontSize: 11 }}>{b.url}</div>}
                </div>
                <button onClick={() => handleRemove(b.id)} style={{ ...buttonStyle, background: 'rgba(239,68,68,0.8)' }}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Health check */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>
          ❤️ Health Check <span style={{ color: '#64748b', fontWeight: 400 }}>(serviço healthCheck)</span>
        </h3>
        <button onClick={runHealth} style={buttonStyle} disabled={!healthCheck || checking}>
          {checking ? 'Verificando…' : 'Verificar add-ons remotos'}
        </button>
        {!healthCheck && (
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Add-on health não está ativo.</div>
        )}
        {health.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {health.map((h) => (
              <div key={h.baseUrl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ fontSize: 13 }}>
                  <strong>{h.baseUrl}</strong>
                  {h.latencyMs !== null && (
                    <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{h.latencyMs}ms</span>
                  )}
                </span>
                {h.ok
                  ? <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>OK</span>
                  : <span style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }} title={h.error}>Falha</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
