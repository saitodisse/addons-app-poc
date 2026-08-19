import type { HostAPI } from '@addons/core';
import { toMarkdown, htmlFromMarkdown } from '@addons/core';

export const manifest = {
  id: 'markdown',
  version: '1.0.0',
  name: 'Markdown Add-on',
  description: 'Formatação de textos em Markdown e HTML (consumidor de serviços)',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-markdown/dist/bundle.js',
  services: [
    { id: 'textFormatter', version: '1.0.0', name: 'Text Formatter', description: 'Formata título+conteúdo em Markdown/HTML' },
  ],
};

/** Construtor do serviço de formatação (usa helpers puros do núcleo). */
export function createTextFormatter() {
  return {
    format(source: { title: string; content: string }) {
      const md = toMarkdown(source.title, source.content);
      return { title: source.title, markdown: md, html: htmlFromMarkdown(md) };
    },
  };
}

export function setup(host: HostAPI): void {
  host.registerService('textFormatter', createTextFormatter());
  host.log('info', 'Add-on markdown configurado com sucesso');
}
