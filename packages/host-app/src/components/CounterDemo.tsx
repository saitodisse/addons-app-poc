import { useState, useEffect } from 'react';

interface CounterDemoProps {
  counter: {
    increment: () => number;
    decrement: () => number;
    getValue: () => number;
    reset: () => number;
  } | undefined;
}

export function CounterDemo({ counter }: CounterDemoProps) {
  const [value, setValue] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (counter) {
      setValue(counter.getValue());
    }
  }, [counter]);

  if (!counter) {
    return (
      <div style={{
        padding: 20,
        textAlign: 'center',
        color: '#64748b',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px dashed rgba(255,255,255,0.1)',
        fontSize: 14,
      }}>
        Nenhum add-on de contador instalado.
        Instale o "Counter" pelo catálogo.
      </div>
    );
  }

  const handleIncrement = () => {
    const newVal = counter.increment();
    setValue(newVal);
    setHistory(prev => [...prev.slice(-9), newVal]);
  };

  const handleDecrement = () => {
    const newVal = counter.decrement();
    setValue(newVal);
    setHistory(prev => [...prev.slice(-9), newVal]);
  };

  const handleReset = () => {
    const newVal = counter.reset();
    setValue(newVal);
    setHistory([]);
  };

  const getColor = () => {
    if (value > 10) return '#22c55e';
    if (value > 5) return '#f59e0b';
    if (value < 0) return '#ef4444';
    return '#3b82f6';
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#f1f5f9' }}>
        🔢 Contador
      </h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Um contador simples demonstrado pelo add-on
      </p>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: getColor(), transition: 'color 0.3s', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {value === 0 ? 'Neutro' : value > 0 ? `Positivo (+${value})` : `Negativo (${value})`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button
          onClick={handleDecrement}
          style={{
            padding: '12px 28px',
            border: 'none',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          −1
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '12px 28px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ↺ Reset
        </button>
        <button
          onClick={handleIncrement}
          style={{
            padding: '12px 28px',
            border: 'none',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          +1
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Histórico:</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {history.map((h, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                fontSize: 13,
                fontFamily: 'monospace',
              }}>
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}