/**
 * Formatting: transformación pura de texto en Markdown/HTML.
 *
 * Funciones puras, sin I/O ni efectos de lado — el mismo criterio que
 * validation.ts (Fase 1.2). El add-on `addon-markdown` registra un servicio
 * `textFormatter` construido sobre estas funciones canónicas.
 */

/**
 * Convierte texto fuente en texto plano en Markdown.
 *
 * Convención de formato:
 * - La primera línea se usa como título (título corto antes del primer punto).
 * - Los párrafos separados por línea en blanco se conservan.
 * - Líneas que empiezan por '- ' se interpretan como ítems de lista.
 * - La primera línea se convierte en encabezado `#`.
 */
export function toMarkdown(title: string, content: string): string {
  const body = content.trim().split(/\n{2,}/);
  const md = body.map((p) => p.trim()).filter((p) => p.length > 0).join('\n\n');
  return `# ${title}\n\n${md}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linesToHtmlBlocks(source: string): string[] {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length > 0) {
      blocks.push(`<ul>\n${list.map((li) => `  <li>${li}</li>`).join('\n')}\n</ul>`);
      list = [];
    }
  };
  for (const line of source.split('\n')) {
    if (line.startsWith('- ')) {
      list.push(escapeHtml(line.slice(2)));
      continue;
    }
    flush();
    if (line.trim().length > 0) blocks.push(`<p>${escapeHtml(line)}</p>`);
  }
  flush();
  return blocks;
}

/**
 * Convierte Markdown simple en HTML. Soporta:
 * - Encabezado `# \` al inicio.
 * - Listas no ordenadas (\`- \`).
 * - Párrafos separados por línea en blanco.
 */
export function htmlFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  let heading: string | null = null;
  let body = '';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ') && heading === null) {
      heading = escapeHtml(lines[i].slice(2));
      continue;
    }
    body += lines[i] === '' ? '\n' : lines[i] + '\n';
  }

  const blocks = heading
    ? `<h1>${heading}</h1>\n${htmlFromMarkdownBody(body)}`
    : htmlFromMarkdownBody(markdown);
  return blocks;
}

function htmlFromMarkdownBody(source: string): string {
  return blocksToHtml(source).join('\n');
}

/** Da de respuesta los bloques HTML (reutiliza la lógica de lista). */
export function blocksToHtml(source: string): string[] {
  return htmlBlocks(source);
}

function htmlBlocks(source: string): string[] {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length > 0) {
      blocks.push(`<ul>\n${list.map((li) => `  <li>${li}</li>`).join('\n')}\n</ul>`);
      list = [];
    }
  };
  for (const line of source.split('\n')) {
    if (line.startsWith('- ')) {
      list.push(escapeHtml(line.slice(2)));
      continue;
    }
    flush();
    if (line.trim().length > 0) blocks.push(`<p>${escapeHtml(line)}</p>`);
  }
  flush();
  return blocks;
}

/** Contrato del servicio que registra `addon-markdown`. */
export interface TextFormatter {
  /** Serializa [título, contenido] a un objeto con Markdown y HTML. */
  format(source: { title: string; content: string }): { title: string; markdown: string; html: string };
}

/** Implementación canónica (pure) de TextFormatter usa toMarkdown + htmlFromMarkdown. */
export const createTextFormatter = (): TextFormatter => ({
  format({ title, content }) {
    const md = toMarkdown(title, content);
    return { title, markdown: md, html: htmlFromMarkdown(md) };
  },
});
