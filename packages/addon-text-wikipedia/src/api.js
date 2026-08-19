/**
 * Cliente da API pública da Wikipédia (opensearch + resumo REST v1).
 * O fetch é injetável para testes — o mesmo padrão usado no core.
 */
export function createWikipediaApi({
  fetchFn = (url) => fetch(url),
  lang = 'pt',
} = {}) {
  const api = `https://${lang}.wikipedia.org`;

  async function getJson(url) {
    const res = await fetchFn(url);
    if (!res.ok) {
      throw new Error(`API externa respondeu HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    /** Busca títulos na Wikipédia (opensearch). Retorna [{ title, description, url }]. */
    async search(query, limit = 10) {
      const url =
        `${api}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
        `&limit=${limit}&namespace=0&format=json&origin=*`;
      const data = await getJson(url);
      if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
      const [, titles = [], descriptions = [], urls = []] = data;
      return titles.map((title, i) => ({
        title,
        description: descriptions[i] ?? '',
        url: urls[i] ?? '',
      }));
    },

    /** Artigos aleatórios (list=random). Retorna títulos. */
    async random(count = 10) {
      const url =
        `${api}/w/api.php?action=query&list=random&rnnamespace=0` +
        `&rnlimit=${count}&format=json&origin=*`;
      const data = await getJson(url);
      return (data?.query?.random ?? []).map((r) => r.title).filter(Boolean);
    },

    /** Resumo de um artigo (REST v1 page-summary). */
    async summary(title) {
      const url = `${api}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      return getJson(url);
    },
  };
}
