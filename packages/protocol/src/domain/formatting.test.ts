import { describe, expect, it } from 'vitest';
import { toMarkdown, htmlFromMarkdown, createTextFormatter } from './formatting';

describe('toMarkdown', () => {
  it('converts title and content into a heading + paragraphs', () => {
    const md = toMarkdown('My story', 'First paragraph.\n\nSecond paragraph.');
    expect(md).toBe('# My story\n\nFirst paragraph.\n\nSecond paragraph.');
  });

  it('collapses repeated blank lines and trims spaces', () => {
    const md = toMarkdown('T', '  hello   \n\n\n\n  world  ');
    expect(md).toBe('# T\n\nhello\n\nworld');
  });
});

describe('htmlFromMarkdown', () => {
  it('converts the heading into h1', () => {
    const html = htmlFromMarkdown('# Title\n\nContent.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Content.</p>');
  });

  it('converts hyphenated lines into an unordered list', () => {
    const html = htmlFromMarkdown('# Notes\n\n- one\n- two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
  });

  it('escapes embedded HTML to prevent injection', () => {
    const html = htmlFromMarkdown('# x\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('createTextFormatter', () => {
  it('produces coherent markdown and HTML', () => {
    const f = createTextFormatter();
    const out = f.format({ title: 'Ode', content: 'A beautiful thing.\n\n- v1\n- v2' });
    expect(out.title).toBe('Ode');
    expect(out.markdown.startsWith('# Ode')).toBe(true);
    expect(out.html).toContain('<h1>Ode</h1>');
    expect(out.html).toContain('<li>v1</li>');
  });
});
