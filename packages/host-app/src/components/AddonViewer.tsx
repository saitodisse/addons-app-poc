import { useState } from 'react';
import type { AddonInstance, ServiceRegistry } from '@addons/core';

interface AddonViewerProps {
  addon: AddonInstance;
  registry: ServiceRegistry;
}

export function AddonViewer({ addon, registry }: AddonViewerProps) {
  const [counterValue, setCounterValue] = useState(0);

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

  const greeter = registry.get<{ greet: (name: string) => string }>('greeter');
  const counter = registry.get<{
    increment: () => number;
    decrement: () => number;
    getValue: () => number;
    reset: () => number;
  }>('counter');

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

      {/* Testar serviços */}
      <section>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Testar</h3>

        {greeter && (
          <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Greeter</strong></div>
            <button
              onClick={() => {
                const result = greeter.greet('visitante');
                alert(result);
              }}
              style={{
                padding: '6px 16px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Dizer Olá
            </button>
          </div>
        )}

        {counter && (
          <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Counter</strong></div>
            <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', margin: '8px 0' }}>
              {counterValue}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setCounterValue(counter.decrement())}
                style={{
                  padding: '6px 16px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                -1
              </button>
              <button
                onClick={() => setCounterValue(counter.reset())}
                style={{
                  padding: '6px 16px',
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Reset
              </button>
              <button
                onClick={() => setCounterValue(counter.increment())}
                style={{
                  padding: '6px 16px',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                +1
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}