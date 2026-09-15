import { JsonHighlighter } from 'json-highlighter';
import type { AddonManifest } from '@addons-poc/protocol';

interface AddonContractViewProps {
  manifest: AddonManifest;
  manifestUrl: string;
  stateDestination?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h4 style={{ margin: 0, color: '#cbd5e1', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h4>
      {children}
    </section>
  );
}

function ItemList({ children }: { children: React.ReactNode }) {
  return <ul style={{ display: 'grid', gap: 6, margin: 0, paddingLeft: 18, color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>{children}</ul>;
}

function SchemaLabel({ description, classification }: { description: string; classification: string }) {
  const labels: Record<string, string> = { public: 'public', personal: 'personal', secret: 'secret' };
  return <span style={{ color: classification === 'secret' ? '#fca5a5' : '#94a3b8' }}>{description} · {labels[classification] ?? classification} data</span>;
}

export function AddonContractView({ manifest, manifestUrl, stateDestination }: AddonContractViewProps) {
  const contract = manifest.contract;
  const offered = contract.services.filter((service) => service.role === 'provides');
  const consumed = contract.services.filter((service) => service.role === 'consumes');
  const incoming = contract.http.filter((request) => request.direction === 'incoming');
  const outgoing = contract.http.filter((request) => request.direction === 'outgoing');

  return (
    <div className="host-addon-contract" style={{ display: 'grid', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
        Contract <code style={{ color: '#c4b5fd' }}>contract v{contract.version}</code>. The host checks mediated services, fields, and actions before enabling the add-on.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
        <Section title="Provides">
          {offered.length ? <ItemList>{offered.map((service) => <li key={`offered-${service.id}`}><strong style={{ color: '#e2e8f0' }}>{service.id}</strong> — {service.description}{service.methods?.length ? ` Methods: ${service.methods.map((method) => method.id).join(', ')}.` : ''}</li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not provide a service to the host.</p>}
        </Section>

        <Section title="Consumes">
          {(contract.ui.fields.length || consumed.length) ? <ItemList>
            {contract.ui.fields.map((field) => <li key={`field-${field.id}`}><strong style={{ color: '#e2e8f0' }}>{field.label}</strong> — <SchemaLabel description={field.description} classification={field.schema.classification} /></li>)}
            {consumed.map((service) => <li key={`consumed-${service.id}`}><strong style={{ color: '#e2e8f0' }}>{service.id}</strong> — {service.description}{service.required === false ? ' Optional.' : ' Required.'}</li>)}
          </ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not consume fields or services from other add-ons.</p>}
        </Section>

        <Section title="Actions and responses">
          {contract.ui.actions.length ? <ItemList>{contract.ui.actions.map((action) => <li key={`action-${action.id}`}><strong style={{ color: '#e2e8f0' }}>{action.label}</strong> — {action.description} Returns: <SchemaLabel description={action.returns.description} classification={action.returns.schema.classification} /></li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not expose an interactive action in this tab.</p>}
        </Section>

        <Section title="Persisted state">
          {contract.state.length ? <ItemList>{contract.state.map((state) => <li key={`state-${state.id}`}><strong style={{ color: '#e2e8f0' }}>{state.key ?? state.keyPattern}</strong> — {state.description} Operations: {state.operations.join(', ')}. Removed by: {state.deletionTrigger}</li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not declare persisted state.</p>}
          {contract.state.length > 0 && stateDestination && <p style={{ margin: 0, color: '#86efac', fontSize: 12, lineHeight: 1.45 }}>Current effective destination: {stateDestination}</p>}
        </Section>

        <Section title="Incoming HTTP">
          {incoming.length ? <ItemList>{incoming.map((request) => <li key={`in-${request.id}`}><code style={{ color: '#c4b5fd' }}>{request.method} {request.path}</code> — {request.purpose}</li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not operate as an HTTP server.</p>}
        </Section>

        <Section title="Outgoing HTTP">
          {outgoing.length ? <ItemList>{outgoing.map((request) => <li key={`out-${request.id}`}><code style={{ color: '#c4b5fd' }}>{request.method} {request.origin}{request.path}</code> — {request.purpose} <span style={{ color: '#86efac' }}>(declared in the contract; observed when executed)</span></li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not declare external HTTP calls.</p>}
        </Section>
      </div>

      <Section title="Recorded events">
        {contract.logs.length ? <ItemList>{contract.logs.map((event) => <li key={`log-${event.id}`}><code style={{ color: '#c4b5fd' }}>{event.level}</code> — {event.message}. {event.description}</li>)}</ItemList> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Does not declare events for the Debug Add-on.</p>}
      </Section>

      <section aria-label="Complete manifest JSON" style={{ overflow: 'hidden', border: '1px solid #334155', borderRadius: 10, background: '#020617' }}>
        <header style={{ padding: '11px 14px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
          <span style={{ display: 'block', color: '#22c55e', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>manifest $ cat {manifestUrl}</span>
          <strong style={{ display: 'block', marginTop: 4, color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>Complete installed JSON</strong>
        </header>
        <pre style={{ maxHeight: 480, margin: 0, overflow: 'auto', padding: 18, color: '#cbd5e1', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <JsonHighlighter json={manifest} space={2} />
        </pre>
      </section>
    </div>
  );
}
