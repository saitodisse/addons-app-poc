import { describe, expect, it } from 'vitest';
import { createTextFormatter, manifest } from './index';

describe('createTextFormatter', () => {
  it('convierte título y contenido en markdown coherente', () => {
    const f = createTextFormatter();
    const out = f.format({ title: 'Oda', content: 'Algo bello.\n\n- v1\n- v2' });
    expect(out.title).toBe('Oda');
    expect(out.markdown.startsWith('# Oda')).toBe(true);
    expect(out.html).toContain('<h1>Oda</h1>');
    expect(out.html).toContain('<li>v1</li>');
  });

  it('escapa HTML embebido para evitar inyección', () => {
    const f = createTextFormatter();
    const html = f.format({ title: 'x', content: '<script>alert(1)</script>' }).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('manifest', () => {
  it('declara el serviço textFormatter', () => {
    expect(manifest.id).toBe('markdown');
    expect(manifest.services.map((s) => s.id)).toContain('textFormatter');
  });
});
