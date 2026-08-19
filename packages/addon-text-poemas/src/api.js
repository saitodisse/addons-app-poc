/**
 * Cliente da API pública PoetryDB (poemas de domínio público).
 * O fetch é injetável para testes — o mesmo padrão usado no core.
 */
export function createPoetryApi({ fetchFn = (url) => fetch(url), baseUrl = 'https://poetrydb.org' } = {}) {
  async function getJson(url) {
    const res = await fetchFn(url);
    if (!res.ok) {
      if (res.status === 404) return null; // sem resultados não é erro
      throw new Error(`API externa respondeu HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    /** Poemas de um autor (match parcial, case-insensitive). */
    async byAuthor(author) {
      return (await getJson(`${baseUrl}/author/${encodeURIComponent(author)}`)) ?? [];
    },

    /** Poemas por título (match parcial). */
    async byTitle(title) {
      return (await getJson(`${baseUrl}/title/${encodeURIComponent(title)}`)) ?? [];
    },

    /** Poemas aleatórios. */
    async random(count = 20) {
      return (await getJson(`${baseUrl}/random/${count}`)) ?? [];
    },
  };
}