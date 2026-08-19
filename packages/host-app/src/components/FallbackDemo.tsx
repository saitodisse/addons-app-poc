import { useState } from 'react';
import { withFallback, AggregateFallbackError } from '@addons/core';
import type { ServiceRegistry, Greeter } from '@addons/core';

interface FallbackDemoProps {
  registry: ServiceRegistry;
}

export function FallbackDemo({ registry }: FallbackDemoProps) {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'normal' | 'error'>('normal');

  const greeters = registry.getAll<Greeter>('greeter');

  const handleWithFallback = () => {
    const name = mode === 'error' ? 'error' : 'Mundo';
    try {
      const res = withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet(name));
      setResult(res);
      setError(null);
    } catch (e) {
      const err = e as AggregateFallbackError;
      setResult(null);
      setError(err.message);
    }
  };

  const handleWithoutFallback = () => {
    const g = registry.get<Greeter>('greeter');
    if (!g) {
      setError('Nenhum greeter disponível');
      return;
    }
    try {
      const res = g.greet('Mundo');
      setResult(res);
      setError(null);
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#f1f5f9' }}>
        🔄 Cadeia de Fallback
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Veja como o sistema usa múltiplos add-ons para o mesmo serviço
      </p>

      {/* Cadeia de implementações */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
          Implementações do serviço <code style={{ color: '#818cf8' }}>greeter</code>:
        </div>
        {greeters.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, fontStyle: 'italic' }}>
            Nenhuma implementação disponível
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {greeters.map((g, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: i === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                fontSize: 13,
              }}>
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: i === 0 ? '#22c55e' : 'rgba(255,255,255,0.1)',
                  color: i === 0 ? '#fff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, color: '#e2e8f0' }}>
                  {i === 0 ? '⭐ Prioritário' : `↪️ Fallback ${i}`}
                </span>
                {i === 0 && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(34,197,94,0.2)',
                    color: '#22c55e',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    usado por padrão
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modo de erro */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Modo de teste:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMode('normal')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: mode === 'normal' ? 600 : 400,
              background: mode === 'normal'
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'rgba(255,255,255,0.05)',
              color: '#fff',
            }}
          >
            ✅ Normal
          </button>
          <button
            onClick={() => setMode('error')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: mode === 'error' ? 600 : 400,
              background: mode === 'error'
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'rgba(255,255,255,0.05)',
              color: '#fff',
            }}
          >
            🔥 Forçar Erro
          </button>
        </div>
        {mode === 'error' && (
          <p style={{ fontSize: 12, color: '#fca5a5', marginTop: 6 }}>
            O add-on prioritário (hello-pt) lançará um erro quando receber "error" como nome.
            O fallback (hello) será usado automaticamente.
          </p>
        )}
        {mode === 'normal' && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            O add-on prioritário (hello-pt) responde normalmente.
          </p>
        )}
      </div>

      {/* Botões de teste */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleWithFallback}
          disabled={greeters.length === 0}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: greeters.length === 0 ? 0.5 : 1,
          }}
        >
          🔄 Com Fallback
        </button>
        <button
          onClick={handleWithoutFallback}
          disabled={greeters.length === 0}
          style={{
            padding: '10px 20px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: 13,
            opacity: greeters.length === 0 ? 0.5 : 1,
          }}
        >
          ❌ Sem Fallback
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8,
          fontSize: 14,
          color: '#e2e8f0',
          textAlign: 'center',
        }}>
          ✅ {result}
        </div>
      )}

      {error && (
        <div style={{
          padding: 16,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          fontSize: 14,
          color: '#fca5a5',
          textAlign: 'center',
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}