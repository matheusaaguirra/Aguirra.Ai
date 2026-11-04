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
  const parsed = new XMLParser({ ignoreAttributes: true, processEntities: false, parseTagValue: false }).parse(xml);
  const raw = parsed?.rss?.channel?.item || []; const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item: any) => ({ title: clean(item.title).slice(0, 200), url: clean(item.link), description: clean(item.description).slice(0, 450), published_at: Number.isNaN(Date.parse(item.pubDate || "")) ? null : new Date(item.pubDate).toISOString(), source })).filter((item: NewsItem) => { try { const url = new URL(item.url); return url.protocol === "https:" && (url.hostname === "bbc.com" || url.hostname.endsWith(".bbc.com") || url.hostname === "bbc.co.uk" || url.hostname.endsWith(".bbc.co.uk")); } catch { return false; } });
}
export async function readNews(query: string) {
  const text = normalize(query), region: keyof typeof feeds = /estados unidos|\beua\b|america|united states/.test(text) ? "eua" : /brasil|brazil/.test(text) ? "brasil" : /tecnologia|inteligencia artificial|software/.test(text) ? "tecnologia" : "mundo";
  const previous = cache.get(region); let items: NewsItem[];
  if (previous && previous.expires > Date.now()) items = previous.items;
  else { const response = await fetch(feeds[region], { signal: AbortSignal.timeout(12000), headers: { Accept: "application/rss+xml, application/xml, text/xml" } }); if (!response.ok) throw new Error("O feed de notícias não respondeu."); items = parseFeed(await response.text(), region === "brasil" ? "BBC News Brasil" : "BBC News"); cache.set(region, { expires: Date.now() + 5 * 60000, items }); }
  return { region, checked_at: new Date().toISOString(), scope: "Manchetes de feeds RSS públicos da BBC. Não é busca de toda a web nem cobertura completa.", articles: items.slice(0, 6) };
}
export function headlinesText(result: Awaited<ReturnType<typeof readNews>>) {
  if (!result.articles.length) return "O feed consultado não trouxe manchetes agora. Tente novamente mais tarde.";
  return "Estas são as manchetes recentes do feed consultado. Não é uma cobertura completa dos acontecimentos.\n\n" + result.articles.map((item, i) => `${i + 1}. ${item.title}\n${item.description}\nFonte: ${item.source}${item.published_at ? " · " + new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.published_at)) : ""}\n${item.url}`).join("\n\n") + "\n\nConsulta em " + result.checked_at + ". As manchetes internacionais podem estar em inglês.";
}
