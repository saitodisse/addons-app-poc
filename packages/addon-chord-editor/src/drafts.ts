import type { AddonStateStore, HostAPI } from '@addons-poc/protocol';

export const DRAFTS_SERVICE = 'addons.chords.drafts';
export const DRAFT_KEY_PREFIX = 'chords-editor:draft:';

export interface ChordDraft {
  sourceUrl: string;
  baseChecksum: string;
  text: string;
  updatedAt: string;
}

export interface DraftLookupResult {
  found: boolean;
  text?: string;
  baseChecksum?: string;
}

export interface DraftService {
  get(request: { sourceUrl: string }): Promise<DraftLookupResult>;
  save(request: { sourceUrl: string; baseChecksum: string; text: string }): Promise<{ saved: boolean }>;
  remove(request: { sourceUrl: string }): Promise<{ removed: boolean }>;
}

export function draftKey(sourceUrl: string): string {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(sourceUrl)}`;
}

export class LocalChordDrafts implements DraftService {
  constructor(private readonly host: HostAPI, private readonly now: () => string = () => new Date().toISOString()) {}

  private store(): AddonStateStore {
    const service = this.host.services.use<AddonStateStore>({
      id: 'state-store',
      version: '^1.0.0',
      methods: [{ id: 'get' }, { id: 'set' }, { id: 'remove' }],
    });
    if (!service) throw new Error('The local storage add-on is required to save a chart draft.');
    return service;
  }

  async get({ sourceUrl }: { sourceUrl: string }): Promise<DraftLookupResult> {
    const draft = await this.store().get<ChordDraft>(draftKey(sourceUrl));
    if (!draft || draft.sourceUrl !== sourceUrl || typeof draft.text !== 'string' || typeof draft.baseChecksum !== 'string') {
      return { found: false };
    }
    return { found: true, text: draft.text, baseChecksum: draft.baseChecksum };
  }

  async save({ sourceUrl, baseChecksum, text }: { sourceUrl: string; baseChecksum: string; text: string }): Promise<{ saved: boolean }> {
    if (!sourceUrl || !baseChecksum) throw new Error('A source URL and checksum are required for a local draft.');
    await this.store().set(draftKey(sourceUrl), { sourceUrl, baseChecksum, text, updatedAt: this.now() } satisfies ChordDraft);
    return { saved: true };
  }

  async remove({ sourceUrl }: { sourceUrl: string }): Promise<{ removed: boolean }> {
    await this.store().remove(draftKey(sourceUrl));
    return { removed: true };
  }
}
