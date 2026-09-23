/** Manifest metadata for the tab that the add-on offers to the host. */
export interface AddonTabMetadata {
  title: string;
  body: string;
}

/**
 * Control kinds a host may render.
 *
 * `range`, `toggle`, and `color` describe a setting the person adjusts while
 * looking at the response; a host that cannot render one of them falls back to
 * the text input, so an unknown kind never hides a control.
 */
export type AddonTabFieldType = 'text' | 'textarea' | 'url' | 'range' | 'toggle' | 'color';

export interface AddonTabField {
  id: string;
  label: string;
  type?: AddonTabFieldType;
  placeholder?: string;
  required?: boolean;
  /** Optional heading used by a host that renders a control panel. */
  group?: string;
  /**
   * Marks a control that chooses *which* content to read.
   *
   * A page that already holds the content — a result page reached from a
   * catalogue — hides these controls: the source is settled, and offering it
   * again would let the person leave the content they are reading.
   */
  source?: boolean;
  /** Lower bound of a `range` control. */
  min?: number;
  /** Upper bound of a `range` control. */
  max?: number;
  /** Increment of a `range` control. */
  step?: number;
}

export interface AddonTabAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Optional heading used by a host that renders a control panel. */
  group?: string;
  /** Marks an action that chooses which content to read; see `AddonTabField.source`. */
  source?: boolean;
  /**
   * Runs again whenever a field it receives changes, after a short pause.
   * It is what makes a slider update the response while the person drags it.
   */
  live?: boolean;
  /** Field identifiers the action accepts, mirroring the contract. */
  receives?: string[];
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AddonTabResultItem {
  label: string;
  value: string;
  /** Serializable value the host can reveal on demand without interpreting add-on rules. */
  details?: JsonValue;
}

/**
 * How a tab response should be presented.
 *
 * `text` is the default and the only form every host must support: the host
 * prints `body` as preformatted text. `html` lets an add-on publish a rendered
 * view that the host inserts without interpreting it. The content comes from
 * trusted add-on code that already runs in the host page, so the protocol
 * declares transparency: it does not sanitize, and v1 does not sandbox.
 */
export type AddonTabView = { kind: 'text' } | { kind: 'html'; html: string };

/** Response produced by a tab action and displayed by the host. */
export interface AddonTabResult {
  status: 'info' | 'success' | 'error';
  title?: string;
  body: string;
  items?: AddonTabResultItem[];
  /** Optional rendered view; when absent the host prints `body` as text. */
  view?: AddonTabView;
  /**
   * Field values the action changed, which the host applies to the controls.
   * It is how a preset or a reset moves the sliders it rewrote.
   */
  values?: Record<string, string>;
}

/** Interface state that the host can restore for a tab that requests it. */
export interface AddonTabViewState {
  values: Record<string, string>;
  response?: AddonTabResult;
}

/** Add-on bridge for persisting its interface without coupling the host to storage. */
export interface AddonTabPersistence {
  load(): Promise<AddonTabViewState | undefined>;
  save(state: AddonTabViewState): Promise<void>;
}

/**
 * Executable interface provided by an in-process add-on.
 *
 * The host renders fields and buttons generically; the add-on keeps its own
 * rules when it receives the action and filled values.
 */
export interface AddonTab extends AddonTabMetadata {
  fields?: AddonTabField[];
  actions?: AddonTabAction[];
  run?: (actionId: string, values: Record<string, string>) => AddonTabResult | Promise<AddonTabResult>;
  persistence?: AddonTabPersistence;
  getSnapshot?: () => AddonTabResult | Promise<AddonTabResult>;
  subscribe?: (listener: () => void) => () => void;
}
