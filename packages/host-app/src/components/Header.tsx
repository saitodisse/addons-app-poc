import type { AddonInstance } from '@addons/core';
import { Link, RUTAS } from '../router';

interface HeaderProps {
  addons: AddonInstance[];
}

export function Header({ addons }: HeaderProps) {
  const readyCount = addons.filter(a => a.status === 'ready').length;
  const errorCount = addons.filter(a => a.status === 'error').length;

  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.8)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
      padding: '16px 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🧩</span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
              Add-ons POC
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Prova de conceito do sistema de add-ons
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#22c55e' }}>● {readyCount} ativos</span>
            {errorCount > 0 && <span style={{ color: '#ef4444' }}>● {errorCount} erro</span>}
          </div>

          <nav aria-label="Navegação principal" style={{ display: 'flex', gap: 8 }}>
            <Link
              to={RUTAS.inicio}
              style={{
                padding: '8px 16px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Demonstração
            </Link>
            <Link
              to={RUTAS.settings}
              style={{
                padding: '8px 16px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              ⚙️ Configurações
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
