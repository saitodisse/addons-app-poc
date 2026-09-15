/** Manifest metadata for the tab that the add-on offers to the host. */
export interface AddonTabMetadata {
  title: string;
  body: string;
}

export interface AddonTabField {
  id: string;
  label: string;
  type?: 'text' | 'textarea' | 'url';
  placeholder?: string;
  required?: boolean;
}

export interface AddonTabAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AddonTabResultItem {
  label: string;
  value: string;
  /** Serializable value the host can reveal on demand without interpreting add-on rules. */
  details?: JsonValue;
}

/** Response produced by a tab action and displayed by the host. */
export interface AddonTabResult {
  status: 'info' | 'success' | 'error';
  title?: string;
  body: string;
  items?: AddonTabResultItem[];
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
