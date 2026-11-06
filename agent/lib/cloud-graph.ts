import { createHash, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AppError, config } from './db.ts';
import { categories, redact, sensitive, topics } from './memory.ts';

const name = 'aguirra_visitor';
export function visitor(request: Request) {
  const existing = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
  const valid = existing && /^[0-9a-f]{64}$/.test(existing);
  const token = valid ? existing : randomBytes(32).toString('hex');
  return { owner: namespace('visitor:' + token), cookies: valid ? [] : [name + '=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000' + (new URL(request.url).protocol === 'https:' ? '; Secure' : '')], existing: !!valid };
}
export function namespace(value: string) {
  if (!process.env.AGUIRRA_GUEST_SECRET) throw new AppError(503, 'O núcleo na nuvem está indisponível.');
  return createHmac('sha256', process.env.AGUIRRA_GUEST_SECRET).update('graph/v1/' + value).digest('hex');
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function store(owner: string, operation: string, items: any[] = [], lookup = '') {
  const { url, key } = config();
  const resp = await fetch(url + '/rest/v1/rpc/aguirra_graph_store', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ server_token: process.env.AGUIRRA_GUEST_SECRET, owner_key: owner, operation, items, lookup }), signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new AppError(503, 'Não consegui acessar seu núcleo no Supabase. Tente novamente.');
  const raw = await resp.text();
  return raw ? JSON.parse(raw) : null;
}
export function item(kind: string, key: string, value: any) { return { kind, key, value: { ...value, kind } }; }
export async function visitorData(owner: string) {
  const rows: any[] = await store(owner, 'read');
  const messages = rows.filter(r => r.kind === 'message').sort((a,b) => a.created_at.localeCompare(b.created_at) || (a.role === 'user' ? -1 : 1));
  const memories = rows.filter(r => r.kind === 'memory');
  const counts = new Map<string, number>();
  for (const m of messages.filter(r => r.role === 'user')) for (const t of topics(m.content)) counts.set(t, (counts.get(t) || 0) + 1);
  return { messages, memories, threads: [], topics: [...counts].map(([name,count]) => ({ name,count })), settings: rows.find(r => r.kind === 'setting') || { memory_enabled: true } };
}
export const legacyBatch = z.object({
  messages: z.array(z.object({ id:z.string().uuid(), role:z.enum(['user','assistant']), content:z.string().min(1).max(40000), reply_id:z.string().uuid().nullish(), created_at:z.string().datetime({offset:true}), failed:z.boolean().optional(), exclude_context:z.boolean().optional(), sources:z.array(z.object({title:z.string().max(300),url:z.string().url().max(2000)})).max(12).optional() })).max(50).default([]),
  memories: z.array(z.object({category:z.enum(categories),key:z.string().min(1).max(100),content:z.string().min(3).max(500)})).max(50).default([])
});
export function importedItems(input: z.infer<typeof legacyBatch>) {
  if(input.memories.some(m=>sensitive(m.content))) throw new AppError(400,'O histórico anterior contém uma nota sensível. A cópia original foi preservada.');
  return [...input.messages.map(m => item('message', m.id, { ...m, content:redact(m.content), sources:(m.sources || []).filter(s => s.url.startsWith('https://')) })),
    ...input.memories.filter(m => !sensitive(m.content)).map(m => item('memory', m.key, { ...m,id:stableId(m.key),origin:'manual',updated_at:new Date().toISOString() }))];
}
export function stableId(key: string) {
  const s = digest(key);
  return [s.slice(0,8),s.slice(8,12),'5'+s.slice(13,16),'9'+s.slice(17,20),s.slice(20,32)].join('-');
}
