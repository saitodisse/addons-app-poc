import { build } from 'esbuild';
const directory = process.argv[2];
if (!/^addon-[a-z-]+$/.test(directory ?? '')) throw new Error('Expected an add-on directory.');
const root = new URL(`../packages/${directory}/`, import.meta.url);
await build({ entryPoints: [new URL('src/browser.js', root).pathname], outfile: new URL('dist/bundle.js', root).pathname, bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
