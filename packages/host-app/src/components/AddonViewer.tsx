import { useState } from 'react';
import { withFallback, AggregateFallbackError } from '@addons/core';
import type { AddonInstance, ServiceRegistry, Greeter, Counter } from '@addons/core';

interface AddonViewerProps {
  addon: AddonInstance;
  registry: ServiceRegistry;
}

export function AddonViewer({ addon, registry }: AddonViewerProps) {
  const [counterValue, setCounterValue] = useState(0);
  const [fallbackResult, setFallbackResult] = useState<string | null>(null);

  if (addon.status === 'error') {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{addon.manifest.name}</h2>
        <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
          <strong style={{ color: '#dc2626' }}>Erro ao carregar add-on</strong>
          <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            {addon.error?.message ?? 'Erro desconhecido'}
          </p>
        </div>
      </div>
    );
  }

  const serviceList = addon.services.map((serviceId) => {
    const service = registry.get(serviceId);
    return { id: serviceId, available: !!service };
  });

  const greeter = registry.get<Greeter>('greeter');
  const greeters = registry.getAll<Greeter>('greeter');
  const counter = registry.get<Counter>('counter');

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>{addon.manifest.name}</h2>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        v{addon.manifest.version} · {addon.manifest.author}
      </div>

      {/* Informações */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Informações</h3>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          <div><strong>ID:</strong> {addon.manifest.id}</div>
          <div><strong>Licença:</strong> {addon.manifest.license}</div>
          <div><strong>URL:</strong> <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{addon.manifestUrl}</code></div>
        </div>
      </section>

      {/* Serviços */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Serviços</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {serviceList.map((svc) => (
            <li
              key={svc.id}
              style={{
                padding: '8px 12px',
                marginBottom: 4,
                borderRadius: 6,
                background: svc.available ? '#f0fdf4' : '#f9fafb',
                border: `1px solid ${svc.available ? '#bbf7d0' : '#e5e7eb'}`,
                fontSize: 13,
              }}
            >
              <span style={{ marginRight: 6 }}>{svc.available ? '✅' : '❌'}</span>
              <code>{svc.id}</code>
              {svc.available ? (
                <span style={{ color: '#16a34a', marginLeft: 8 }}>disponível</span>
              ) : (
                <span style={{ color: '#999', marginLeft: 8 }}>não registrado</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Fallback Info */}
      {greeters.length > 1 && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Cadeia de Fallback</h3>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
            <p style={{ marginBottom: 8 }}>
              O serviço <code>greeter</code> tem {greeters.length} implementações:
            </p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {greeters.map((g, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {i === 0 ? '⭐ Prioritário' : `↪️ Fallback ${i}`}
                  {i === 0 && (
                    <span style={{ color: '#22c55e', marginLeft: 8 }}>— usado por padrão</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Testar serviços */}
      <section>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Testar</h3>

        {greeter && (
          <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Greeter</strong></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const result = greeter.greet('visitante');
                  alert(`Sem fallback: ${result}`);
                }}
                style={btnStyle('#3b82f6')}
              >
                Sem Fallback
              </button>
              <button
                onClick={() => {
                  try {
                    const result = withFallback<Greeter, string>(
                      registry, 'greeter', (g) => g.greet('visitante'),
                    );
                    setFallbackResult(`✅ ${result}`);
                  } catch (e) {
                    setFallbackResult(`❌ ${(e as AggregateFallbackError).message}`);
                  }
                }}
                style={btnStyle('#22c55e')}
              >
                Com Fallback
              </button>
              <button
                onClick={() => {
                  try {
                    const result = withFallback<Greeter, string>(
                      registry, 'greeter', (g) => g.greet('error'),
                    );
                    setFallbackResult(`✅ ${result}`);
                  } catch (e) {
                    setFallbackResult(`❌ Fallback também falhou: ${(e as AggregateFallbackError).message}`);
                  }
                }}
                style={btnStyle('#ef4444')}
              >
                Forçar Erro 🔥
              </button>
            </div>
            {fallbackResult && (
              <div style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 6,
                background: fallbackResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${fallbackResult.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
                fontSize: 13,
              }}>
                {fallbackResult}
              </div>
            )}
          </div>
        )}

        {counter && (
          <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Counter</strong></div>
            <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', margin: '8px 0' }}>
              {counterValue}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setCounterValue(counter.decrement())} style={btnStyle('#ef4444')}>
                -1
              </button>
              <button onClick={() => setCounterValue(counter.reset())} style={btnStyle('#6b7280')}>
                Reset
              </button>
              <button onClick={() => setCounterValue(counter.increment())} style={btnStyle('#22c55e')}>
                +1
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '6px 16px',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  };
}