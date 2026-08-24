/** Metadados declarados no manifesto para a aba que o add-on oferece ao host. */
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
  /** Valor serializável que o host pode revelar sob demanda, sem interpretar a regra do add-on. */
  details?: JsonValue;
}

/** Resposta produzida por uma ação da aba e exibida pelo host. */
export interface AddonTabResult {
  status: 'info' | 'success' | 'error';
  title?: string;
  body: string;
  items?: AddonTabResultItem[];
}

/** Estado de interface que o host pode restaurar para uma aba que o solicitar. */
export interface AddonTabViewState {
  values: Record<string, string>;
  response?: AddonTabResult;
}

/** Ponte declarada pelo add-on para persistir sua interface sem acoplar o host ao armazenamento. */
export interface AddonTabPersistence {
  load(): Promise<AddonTabViewState | undefined>;
  save(state: AddonTabViewState): Promise<void>;
}

/**
 * Interface executável entregue por um add-on em processo.
 *
 * O host renderiza campos e botões de forma genérica; a extensão preserva sua
 * própria regra ao receber a ação e os valores preenchidos.
 */
export interface AddonTab extends AddonTabMetadata {
  fields?: AddonTabField[];
  actions?: AddonTabAction[];
  run?: (actionId: string, values: Record<string, string>) => AddonTabResult | Promise<AddonTabResult>;
  persistence?: AddonTabPersistence;
  getSnapshot?: () => AddonTabResult | Promise<AddonTabResult>;
  subscribe?: (listener: () => void) => () => void;
}
