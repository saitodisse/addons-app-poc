import { useEffect, useState } from 'react';
import { JsonHighlighter } from 'json-highlighter';
import { validateTabActionInput, validateTabResult } from '@addons-poc/protocol';
import type { AddonInstance, AddonTabResult, JsonValue } from '@addons-poc/protocol';

interface AddonTabViewProps {
  addon: AddonInstance;
}

interface SelectedDetail {
  label: string;
  value: JsonValue;
}

const responseColors = {
  info: { background: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', color: '#bfdbfe' },
  success: { background: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', color: '#bbf7d0' },
  error: { background: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', color: '#fecaca' },
};

export function AddonTabView({ addon }: AddonTabViewProps) {
  const tab = addon.ui;
  const [values, setValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<AddonTabResult | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(!tab?.persistence);
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);

  useEffect(() => {
    if (!tab) return;
    let active = true;
    const restore = async () => {
      const saved = await tab.persistence?.load();
      if (!active) return;
      if (saved) {
        setValues(saved.values ?? {});
        setResponse(saved.response ?? null);
      }
      setPersistenceReady(true);
    };
    void restore();
    return () => { active = false; };
  }, [tab]);

  useEffect(() => {
    if (!tab) return;
    if (!persistenceReady || !tab.persistence) return;
    void tab.persistence.save({ values, response: response ?? undefined });
  }, [persistenceReady, response, tab, values]);

  useEffect(() => {
    if (!tab) return;
    let active = true;
    const refresh = async () => {
      const snapshot = await tab.getSnapshot?.();
      if (active && snapshot) setResponse(snapshot);
    };
    void refresh();
    const unsubscribe = tab.subscribe?.(() => { void refresh(); });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [tab]);

  if (!tab) return null;

  const run = async (actionId: string) => {
    if (!tab.run) {
      setResponse({ status: 'info', body: 'Este add-on não oferece ações interativas.' });
      return;
    }

    const input = validateTabActionInput(addon.manifest.contract, actionId, values);
    if (!input.valid) {
      setResponse({ status: 'error', body: input.errors.join('\n') });
      return;
    }

    setRunningAction(actionId);
    try {
      setSelectedDetail(null);
      const result = await tab.run(actionId, input.values);
      const output = validateTabResult(result);
      if (!output.valid) {
        setResponse({ status: 'error', body: `Resposta rejeitada pelo contrato: ${output.errors.join('\n')}` });
      } else {
        setResponse(result);
      }
    } catch (error) {
      setResponse({ status: 'error', body: (error as Error).message || 'A ação não pôde ser concluída.' });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
      <div>
      <h3 style={{ fontSize: 18, fontWeight: 650, margin: '0 0 6px', color: '#f1f5f9' }}>{tab.title}</h3>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>{tab.body}</p>

      {tab.fields && tab.fields.length > 0 && (
        <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
          {tab.fields.map((field) => (
            <label key={field.id} style={{ display: 'grid', gap: 6, color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}>
              {field.label}
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.id] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                  placeholder={field.placeholder}
                  rows={5}
                  style={{ resize: 'vertical', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: '#e2e8f0', font: 'inherit' }}
                />
              ) : (
                <input
                  type={field.type ?? 'text'}
                  value={values[field.id] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                  placeholder={field.placeholder}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && tab.actions?.length === 1) void run(tab.actions[0].id);
                  }}
                  style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: '#e2e8f0', font: 'inherit' }}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {tab.actions && tab.actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: response ? 18 : 0 }}>
          {tab.actions.map((action) => {
            const secondary = action.variant === 'secondary';
            const danger = action.variant === 'danger';
            return (
              <button
                key={action.id}
                onClick={() => void run(action.id)}
                disabled={runningAction !== null}
                style={{
                  padding: '10px 16px', border: secondary ? '1px solid rgba(255,255,255,0.16)' : 'none', borderRadius: 8,
                  background: danger ? 'rgba(239,68,68,0.18)' : secondary ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: danger ? '#fecaca' : '#fff', cursor: runningAction ? 'wait' : 'pointer', fontSize: 13, fontWeight: 650,
                  opacity: runningAction && runningAction !== action.id ? 0.6 : 1,
                }}
              >
                {runningAction === action.id ? 'Executando…' : action.label}
              </button>
            );
          })}
        </div>
      )}

      {response && (() => {
        const color = responseColors[response.status];
        return (
          <div role={response.status === 'error' ? 'alert' : 'status'} style={{ padding: 16, borderRadius: 8, background: color.background, border: `1px solid ${color.border}`, color: color.color }}>
            {response.title && <strong style={{ display: 'block', marginBottom: 6 }}>{response.title}</strong>}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{response.body}</div>
            {response.items && response.items.length > 0 && (
              <dl style={{ display: 'grid', gap: 8, margin: '14px 0 0', fontSize: 13 }}>
                {response.items.map((item, index) => (
                  <div key={`${item.label}-${index}`} style={{ display: 'grid', gap: 2, paddingTop: index ? 8 : 0, borderTop: index ? `1px solid ${color.border}` : 'none' }}>
                    <dt style={{ fontWeight: 650 }}>
                      {item.details === undefined ? item.label : (
                        <button
                          type="button"
                          onClick={() => setSelectedDetail({ label: item.label, value: item.details! })}
                          aria-controls="json-details-card"
                          style={{ padding: 0, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontWeight: 'inherit', textAlign: 'left', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
                        >
                          {item.label}
                        </button>
                      )}
                    </dt>
                    <dd style={{ margin: 0, opacity: 0.9, overflowWrap: 'anywhere' }}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })()}

      </div>

      <aside id="json-details-card" aria-live="polite" style={{ minHeight: 220, overflow: 'hidden', border: '1px solid #334155', borderRadius: 10, background: '#020617' }}>
        {selectedDetail ? (
          <>
            <header style={{ padding: '11px 14px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
              <span style={{ display: 'block', color: '#22c55e', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>localStorage $ cat {selectedDetail.label}.json</span>
              <h4 style={{ margin: '4px 0 0', overflow: 'hidden', color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDetail.label}</h4>
            </header>
            <pre style={{ maxHeight: 520, margin: 0, overflow: 'auto', padding: 18, color: '#cbd5e1', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <JsonHighlighter json={selectedDetail.value} space={2} />
            </pre>
          </>
        ) : (
          <p style={{ margin: 0, padding: 18, color: '#64748b', fontSize: 13, lineHeight: 1.55 }}>
            Clique em um estado para ver seu JSON completo aqui.
          </p>
        )}
      </aside>
    </div>
  );
}
