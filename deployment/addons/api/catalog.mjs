import { catalog, search, text, content, contentJson } from '../../../packages/addon-chord-catalog/src/handlers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace(/^\/chord-catalog/, '');
  const baseUrl = `https://${req.headers.host}/chord-catalog/`;
  const options = { lang: url.searchParams.get('lang') ?? undefined };
  const rawLimit = url.searchParams.get('limit');
  const page = { ...(rawLimit === null ? {} : { limit: Number(rawLimit) }), ...(url.searchParams.has('cursor') ? { cursor: url.searchParams.get('cursor') } : {}), ...options };
  if (rawLimit !== null && (!Number.isSafeInteger(page.limit) || page.limit < 1)) return res.status(400).json({ error: 'Invalid limit parameter' });
  try {
    let match = path.match(/^\/(catalog|search)\/([^/]+)\/([^/]+)\.json$/);
    if (match) return res.json(await (match[1] === 'catalog' ? catalog : search)(decodeURIComponent(match[2]), decodeURIComponent(match[3]), page, { baseUrl }));
    match = path.match(/^\/text\/([^/]+)\/([^/]+)(?:\/content\.(txt|json)|\.json)$/);
    if (match) {
      const type = decodeURIComponent(match[1]); const id = decodeURIComponent(match[2]);
      if (match[3] === 'txt') return res.type('text/plain').send(await content(type, id, options));
      if (match[3] === 'json') { const result = await contentJson(type, id, options, { baseUrl }); return res.json(result.body); }
      return res.json(await text(type, id, options, { baseUrl }));
    }
    return res.status(404).json({ error: 'NOT_FOUND' });
  } catch (error) { return res.status(error.status ?? 500).json({ error: error.code ?? 'INTERNAL_ERROR', message: error.message }); }
}
