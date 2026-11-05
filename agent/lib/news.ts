import { XMLParser } from "fast-xml-parser";
import { normalize } from "./memory.ts";
export interface NewsItem { title: string; url: string; description: string; published_at: string | null; source: string; }
const feeds = {
  brasil: "https://feeds.bbci.co.uk/portuguese/rss.xml",
  eua: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  mundo: "https://feeds.bbci.co.uk/news/world/rss.xml",
  tecnologia: "https://feeds.bbci.co.uk/news/technology/rss.xml",
};
const cache = new Map<string, { expires: number; items: NewsItem[] }>();
function clean(value: unknown) { return String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }
export function parseFeed(xml: string, source = "BBC News"): NewsItem[] {
  if (xml.length > 1_500_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Feed inválido.");
  const parsed = new XMLParser({ ignoreAttributes: true, processEntities: true, parseTagValue: false }).parse(xml);
  const raw = parsed?.rss?.channel?.item || []; const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item: any) => ({ title: clean(item.title).slice(0, 200), url: clean(item.link), description: clean(item.description).slice(0, 450), published_at: Number.isNaN(Date.parse(item.pubDate || "")) ? null : new Date(item.pubDate).toISOString(), source })).filter((item: NewsItem) => { try { const url = new URL(item.url); return url.protocol === "https:" && (url.hostname === "bbc.com" || url.hostname.endsWith(".bbc.com") || url.hostname === "bbc.co.uk" || url.hostname.endsWith(".bbc.co.uk")); } catch { return false; } });
}
export function selectArticles(items: NewsItem[], query: string): NewsItem[] {
  const queryText = normalize(query);
  if (/brasil|brazil/.test(queryText)) items = items.filter(item => /brasil|brazil/.test(normalize(item.title + ' ' + item.description)));
  if (/estados unidos|\beua\b|united states/.test(queryText)) items = items.filter(item => /\b(?:us|usa|united states|estados unidos|eua|american|trump|washington|congress|white house|senate|new york|florida|california|texas)\b/.test(normalize(item.title + ' ' + item.description)));
  const stop = new Set('o a os as que e esta ta acontecendo acontece no na nos nas em de do da dos das para por um uma quais qual sao ultimas ultima noticias noticia manchetes manchete sobre com hoje agora recentes recente me mostre traga quero saber brasil brazil estados unidos eua mundo america tecnologia'.split(' '));
  const words = normalize(query).split(/\W+/).filter(w => w.length > 2 && !stop.has(w)).map(w => w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
  if (!words.length) return items.slice(0, 6);
  return items.filter(item => { const text = normalize(item.title + ' ' + item.description); return words.every(w => text.includes(w)); }).slice(0, 6);
}
export async function readNews(query: string) {
  const text = normalize(query), region: keyof typeof feeds = /estados unidos|\beua\b|america|united states/.test(text) ? "eua" : /brasil|brazil/.test(text) ? "brasil" : /tecnologia|inteligencia artificial|software/.test(text) ? "tecnologia" : "mundo";
  const previous = cache.get(region); let items: NewsItem[];
  if (previous && previous.expires > Date.now()) items = previous.items;
  else { const response = await fetch(feeds[region], { signal: AbortSignal.timeout(12000), headers: { Accept: "application/rss+xml, application/xml, text/xml" } }); if (!response.ok) throw new Error("O feed de notícias não respondeu."); items = parseFeed(await response.text(), region === "brasil" ? "BBC News Brasil" : "BBC News"); cache.set(region, { expires: Date.now() + 5 * 60000, items }); }
  return { region, checked_at: new Date().toISOString(), scope: "Manchetes de feeds RSS públicos da BBC. Não é busca de toda a web nem cobertura completa.", articles: selectArticles(items, query) };
}
export function headlinesText(result: Awaited<ReturnType<typeof readNews>>) {
  if (!result.articles.length) return "Não encontrei manchetes sobre o assunto pedido no feed consultado. Esse feed é limitado e não substitui uma pesquisa do Google; a pesquisa integrada do Google não está disponível no plano gratuito usado por este projeto.";
  return "Estas são as manchetes recentes do feed consultado. Não é uma cobertura completa dos acontecimentos.\n\n" + result.articles.map((item, i) => `${i + 1}. ${item.title}\n${item.description}\nFonte: ${item.source}${item.published_at ? " · " + new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.published_at)) : ""}\n${item.url}`).join("\n\n") + "\n\nConsulta em " + result.checked_at + ". As manchetes internacionais podem estar em inglês.";
}
