import { describe, expect, it } from 'vitest';
import { hideTablature } from './hideTablature';
import { parseTab } from './parseTab';

const ARM = ['E|----8-8-----7-7----------12---------------| ', 'B|-----------------------------12----12-----| ', 'G|-----------------------------------12-----| ', 'D|-0-------0--------------------------------| ', 'A|------------------------------------------| ', 'E|------------------------------------------| '].join('\n');
const VERSE = '[Primeira Parte]\n\n     Em  Em/F#    G\nMeu coração tá batendo\n   Em      Em/F#       G\nComo quem diz não tem jeito';
const visible = (text: string) => hideTablature(text).split('\n').filter((line) => line.trim()).join('\n');

describe('hideTablature', () => {
  it('removes the diagram and both preceding complements from the first example', () => {
    expect(visible(`Parte 3 de 3 - variação\n                G         H.N. .     .\n${ARM}\n\n${VERSE}`)).toBe(visible(VERSE));
  });

  it('removes a complete multipart solo but keeps its musical section and surrounding lyrics', () => {
    const before = ' Bm7   Em      Bm7       Em\nBobo, bola, balão, São João\n   C         G\nA gente se ilude dizendo\n    A      C    Em\nJá não há mais coração';
    const solo = `[Solo]\n\n[Tab - Solo - 2x]\n\nParte 1 de 3\n${ARM}\n\nParte 2 de 3\n${ARM}\n\nParte 3 de 3 - variação\n                           H.N..     .\n${ARM}`;
    expect(visible(`${before}\n\n${solo}\n\n${VERSE}`)).toBe(visible(`${before}\n\n[Solo]\n\n${VERSE}`));
  });

  it.each(['[Solo]', '[Intro]', '[Primeira Parte]', '(Volta ao início)', 'A morena girando a renda', 'Parte da minha vida', 'H.N. na minha vida'])('preserves unrelated text: %s', (line) => {
    expect(visible(`${line}\n\n${ARM}`)).toBe(line);
  });

  it('does not remove unaccompanied part and tab captions or chord lines', () => {
    const source = '[Tab - Solo - 2x]\nParte 1 de 3\nG Em\nMeu coração';
    expect(hideTablature(source)).toBe(source);
  });

  it('keeps indentation and line positions with CRLF input', () => {
    const source = `Parte 1 de 1\n${ARM}\n\n${VERSE}`;
    const result = hideTablature(source.replaceAll('\n', '\r\n'));
    expect(result.split('\n')).toHaveLength(source.split('\n').length);
    expect(result.endsWith(VERSE)).toBe(true);
  });

  it('recognizes bass, lower-case strings and alternate tuning', () => {
    expect(visible('Parte 1 de 1\ng|--2h3---|\nD|--0----|\nA|-------|\nE|-------|')).toBe('');
  });

  it.each(['e|--0h2p0/3\\2~--|', 'F#|--2---4--|', '1|--0---2--|'])('removes a single-string riff: %s', (riff) => {
    expect(visible(`Parte 1 de 1\n${riff}`)).toBe('');
  });

  it('keeps technique text when it is not next to a diagram', () => {
    expect(hideTablature('H.N. . .\nG\nMeu coração')).toBe('H.N. . .\nG\nMeu coração');
  });

  it('defaults to hidden in the parser and restores original text when disabled', () => {
    const source = `[Tab - Solo]\nParte 1 de 1\n  G H.N.\n${ARM}\n\n${VERSE}`;
    const hidden = parseTab(source);
    expect(hidden.body).toBe(source);
    expect(hidden.sections.map((section) => section.title)).toEqual(['Primeira Parte']);
    expect(hidden.diagnostics).toEqual([]);
    const shown = parseTab(source, { hideTablature: false });
    expect(shown.sections[0].title).toBe('Tab - Solo');
    expect(shown.sections.flatMap((section) => section.lines).some((line) => line.text.startsWith('E|'))).toBe(true);
  });
});
