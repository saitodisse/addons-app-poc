import type { HostAPI } from '@addons/core';

export const manifest = {
  id: 'counter',
  version: '1.0.0',
  name: 'Counter Add-on',
  description: 'Um add-on simples de contador',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-counter/dist/bundle.js',
  services: [
    { id: 'counter', version: '1.0.0', name: 'Counter', description: 'Serviço de contagem' },
  ],
};

export function setup(host: HostAPI): void {
  let value = 0;

  host.registerService('counter', {
    increment: () => {
      value++;
      return value;
    },
    decrement: () => {
      value--;
      return value;
    },
    getValue: () => value,
    reset: () => {
      value = 0;
      return value;
    },
  });

  host.onUnload(() => {
    value = 0;
  });

  host.log('info', 'Add-on counter configurado com sucesso');
}