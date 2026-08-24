import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonTab, HostAPI } from '@addons-poc/protocol';
import { createTabStatePersistence } from '@addons-poc/protocol';
import { toMarkdown, htmlFromMarkdown } from './formatting';

export const manifest = defineAddonManifest({
  id: 'markdown',
  version: '1.0.0',
  name: 'Markdown Add-on',
  description: 'Formatação de textos em Markdown e HTML (consumidor de serviços)',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '📝 Markdown',
    body: 'Transforme um título e um conteúdo em Markdown e HTML.',
  },
  entrypoint: '/packages/addon-markdown/dist/bundle.js',
  services: [
    { id: 'addons.markdown.text-formatter', version: '1.0.0', name: 'Text Formatter', description: 'Formata título+conteúdo em Markdown/HTML' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.markdown.text-formatter', role: 'provides', version: '1.0.0', description: 'Converte título e conteúdo para Markdown e HTML.', methods: [{ id: 'format', description: 'Formata um texto.', receives: { description: 'Título e conteúdo do texto.', schema: { type: 'object', description: 'Dados do texto.', classification: 'personal', properties: { title: { type: 'string', description: 'Título.', classification: 'personal' }, content: { type: 'string', description: 'Conteúdo.', classification: 'personal' } }, required: ['title', 'content'] } }, returns: { description: 'Texto em Markdown e HTML.', schema: { type: 'object', description: 'Texto formatado.', classification: 'personal' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Guarda a aba quando um provedor de estado está ativo.', required: false, methods: [{ id: 'get', description: 'Lê a aba salva.' }, { id: 'set', description: 'Grava a aba.' }] }],
    ui: { fields: [{ id: 'title', label: 'Título', description: 'Título do texto a formatar.', required: true, schema: { type: 'string', description: 'Título informado.', classification: 'personal' } }, { id: 'content', label: 'Conteúdo', description: 'Conteúdo do texto a formatar.', required: true, schema: { type: 'string', description: 'Conteúdo informado.', classification: 'personal' } }], actions: [{ id: 'format', label: 'Formatar', description: 'Gera Markdown e HTML localmente.', receives: ['title', 'content'], returns: { description: 'Markdown exibido e HTML como item da resposta.', schema: { type: 'object', description: 'Texto formatado.', classification: 'personal' } } }] },
    state: [{ id: 'tab', description: 'Campos e última formatação exibida.', key: 'markdown:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Título, conteúdo e resposta.', classification: 'personal' } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on markdown configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
});

/** Construtor do serviço de formatação, mantido dentro deste add-on. */
export function createTextFormatter() {
  return {
    format(source: { title: string; content: string }) {
      const md = toMarkdown(source.title, source.content);
      return { title: source.title, markdown: md, html: htmlFromMarkdown(md) };
    },
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.markdown.text-formatter', createTextFormatter());
  host.log('info', 'Add-on markdown configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const formatter = host.services.use<ReturnType<typeof createTextFormatter>>({ id: 'addons.markdown.text-formatter' });
  return {
    ...manifest.contract.ui,
    fields: [
      { id: 'title', label: 'Título', placeholder: 'Título do texto', required: true },
      { id: 'content', label: 'Conteúdo', type: 'textarea', placeholder: 'Escreva o conteúdo', required: true },
    ],
    actions: [{ id: 'format', label: 'Formatar' }],
    persistence: createTabStatePersistence(host, 'markdown:tab'),
    run(actionId, values) {
      if (actionId !== 'format') return { status: 'error', body: 'Ação desconhecida.' };
      if (!formatter) return { status: 'error', body: 'Serviço de formatação indisponível.' };
      const title = values.title?.trim();
      const content = values.content?.trim();
      if (!title || !content) {
        host.log('warn', 'Formatação recusada: campos ausentes');
        return { status: 'error', body: 'Preencha título e conteúdo.' };
      }
      const formatted = formatter.format({ title, content });
      host.log('info', 'Texto formatado', { title, characters: content.length });
      return {
        status: 'success',
        title: 'Texto formatado',
        body: formatted.markdown,
        items: [{ label: 'HTML', value: formatted.html }],
      };
    },
  };
}
