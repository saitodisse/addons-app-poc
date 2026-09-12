import { describe, expect, it } from 'vitest';
import { ehRotaDeResultado, rotaDoResultado, urlDoResultadoDaRota } from './router';

describe('rotas de resultados de pesquisa', () => {
  it('codifica e recupera a URL original do add-on em um único segmento', () => {
    const contentUrl = 'http://localhost:5294/text/page/Mam%C3%ADferos/content.txt';
    const route = rotaDoResultado(contentUrl);

    expect(route).toBe(`/article/${encodeURIComponent(contentUrl)}`);
    expect(ehRotaDeResultado(route)).toBe(true);
    expect(urlDoResultadoDaRota(route)).toBe(contentUrl);
  });

  it('rejeita rotas de artigo incompletas ou com esquemas não HTTP', () => {
    expect(ehRotaDeResultado('/article/')).toBe(true);
    expect(urlDoResultadoDaRota('/article/')).toBeNull();
    expect(urlDoResultadoDaRota(`/article/${encodeURIComponent('javascript:alert(1)')}`)).toBeNull();
    expect(urlDoResultadoDaRota('/settings')).toBeNull();
  });
});
