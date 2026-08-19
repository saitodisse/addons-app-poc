/**
 * Cliente da API pública de citações (DummyJSON Quotes).
 * O fetch é injetável para testes — o mesmo padrão usado no core.
 *
 * Observação: a API não possui endpoint de busca; o add-on baixa um lote
 * (processamento externo) e filtra localmente em handlers.js.
 */
export function createQuotesApi({ fetchFn = (url) => fetch(url), baseUrl = 'https://dummyjson.com/quotes' } = {}) {
  async function getJson(url) {
    const res = await fetchFn(url);
    if (!res.ok) {
      throw new Error(`API externa respondeu HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    /** Citações da API (lote). */
    async popular(limit = 30) {
      const data = await getJson(`${baseUrl}?limit=${limit}`);
      return data.quotes ?? [];
    },

    /** Busca uma citação por id (recurso text/content). */
    async byId(id) {
      const data = await getJson(`${baseUrl}/${id}`);
      return data;
    },
  };
}