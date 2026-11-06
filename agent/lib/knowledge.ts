import { normalize } from './memory.ts';
export interface Document { title: string; url: string; content: string; }
const cache = new Map<string, { expires: number; documents: Document[] }>();
function remember(query: string, documents: Document[]) {
  if (cache.size >= 100) cache.clear();
  // Briefly cache failures too, so a slow source cannot stall every repeated question.
  cache.set(query, { expires: Date.now() + (documents.length ? 300000 : 30000), documents });
  return documents;
}
export function needsCurrent(message: string) { return /\b(hoje|agora|atual|atualmente|cotacao|preco|clima|cambio|dolar|presidente|eleicoes|resultado)\b|ultim[oa]s?\b/.test(normalize(message)); }
export function knowledgeQuery(message: string) {
  if (!/^(o que (e|sao|significa)|quem (e|foi)|qual (e )?a capital|explique|como funciona)/.test(normalize(message))) return null;
  return message.split(/[?!]/)[0].replace(/^(o que (é|e|são|sao|significa)|quem (é|e|foi)|qual (é |e )?a |explique( o| a)?|como funciona( o| a)?)/i, '').replace(/[?!]/g, '').trim().slice(0, 160);
}
export function parseKnowledge(data: any): Document[] {
  return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
    try { const url = new URL(page.fullurl); if (url.protocol !== 'https:' || url.hostname !== 'pt.wikipedia.org' || !page.extract) return []; return [{ title: String(page.title).slice(0, 180), url: url.href, content: String(page.extract).slice(0, 3000) }]; } catch { return []; }
  }).slice(0, 3);
}
export async function readKnowledge(message: string): Promise<Document[]> {
  const query = knowledgeQuery(message); if (!query || needsCurrent(message)) return [];
  const previous = cache.get(query); if (previous && previous.expires > Date.now()) return previous.documents;
  const url = new URL('https://pt.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '3', prop: 'extracts|info', exintro: '1', explaintext: '1', exlimit: '3', inprop: 'url', format: 'json' }).toString();
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Aguirra/1.0 (https://github.com/matheusaaguirra/Aguirra.Ai)', Accept: 'application/json' }, signal: AbortSignal.timeout(2500) });
    if (!response.ok) return remember(query, []);
    const raw = await response.text(); if (raw.length > 1000000) return remember(query, []);
    const terms = normalize(query).split(/\W+/).filter(w => w.length > 2 && !['que', 'uma', 'das', 'dos', 'como'].includes(w));
    const documents = parseKnowledge(JSON.parse(raw)).filter(d => terms.some(w => normalize(d.title).includes(w)));
    return remember(query, documents);
  } catch { return remember(query, []); }
}
