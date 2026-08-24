import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonStateStore, AddonTab, HostAPI } from '@addons-poc/protocol';
import { MemoryBookmarkStore } from './memory-bookmark-store';
import type { Bookmark, BookmarkStore } from './bookmarks';
import { createTabStatePersistence } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'favorites',
  version: '1.0.0',
  name: 'Favorites Add-on',
  description: 'Favoritos que persistem somente quando um add-on de armazenamento está ativo',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '⭐ Favoritos',
    body: 'Guarde, consulte e remova favoritos usando o armazenamento do host.',
  },
  entrypoint: '/packages/addon-favorites/dist/bundle.js',
  services: [
    { id: 'addons.favorites', version: '1.0.0', name: 'Favorites', description: 'Lista/adiciona/remove favoritos' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.favorites', role: 'provides', version: '1.0.0', description: 'Lista, inclui e remove favoritos.', methods: [{ id: 'list', description: 'Lista favoritos.', returns: { description: 'Lista de favoritos.', schema: { type: 'array', description: 'Favoritos salvos.', classification: 'personal' } } }, { id: 'add', description: 'Inclui um favorito.', receives: { description: 'Título e URL opcional.', schema: { type: 'object', description: 'Dados do favorito.', classification: 'personal', properties: { title: { type: 'string', description: 'Título do favorito.', classification: 'personal' }, url: { type: 'string', description: 'URL opcional.', classification: 'personal', format: 'uri' } }, required: ['title'] } }, returns: { description: 'Favorito criado.', schema: { type: 'object', description: 'Favorito salvo.', classification: 'personal' } } }, { id: 'remove', description: 'Remove um favorito pelo ID.', receives: { description: 'ID do favorito.', schema: { type: 'string', description: 'Identificador do favorito.', classification: 'personal' } }, returns: { description: 'Indica se houve remoção.', schema: { type: 'boolean', description: 'Resultado da remoção.', classification: 'public' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Persiste favoritos quando disponível.', required: false, methods: [{ id: 'get', description: 'Lê favoritos.' }, { id: 'set', description: 'Grava favoritos.' }] }],
    ui: { fields: [{ id: 'title', label: 'Título', description: 'Nome do favorito.', required: true, schema: { type: 'string', description: 'Título informado.', classification: 'personal' } }, { id: 'url', label: 'URL', description: 'Endereço opcional associado ao favorito.', schema: { type: 'string', description: 'URL informada.', classification: 'personal', format: 'uri' } }, { id: 'id', label: 'ID para remover', description: 'Identificador do favorito a remover.', required: true, schema: { type: 'string', description: 'ID informado.', classification: 'personal' } }], actions: [{ id: 'add', label: 'Adicionar', description: 'Salva um favorito.', receives: ['title', 'url'], returns: { description: 'Favorito salvo.', schema: { type: 'object', description: 'Resposta da inclusão.', classification: 'personal' } } }, { id: 'list', label: 'Listar', description: 'Mostra favoritos salvos.', returns: { description: 'Lista de favoritos.', schema: { type: 'array', description: 'Favoritos.', classification: 'personal' } } }, { id: 'remove', label: 'Remover', description: 'Remove o favorito pelo ID.', receives: ['id'], returns: { description: 'Resultado da remoção.', schema: { type: 'object', description: 'Resposta da remoção.', classification: 'public' } } }] },
    state: [{ id: 'list', description: 'Lista de favoritos criados pela pessoa.', key: 'favorites:list', operations: ['read', 'write', 'remove'], value: { description: 'Favoritos salvos.', schema: { type: 'array', description: 'Favoritos.', classification: 'personal' } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Remoção individual, limpeza do provedor ou dados do navegador.', fallback: 'memory' }, { id: 'tab', description: 'Campos e última resposta da aba.', key: 'favorites:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Campos e resposta.', classification: 'personal' } }, retention: 'Enquanto o provedor conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on favorites configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
});

/** Serviço de favoritos: consome BookmarkStore (com degradação a memória). */
export function createFavoritesService(store: BookmarkStore = new MemoryBookmarkStore()) {
  return {
    list: () => store.list(),
    add: (title: string, url?: string) => store.save({ title, url }),
    remove: (id: string) => store.remove(id),
  };
}

/** Favoritos que migram da memória para o add-on de armazenamento quando ele estiver ativo. */
export function createOptionalStateFavoritesService(host: Pick<HostAPI, 'services'>) {
  let transientItems: Bookmark[] = [];
  let nextId = 1;

  const read = async (): Promise<Bookmark[]> => {
    const store = host.services.use<AddonStateStore>({ id: 'state-store' });
    if (!store) return [...transientItems].sort((a, b) => b.createdAt - a.createdAt);
    const saved = await store.get<Bookmark[]>('favorites:list');
    if (saved) return saved.sort((a, b) => b.createdAt - a.createdAt);
    if (transientItems.length) await store.set('favorites:list', transientItems);
    return transientItems;
  };

  const write = async (items: Bookmark[]) => {
    const store = host.services.use<AddonStateStore>({ id: 'state-store' });
    if (store) {
      await store.set('favorites:list', items);
      return;
    }
    transientItems = items;
  };

  return {
    list: read,
    async add(input: { title: string; url?: string } | string, legacyUrl?: string): Promise<Bookmark> {
      const title = typeof input === 'string' ? input : input.title;
      const url = typeof input === 'string' ? legacyUrl : input.url;
      const favorite: Bookmark = { id: `favorite-${Date.now()}-${nextId++}`, title, url, createdAt: Date.now() };
      await write([favorite, ...(await read())]);
      return favorite;
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      const remaining = current.filter((item) => item.id !== id);
      if (remaining.length === current.length) return false;
      await write(remaining);
      return true;
    },
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.favorites', createOptionalStateFavoritesService(host));
  host.log('info', 'Add-on favorites configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const favorites = host.services.use<ReturnType<typeof createOptionalStateFavoritesService>>({ id: 'addons.favorites' });
  return {
    ...manifest.contract.ui,
    fields: [
      { id: 'title', label: 'Título', placeholder: 'Nome do favorito', required: true },
      { id: 'url', label: 'URL', type: 'url', placeholder: 'https://exemplo.com' },
      { id: 'id', label: 'ID para remover', placeholder: 'Copie o ID exibido na lista', required: true },
    ],
    actions: [
      { id: 'add', label: 'Adicionar' },
      { id: 'list', label: 'Listar', variant: 'secondary' },
      { id: 'remove', label: 'Remover', variant: 'danger' },
    ],
    persistence: createTabStatePersistence(host, 'favorites:tab'),
    async run(actionId, values) {
      if (!favorites) return { status: 'error', body: 'Serviço de favoritos indisponível.' };
      if (actionId === 'add') {
        const title = values.title?.trim();
        if (!title) {
          host.log('warn', 'Favorito recusado: título ausente');
          return { status: 'error', body: 'Digite um título para o favorito.' };
        }
        const favorite = await favorites.add({ title, url: values.url?.trim() || undefined });
        host.log('info', 'Favorito adicionado', { id: favorite.id, title: favorite.title });
        return { status: 'success', title: 'Favorito salvo', body: favorite.title, items: [{ label: 'ID', value: favorite.id }] };
      }
      if (actionId === 'remove') {
        const id = values.id?.trim();
        if (!id) {
          host.log('warn', 'Remoção de favorito recusada: ID ausente');
          return { status: 'error', body: 'Informe o ID do favorito que deve ser removido.' };
        }
        const removed = await favorites.remove(id);
        host.log(removed ? 'info' : 'warn', 'Remoção de favorito concluída', { id, removed });
        return { status: removed ? 'success' : 'error', body: removed ? 'Favorito removido.' : 'Favorito não encontrado.' };
      }
      if (actionId === 'list') {
        const list = await favorites.list();
        host.log('info', 'Lista de favoritos consultada', { count: list.length });
        return {
          status: 'info',
          title: `${list.length} favorito(s)`,
          body: list.length ? 'Use o ID para remover um item.' : 'Nenhum favorito salvo.',
          items: list.map((item) => ({ label: item.title, value: `${item.id}${item.url ? ` · ${item.url}` : ''}` })),
        };
      }
      return { status: 'error', body: 'Ação desconhecida.' };
    },
  };
}
