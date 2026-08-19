import { useState } from 'react';
import type { ServiceRegistry } from '@addons/core';

interface RegistryInspectorProps {
  registry: ServiceRegistry;
}

interface ServiceInfo {
  serviceId: string;
  addonIds: string[];
  count: number;
  type: string;
}

export function RegistryInspector({ registry }: RegistryInspectorProps) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [show, setShow] = useState(false);

  const inspect = () => {
    // Access registry internal state via getAll for known services
    const knownServices = ['greeter', 'counter'];
    const info: ServiceInfo[] = [];

    for (const serviceId of knownServices) {
      const all = registry.getAll(serviceId);
      if (all.length > 0) {
        // We can't get addonIds from the registry without accessing internals
        // But we can see the count and type
        info.push({
          serviceId,
          addonIds: [],
          count: all.length,
          type: typeof all[0],
        });
      }
    }

    setServices(info);
    setShow(true);
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#f1f5f9' }}>
        🔍 Inspetor do Registry
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Veja o estado interno do sistema de add-ons
      </p>

      <button
        onClick={inspect}
        style={{
          padding: '10px 20px',
          border: 'none',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 16,
        }}
      >
        🔍 Inspecionar Registry
      </button>

      {show && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {/* Cabeçalho */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: 13,
            fontWeight: 600,
            color: '#94a3b8',
          }}>
            ServiceRegistry
          </div>

          {/* Serviços */}
          {services.length === 0 ? (
            <div style={{ padding: 16, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
              Nenhum serviço registrado
            </div>
          ) : (
            services.map((svc) => (
              <div key={svc.serviceId} style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(99,102,241,0.15)',
                    color: '#818cf8',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}>
                    {svc.serviceId}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {svc.count} implementação{svc.count !== 1 ? 'ões' : ''}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Métodos disponíveis */}
          <div style={{
            padding: 12,
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 12,
            color: '#64748b',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#94a3b8' }}>Métodos da API:</div>
            <code style={{ color: '#818cf8', lineHeight: 1.8 }}>
              register(serviceId, instance, addonId, priority?)<br />
              unregister(serviceId, addonId)<br />
              get(serviceId) → T | undefined<br />
              getAll(serviceId) → T[]<br />
              has(serviceId) → boolean<br />
              clear()<br />
              clearAddon(addonId)
            </code>
          </div>
        </div>
      )}
    </div>
  );
}