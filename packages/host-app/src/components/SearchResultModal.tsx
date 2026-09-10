import { useEffect, useRef } from 'react';
import type { SearchResultRow } from '../search';

interface SearchResultModalProps {
  result: SearchResultRow | null;
  content: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function SearchResultModal({ result, content, loading, error, onClose }: SearchResultModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!result) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, result]);

  if (!result) return null;

  return (
    <div
      className="host-search-result-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="host-search-result-modal" role="dialog" aria-modal="true" aria-labelledby="search-result-title">
        <header className="host-search-result-header">
          <div>
            <span className="host-search-result-kicker">Conteúdo do resultado</span>
            <h2 id="search-result-title">{result.name}</h2>
            <p>{result.sourceAddonName} · {result.type}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar conteúdo"
            title="Fechar conteúdo"
            className="host-search-result-close"
          >
            ×
          </button>
        </header>

        <div className="host-search-result-body" aria-busy={loading}>
          {loading && <p role="status">Carregando conteúdo…</p>}
          {error && <p role="alert">Não foi possível carregar o conteúdo: {error}</p>}
          {!loading && !error && content !== null && <pre>{content}</pre>}
        </div>
      </div>
    </div>
  );
}
