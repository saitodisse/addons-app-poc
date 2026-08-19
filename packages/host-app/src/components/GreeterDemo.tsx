import { useState } from 'react';

interface GreeterDemoProps {
  greeter: { greet: (name: string) => string } | undefined;
}

export function GreeterDemo({ greeter }: GreeterDemoProps) {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGreet = () => {
    if (!greeter) {
      setError('Add-on greeter não está instalado');
      return;
    }
    if (!name.trim()) {
      setError('Digite um nome primeiro');
      return;
    }
    try {
      setError(null);
      const result = greeter.greet(name.trim());
      setGreeting(result);
    } catch (e) {
      setError((e as Error).message);
      setGreeting(null);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#f1f5f9' }}>
        👋 Saudação
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Digite um nome e veja o add-on de saudação em ação
      </p>

      {!greeter ? (
        <div style={{
          padding: 20,
          textAlign: 'center',
          color: '#64748b',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.1)',
          fontSize: 14,
        }}>
          Nenhum add-on de saudação instalado.
          Instale o "Hello" ou "Hello PT" pelo catálogo.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGreet()}
              placeholder="Digite seu nome..."
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                color: '#e2e8f0',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleGreet}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Saudar 🎉
            </button>
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
              marginBottom: 12,
            }}>
              ❌ {error}
            </div>
          )}

          {greeting && (
            <div style={{
              padding: 24,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 12,
              textAlign: 'center',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: -8,
                left: 24,
                width: 16,
                height: 16,
                background: 'rgba(99,102,241,0.15)',
                borderLeft: '1px solid rgba(99,102,241,0.3)',
                borderTop: '1px solid rgba(99,102,241,0.3)',
                transform: 'rotate(45deg)',
              }} />
              <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                {greeting}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}