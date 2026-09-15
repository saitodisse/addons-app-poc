import { describe, expect, it } from 'vitest';
import { createTextFormatter, manifest } from './index';

describe('createTextFormatter', () => {
  it('converts title and content into coherent markdown', () => {
    const f = createTextFormatter();
    const out = f.format({ title: 'Ode', content: 'A beautiful thing.\n\n- v1\n- v2' });
    expect(out.title).toBe('Ode');
    expect(out.markdown.startsWith('# Ode')).toBe(true);
    expect(out.html).toContain('<h1>Ode</h1>');
    expect(out.html).toContain('<li>v1</li>');
  });

  it('escapes embedded HTML to prevent injection', () => {
    const f = createTextFormatter();
    const html = f.format({ title: 'x', content: '<script>alert(1)</script>' }).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('manifest', () => {
  it('declares the textFormatter service', () => {
    expect(manifest.id).toBe('markdown');
    expect(manifest.contract.services.map((s) => s.id)).toContain('addons.markdown.text-formatter');
  });
});
