import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const hostRoot = new URL('../packages/host-app/', import.meta.url);
const hostPackage = JSON.parse(await readFile(new URL('package.json', hostRoot), 'utf8'));
const addonDependencies = Object.keys(hostPackage.dependencies ?? {}).filter((name) => name.startsWith('@addons/addon-'));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

const sourceRoot = new URL('src/', hostRoot);
const imports = [];
for (const file of await sourceFiles(sourceRoot.pathname)) {
  const source = await readFile(file, 'utf8');
  if (/['"]@addons\/addon-[^'"]+['"]/.test(source)) {
    imports.push(relative(hostRoot.pathname, file));
  }
}

if (addonDependencies.length || imports.length) {
  const problems = [
    addonDependencies.length && `dependências: ${addonDependencies.join(', ')}`,
    imports.length && `imports: ${imports.join(', ')}`,
  ].filter(Boolean).join('; ');
  throw new Error(`O host deve depender apenas do protocolo, nunca de implementações de add-on (${problems}).`);
}

console.log('Fronteira do host verificada: nenhuma dependência ou import de add-on.');
