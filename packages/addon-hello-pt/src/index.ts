import type { HostAPI } from '@addons/core';

export const manifest = {
  id: 'hello-pt',
  version: '1.0.0',
  name: 'Hello PT Add-on',
  description: 'Versão em português do saudador (com prioridade maior)',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-hello-pt/dist/bundle.js',
  services: [
    { id: 'greeter', version: '1.0.0', name: 'Greeter', description: 'Serviço de saudação em português' },
  ],
};

export function setup(host: HostAPI): void {
  // Registra com prioridade 10 (maior que o hello padrão que é 0)
  host.registerService('greeter', {
    greet: (name: string) => {
      if (name.toLowerCase() === 'error') {
        throw new Error('Erro simulado no hello-pt');
      }
      return `E aí, ${name}! Tudo beleza? Saudação do add-on em português!`;
    },
  }, 10);

  host.log('info', 'Add-on hello-pt configurado com prioridade 10');
}