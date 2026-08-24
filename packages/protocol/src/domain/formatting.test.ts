import { describe, expect, it } from 'vitest';
import { toMarkdown, htmlFromMarkdown, createTextFormatter } from './formatting';

describe('toMarkdown', () => {
  it('convierte título y contenido en encabezado + párrafos', () => {
    const md = toMarkdown('Mi cuento', 'Primer párrafo.\n\nSegundo párrafo.');
    expect(md).toBe('# Mi cuento\n\nPrimer párrafo.\n\nSegundo párrafo.');
  });

  it('colapsa líneas en blanco repetidas y recorta espacios', () => {
    const md = toMarkdown('T', '  hola   \n\n\n\n  mundo  ');
    expect(md).toBe('# T\n\nhola\n\nmundo');
  });
});

describe('htmlFromMarkdown', () => {
  it('convierte el encabezado en h1', () => {
    const html = htmlFromMarkdown('# Título\n\nContenido.');
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<p>Contenido.</p>');
  });

  it('convierte líneas con guion en lista no ordenada', () => {
    const html = htmlFromMarkdown('# Notas\n\n- uno\n- dos');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>uno</li>');
    expect(html).toContain('<li>dos</li>');
  });

  it('escapa HTML embebido para evitar inyección', () => {
    const html = htmlFromMarkdown('# x\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('createTextFormatter', () => {
  it('produce markdown y html coherentes', () => {
    const f = createTextFormatter();
    const out = f.format({ title: 'Oda', content: 'Algo bello.\n\n- v1\n- v2' });
    expect(out.title).toBe('Oda');
    expect(out.markdown.startsWith('# Oda')).toBe(true);
    expect(out.html).toContain('<h1>Oda</h1>');
    expect(out.html).toContain('<li>v1</li>');
  });
});
