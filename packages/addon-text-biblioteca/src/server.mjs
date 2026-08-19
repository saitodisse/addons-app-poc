import { createAddonServer } from '@addons/addon-server';
import { manifest } from './manifest.js';
import { catalog, search, text, content } from './handlers.js';

const port = Number(process.env.PORT ?? 5291);

const server = await createAddonServer({
  manifest,
  port,
  name: manifest.id,
  handlers: { catalog, search, text, content },
});

console.log(`[${manifest.name}] escuchando en ${server.url}`);
console.log(`[${manifest.name}] manifesto: ${server.manifestUrl}`);