import type { HostAPI } from '@addons/core';

export const manifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Um add-on simples que saúda o usuário',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-hello/dist/bundle.js',
  services: [
    { id: 'greeter', version: '1.0.0', name: 'Greeter', description: 'Serviço de saudação' },
  ],
};

export function setup(host: HostAPI): void {
  host.registerService('greeter', {
    greet: (name: string) => `Olá, ${name}! Seja bem-vindo ao sistema de add-ons.`,
  });
  host.log('info', 'Add-on hello configurado com sucesso');
}