import { describe, expect, it } from 'vitest';
import { catalog, search, text, content } from './handlers.js';

describe('addon-text-biblioteca handlers', () => {
  it('catalog devuelve metas para un catálogo', async () => {
    const payload = await catalog('text', 'destaques');
    expect(payload.metas.length).toBeGreaterThan(0);
    expect(payload.metas[0]).toHaveProperty('id');
    expect(payload.metas[0]).toHaveProperty('name');
    expect(payload.metas[0].type).toBe('text');
  });

  it('catalog filtra por categoría', async () => {
    const payload = await catalog('text', 'natureza');
    expect(payload.metas[0].name).toBe('O Amanhecer');
  });

  it('catalog con catálogo desconocido devuelve todos', async () => {
    const payload = await catalog('text', 'no-existe');
    expect(payload.metas.length).toBeGreaterThan(0);
  });

  it('search devuelve metas por término', async () => {
    const payload = await search('text', 'chuva');
    expect(payload.metas[0].name).toBe('Chuva de Verão');
  });

  it('search sin resultados devuelve lista vacía', async () => {
    const payload = await search('text', 'zzzzz');
    expect(payload.metas).toEqual([]);
  });

  it('text devuelve items con url de contenido', async () => {
    const payload = await text('text', 'chuva');
    expect(payload.texts.length).toBe(1);
    expect(payload.texts[0].lang).toBe('pt');
    expect(payload.texts[0].url).toBe('/text/text/chuva/content.txt');
  });

  it('text con id desconocido lanza error', async () => {
    await expect(text('text', 'nada')).rejects.toThrow('Texto no encontrado');
  });

  it('content devuelve el texto completo', async () => {
    const body = await content('text', 'maquina');
    expect(body).toContain('máquina');
    expect(typeof body).toBe('string');
  });
});
