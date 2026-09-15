import { useEffect, useRef, useState } from 'react';

interface FactoryResetControlProps {
  disabled?: boolean;
  onReset: () => void | Promise<void>;
}

export function FactoryResetControl({ disabled = false, onReset }: FactoryResetControlProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmationRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !resetting) {
        setOpen(false);
        setConfirmed(false);
        setError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, resetting]);

  const close = () => {
    if (resetting) return;
    setOpen(false);
    setConfirmed(false);
    setError(null);
  };

  const reset = async () => {
    if (!confirmed || resetting) return;
    setResetting(true);
    setError(null);
    try {
      await onReset();
      setOpen(false);
      setConfirmed(false);
      setCompleted(true);
    } catch (resetError) {
      setError((resetError as Error).message || 'Could not complete the factory reset.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <section aria-label="Factory reset" style={{ marginTop: 8, padding: 16, border: '1px solid rgba(239,68,68,0.28)', borderRadius: 10, background: 'rgba(127,29,29,0.12)' }}>
      <h2 style={{ margin: '0 0 6px', color: '#fecaca', fontSize: 14 }}>Factory reset</h2>
      <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
        Removes installed add-ons, host settings, and protocol state saved in this browser.
      </p>
      <button
        type="button"
        onClick={() => {
          setCompleted(false);
          setError(null);
          setOpen(true);
        }}
        disabled={disabled || resetting}
        style={{ padding: '9px 12px', border: '1px solid rgba(248,113,113,0.48)', borderRadius: 7, background: 'rgba(239,68,68,0.16)', color: '#fecaca', cursor: disabled || resetting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: disabled || resetting ? 0.55 : 1 }}
      >
        Factory reset
      </button>
      {completed && <p role="status" style={{ margin: '10px 0 0', color: '#86efac', fontSize: 12 }}>Host restored to its initial state. No add-ons are installed.</p>}
      {error && <p role="alert" style={{ margin: '10px 0 0', color: '#fca5a5', fontSize: 12 }}>{error}</p>}

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="factory-reset-title" aria-describedby="factory-reset-description" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(2,6,23,0.78)' }}>
          <div style={{ width: 'min(100%, 520px)', padding: 20, border: '1px solid rgba(248,113,113,0.42)', borderRadius: 12, background: '#1e293b', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <h2 id="factory-reset-title" style={{ margin: '0 0 8px', color: '#f8fafc', fontSize: 20 }}>Confirm factory reset</h2>
            <p id="factory-reset-description" style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.55 }}>
              This action removes all installed add-ons, accepted contracts, search limits, and protocol state. Add-ons can be installed again from their URLs afterward.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: '#f1f5f9', fontSize: 13, lineHeight: 1.45 }}>
              <input
                ref={confirmationRef}
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={resetting}
                style={{ marginTop: 2, accentColor: '#ef4444' }}
              />
              <span>I understand that the host's local data and all installed add-ons will be removed.</span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" onClick={close} disabled={resetting} style={{ padding: '9px 12px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 7, background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: resetting ? 'not-allowed' : 'pointer', fontSize: 12 }}>Cancel</button>
              <button type="button" onClick={() => void reset()} disabled={!confirmed || resetting} style={{ padding: '9px 12px', border: 'none', borderRadius: 7, background: confirmed && !resetting ? '#dc2626' : 'rgba(127,29,29,0.5)', color: '#fff', cursor: !confirmed || resetting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>{resetting ? 'Resetting…' : 'Confirm reset'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
