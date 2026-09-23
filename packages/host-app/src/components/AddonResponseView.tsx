import { useState } from 'react';
import { JsonHighlighter } from 'json-highlighter';
import type { AddonInstance, AddonTabResult, JsonValue } from '@addons-poc/protocol';
import { renderedHtml } from '../tab-view';
import { RenderedHtmlView } from './RenderedHtmlView';

interface AddonResponseViewProps {
  addon: AddonInstance;
  response: AddonTabResult | null;
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

/** Response of a tab action: the rendered view, the text, and the items. */
export function AddonResponseView({ addon, response }: AddonResponseViewProps) {
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);
  if (!response) return null;

  const showsJsonDetails = addon.manifest.id === 'storage-local' || addon.manifest.id === 'storage-session';
  const detailsStorage = addon.manifest.id === 'storage-session' ? 'sessionStorage' : 'localStorage';
  const html = renderedHtml(response);
  const color = responseColors[response.status];

  return (
    <>
      <div
        role={response.status === 'error' ? 'alert' : 'status'}
        className="host-tab-response"
        style={{ background: color.background, border: `1px solid ${color.border}`, color: color.color }}
      >
        {response.title && <strong className="host-tab-response-title">{response.title}</strong>}
        {html
          ? <RenderedHtmlView html={html} />
          : <div className="host-tab-text">{response.body}</div>}
        {response.items && response.items.length > 0 && (
          <dl className="host-tab-items">
            {response.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="host-tab-item">
                <dt>
                  {item.details === undefined || !showsJsonDetails ? item.label : (
                    <button
                      type="button"
                      onClick={() => setSelectedDetail({ label: item.label, value: item.details! })}
                      aria-controls="json-details-card"
                      className="host-tab-item-link"
                    >
                      {item.label}
                    </button>
                  )}
                </dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {showsJsonDetails && (
        <aside id="json-details-card" aria-live="polite" className="host-tab-json">
          {selectedDetail ? (
            <>
              <header>
                <span>{detailsStorage} $ cat {selectedDetail.label}.json</span>
                <h4>{selectedDetail.label}</h4>
              </header>
              <pre>
                <JsonHighlighter json={selectedDetail.value} space={2} />
              </pre>
            </>
          ) : (
            <p>Click a state item to view its complete JSON here.</p>
          )}
        </aside>
      )}
    </>
  );
}
