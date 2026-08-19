import { useCallback, useEffect, useState } from 'react';
import { HttpTextAddonClient } from '@addons/core';
import type { AddonManifest, TextMeta, TextItem } from '@addons/core';

/**
 * Add-ons de texto conhecidos (URL = identidade, como no Stremio).
 * Cada um é um servidor HTTP independente.
 */
const TEXT_ADDONS = [
  { baseUrl: 'http://localhost:5291', emoji: '📚' },
  { baseUrl: 'http://localhost:5292', emoji: '💬' },
  { baseUrl: 'http://localhost:5293', emoji: '🪶' },
  { baseUrl: 'http://localhost:5294', emoji: '🌐' },
];

interface LoadedAddon {
  baseUrl: string;
  emoji: string;
  manifest: AddonManifest;
  error?: string;
}

interface TextosDemoProps {
  client?: HttpTextAddonClient;
}

export function TextosDemo({ client = new HttpTextAddonClient() }: TextosDemoProps) {
  const [addons, setAddons] = useState<LoadedAddon[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [metas, setMetas] = useState<TextMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);

  // Carrega os manifestos dos add-ons de texto remotos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        TEXT_ADDONS.map(async (addon) => {
          try {
            const manifest = await client.getManifest(addon.baseUrl);
            return { ...addon, manifest };
          } catch (error) {
            return {
              ...addon,
              manifest: null as unknown as AddonManifest,
              error: (error as Error).message,
            };
          }
        }),
      );
      if (!cancelled) setAddons(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const active = addons.find((a) => a.baseUrl === selected);
  const activeManifest = active?.manifest;
  const catalogs = activeManifest?.catalogs ?? [];
  const types = activeManifest?.types ?? ['text'];

  const runCatalog = useCallback(async (catalog: string) => {
    if (!selected || !catalog) return;
    setLoading(true);
    setMessage(null);
    setContent(null);
    setTexts([]);
    try {
      const type = types[0] ?? 'text';
      const payload = await client.catalog(selected, type, catalog);
      setMetas(payload.metas);
      setMessage(`Catálogo "${catalog}" — ${payload.metas.length} itens`);
    } catch (error) {
      setMetas([]);
      setMessage(`Erro: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [selected, client, types]);

  const runSearch = useCallback(async () => {
    if (!selected || !query.trim()) return;
    setLoading(true);
    setMessage(null);
    setContent(null);
    setTexts([]);
    try {
      const type = types[0] ?? 'text';
      const payload = await client.search(selected, type, query.trim());
      setMetas(payload.metas);
      setMessage(`Busca por "${query}" — ${payload.metas.length} resultados`);
    } catch (error) {
      setMetas([]);
      setMessage(`Erro: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [selected, query, client, types]);

  const openMeta = useCallback(
    async (meta: TextMeta) => {
      if (!selected) return;
      setLoading(true);
      setMessage(null);
      setContent(null);
      try {
        const type = meta.type ?? types[0] ?? 'text';
        const payload = await client.text(selected, type, meta.id);
        setTexts(payload.texts);
        setMetas((prev) => prev);
        if (payload.texts.length === 0) {
          setMessage(`Sem versões de texto para "${meta.name}"`);
        }
      } catch (error) {
        setTexts([]);
        setMessage(`Erro ao abrir: ${(error as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [selected, client, types],
  );

  const openContent = useCallback(
    async (item: TextItem) => {
      if (!item.url) return;
      setLoading(true);
      try {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.text();
        setContent({ title: item.name, body });
      } catch (error) {
        setMessage(`Erro ao ler conteúdo: ${(error as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const selectAddon = (baseUrl: string) => {
    setSelected(baseUrl);
    setCatalogId('');
    setQuery('');
    setMetas([]);
    setTexts([]);
    setContent(null);
    setMessage(null);
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 16,
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    color: '#e2e8f0',
    fontSize: 13,
  };

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

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Como no Stremio com o Torrentio: cada add-on é um <strong>servidor HTTP</strong> que declara
        <code> resources </code> no manifesto (catalog/search/text) e responde em
        <code> /&lt;resource&gt;/&lt;type&gt;/&lt;id&gt;.json</code>. Os textos são entregues por URL,
        no mesmo formato do recurso <code>subtitles</code>.
      </p>

      {/* Seleção de add-on remoto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        {addons.map((addon) => (
          <button
            key={addon.baseUrl}
            onClick={() => selectAddon(addon.baseUrl)}
            style={{
              ...cardStyle,
              borderColor: selected === addon.baseUrl ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              opacity: addon.error ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{addon.emoji}</div>
            <strong>{addon.error ? 'Offline' : addon.manifest?.name ?? 'Carregando…'}</strong>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
              {addon.error ?? `${addon.baseUrl} · ${addon.manifest?.version}`}
            </div>
          </button>
        ))}
      </div>

      {selected && activeManifest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recursos declarados no manifesto */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
              Resources declarados
            </h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(activeManifest.resources ?? []).map((r) => (
                <span key={r.name} style={{
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: '#93c5fd',
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontSize: 12,
                }}>
                  {r.name} · {r.types.join(', ')}
                </span>
              ))}
            </div>
          </div>

          {/* Catálogos */}
          {catalogs.length > 0 && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                Catálogos
              </h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {catalogs.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCatalogId(cat.id);
                      setQuery('');
                      runCatalog(cat.id);
                    }}
                    style={{
                      ...buttonStyle,
                      background: catalogId === cat.id
                        ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                        : 'rgba(255,255,255,0.06)',
                      color: catalogId === cat.id ? '#fff' : '#cbd5e1',
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Busca */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={`Buscar em ${types.join('/')}…`}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={runSearch} style={buttonStyle} disabled={loading}>
              Buscar
            </button>
          </div>

          {message && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{message}</div>
          )}

          {/* Resultados */}
          {metas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {metas.map((meta) => (
                <button
                  key={meta.id}
                  onClick={() => openMeta(meta)}
                  style={cardStyle}
                >
                  <strong>{meta.name}</strong>
                  {meta.author && (
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{meta.author}</div>
                  )}
                  {meta.description && (
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                      {meta.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Versões de texto disponíveis (formato subtitles) */}
          {texts.length > 0 && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                Versões de texto ({texts.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {texts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openContent(item)}
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      {item.description && (
                        <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{item.description}</span>
                      )}
                    </span>
                    <span style={{ color: '#22c55e', fontSize: 12 }}>Ler ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conteúdo lido */}
          {content && (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 24,
              whiteSpace: 'pre-wrap',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.7,
              fontSize: 15,
            }}>
              <h3 style={{ fontFamily: 'system-ui, sans-serif', fontSize: 18, marginBottom: 12 }}>{content.title}</h3>
              {content.body}
            </div>
          )}
        </div>
      )}

      {!selected && (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '2px dashed rgba(255,255,255,0.1)', fontSize: 14 }}>
          Selecione um add-on de texto acima. Os servidores rodam nas portas 5291–5294
          (<code>pnpm dev:addons</code>).
        </div>
      )}
    </div>
  );
}