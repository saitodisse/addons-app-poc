/**
 * Formatting: pure text transformation to Markdown/HTML.
 *
 * Pure functions without I/O or side effects, following the same criterion as
 * validation.ts (Phase 1.2). The `addon-markdown` add-on registers a
 * `textFormatter` service built on these canonical functions.
 */

/**
 * Converts source text into plain-text Markdown.
 *
 * Formatting convention:
 * - The first line is used as the title (short title before the first period).
 * - Paragraphs separated by a blank line are preserved.
 * - Lines starting with '- ' are interpreted as list items.
 * - The first line becomes a `#` heading.
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
 * Converts simple Markdown to HTML. Supports:
 * - A `# ` heading at the start.
 * - Unordered lists (`- `).
 * - Paragraphs separated by a blank line.
 */
export function htmlFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  let heading: string | null = null;
  let body = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('# ') && heading === null) {
      heading = escapeHtml(line.slice(2));
      continue;
    }
    body += line === '' ? '\n' : line + '\n';
  }

  const blocks = heading
    ? `<h1>${heading}</h1>\n${htmlFromMarkdownBody(body)}`
    : htmlFromMarkdownBody(markdown);
  return blocks;
}

function htmlFromMarkdownBody(source: string): string {
  return blocksToHtml(source).join('\n');
}

/** Returns HTML blocks, reusing the list logic. */
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

/** Contract for the service registered by `addon-markdown`. */
export interface TextFormatter {
  /** Serializes [title, content] into an object with Markdown and HTML. */
  format(source: { title: string; content: string }): { title: string; markdown: string; html: string };
}

/** Canonical (pure) TextFormatter implementation using toMarkdown + htmlFromMarkdown. */
export const createTextFormatter = (): TextFormatter => ({
  format({ title, content }) {
    const md = toMarkdown(title, content);
    return { title, markdown: md, html: htmlFromMarkdown(md) };
  },
});
