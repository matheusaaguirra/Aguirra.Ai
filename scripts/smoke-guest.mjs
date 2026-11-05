// Public end-to-end checks: no account, cookies, credentials or paid API keys.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin = process.argv[2] || 'https://aguirra-ai.vercel.app';
async function request(path, payload, customOrigin = origin) {
  const response = await fetch(origin + path, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json', Origin: customOrigin } : {}, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(60000) });
  return { status: response.status, data: await response.json() };
}
function payload(message, extra = {}) { return { message, request_id: randomUUID(), ...extra }; }
const session = await request('/api/session'); assert.equal(session.status, 200); assert.equal(session.data.user, null); assert.equal(session.data.guest_chat, true);
const greeting = await request('/api/chat', payload('Olá Aguirra')); assert.equal(greeting.status, 200); assert.equal(greeting.data.guest, true); assert.match(greeting.data.reply, /sem precisar de conta/);
const clock = await request('/api/chat', payload('Que dia é hoje?')); assert.equal(clock.status, 200); assert.match(clock.data.reply, /Brasília/);
const memories = await request('/api/chat', payload('O que você sabe sobre mim?', { memories: [{ category: 'preferences', content: 'Prefere exemplos de teste' }] })); assert.equal(memories.status, 200); assert.match(memories.data.reply, /exemplos de teste/);
const news = await request('/api/chat', payload('O que está acontecendo no Brasil?')); assert.equal(news.status, 200); assert.ok(news.data.sources.length > 0); assert.ok(news.data.sources.every(s => s.url.startsWith('https://')));
const question = await request('/api/chat', payload('O que é memória RAM?'));
if (session.data.google_ready) { assert.equal(question.status, 200); assert.ok(['public_sources', 'google_ai'].includes(question.data.mode)); assert.match(question.data.reply, /RAM|memória/i); }
else { assert.equal(question.status, 503); assert.match(question.data.error, /conversa gratuita/); }
assert.equal((await request('/api/data')).status, 401);
assert.equal((await request('/api/chat', payload('Olá'), 'https://other.example')).status, 403);
assert.equal((await request('/api/chat', payload('x'.repeat(4001)))).status, 400);
console.log(JSON.stringify({ guest_chat: 'passed', memory_context: 'passed', live_news_sources: news.data.sources.length, account_data_protected: true, cross_origin_rejected: true, input_limit_enforced: true, google: session.data.google_ready ? 'free_chat_live_verified' : 'pending_owner_free_key' }, null, 2));
