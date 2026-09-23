import type { AddonInstance } from '@addons-poc/protocol';
import { readingSections } from '../tab-view';
import type { AddonTabController } from './useAddonTab';

interface AddonControlPanelProps {
  addon: AddonInstance;
  controller: AddonTabController;
  /** Shown above the controls, so the panel reads on its own page. */
  title?: string;
  /** Hides the controls that choose the content, for a page that already has it. */
  reading?: boolean;
}

/**
 * Controls of an add-on, rendered from its declaration.
 *
 * The host decides how each control looks through the declared kind — slider,
 * toggle, colour, or text — and groups them by the declared heading. The panel
 * is what both the add-on page and the rendered result page show beside the
 * response.
 */
export function AddonControlPanel({ addon, controller, title, reading }: AddonControlPanelProps) {
  const tab = addon.ui;
  if (!tab) return null;

  const { values, setValue, runningAction, run, sections } = controller;
  // The result page already holds the content, so the source controls stay out.
  const visibleSections = reading ? readingSections(sections) : sections;

  return (
    <aside className="host-tab-panel" aria-label={title ?? `Controls for ${tab.title}`}>
      {visibleSections.map((section, index) => (
        <div className="host-tab-panel-group" key={`${section.title ?? 'controls'}-${index}`}>
          {section.title && <h4 className="host-tab-panel-heading">{section.title}</h4>}

          {section.fields.map((field) => {
            const value = values[field.id] ?? '';

            if (field.type === 'range') {
              const min = field.min ?? 0;
              const max = field.max ?? 100;
              const step = field.step ?? 1;
              const shown = value === '' ? String(min) : value;
              return (
                <label key={field.id} className="host-tab-panel-field">
                  <span className="host-tab-field-row">
                    <span>{field.label}</span>
                    <output className="host-tab-field-value">{shown}</output>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={shown}
                    onChange={(event) => setValue(field.id, event.target.value)}
                    className="host-tab-range"
                  />
                </label>
              );
            }

            if (field.type === 'toggle') {
              return (
                <label key={field.id} className="host-tab-panel-toggle">
                  <input
                    type="checkbox"
                    checked={value === 'true'}
                    onChange={(event) => setValue(field.id, event.target.checked ? 'true' : 'false')}
                  />
                  <span>{field.label}</span>
                </label>
              );
            }

            if (field.type === 'color') {
              return (
                <label key={field.id} className="host-tab-panel-field">
                  <span className="host-tab-field-row">
                    <span>{field.label}</span>
                    <code className="host-tab-field-value">{value || 'default'}</code>
                  </span>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/iu.test(value) ? value : '#000000'}
                    onChange={(event) => setValue(field.id, event.target.value)}
                    className="host-tab-color"
                  />
                </label>
              );
            }

            return (
              <label key={field.id} className="host-tab-panel-field">
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea
                    value={value}
                    onChange={(event) => setValue(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="host-tab-control"
                  />
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    value={value}
                    onChange={(event) => setValue(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && tab.actions?.length === 1) void run(tab.actions[0].id);
                    }}
                    className="host-tab-control"
                  />
                )}
              </label>
            );
          })}

          {section.actions.length > 0 && (
            <div className="host-tab-panel-actions">
              {section.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => void run(action.id)}
                  disabled={runningAction !== null}
                  className={`host-tab-panel-button${action.variant === 'danger' ? ' is-danger' : action.variant === 'secondary' ? ' is-secondary' : ''}`}
                >
                  {runningAction === action.id ? 'Running…' : action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
