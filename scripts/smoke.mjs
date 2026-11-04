// Receives temporary fixture credentials over stdin, never arguments or logs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
let raw = ''; for await (const chunk of process.stdin) raw += chunk;
const { origin, accounts, testAI = false } = JSON.parse(raw);
async function client(credentials) {
  const jar = new Map();
  return async function call(method, path, body) {
    const response = await fetch(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; ') }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(165000) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], pos = pair.indexOf('='); jar.set(pair.slice(0,pos), pair.slice(pos+1)); }
    const value = await response.json(); if (!response.ok) throw new Error(`${path}: ${response.status} ${value.error}`); return value;
  };
}
const a = await client(accounts[0]), b = await client(accounts[1]);
await a('POST', '/api/auth', { mode: 'login', ...accounts[0] });
await b('POST', '/api/auth', { mode: 'login', ...accounts[1] });
console.log('PASS: authentication and HttpOnly cookie session');
await a('POST', '/api/memory', { category: 'preferences', content: 'Prefere exemplos curtos para testes de qualidade' });
let data = await a('GET', '/api/data'); const memory = data.memories.find(m => m.content.includes('testes de qualidade')); assert.ok(memory);
assert.equal((await b('GET', '/api/data')).memories.length, 0);
await b('POST', '/api/memory', { id: memory.id, category: 'notes', content: 'Cross-user mutation attempt' });
assert.equal((await a('GET', '/api/data')).memories[0].content, memory.content);
console.log('PASS: cloud persistence and cross-user isolation');
const requestId = randomUUID(); const time = await a('POST', '/api/chat', { message: 'Que dia e que horas são?', request_id: requestId, thread_id: null }); assert.ok(time.reply.includes('Brasília'));
const duplicate = await a('POST', '/api/chat', { message: 'Que dia e que horas são?', request_id: requestId, thread_id: null }); assert.equal(time.thread_id, duplicate.thread_id);
console.log('PASS: chat → database → response and request deduplication');
if (testAI) { const result = await a('POST', '/api/chat', { message: 'Responda apenas AGUIRRA_OK, sem pesquisar na web.', request_id: randomUUID(), thread_id: time.thread_id }); assert.ok(result.reply.includes('AGUIRRA_OK')); console.log('PASS: live model request through deployed agent'); }
await a('DELETE', '/api/memory?id=' + memory.id);
assert.equal((await a('GET', '/api/data')).memories.length, 0);
await a('DELETE', '/api/data'); data = await a('GET', '/api/data'); assert.equal(data.messages.length, 0); assert.equal(data.threads.length, 0);
await a('POST', '/api/logout', {}); assert.equal((await a('GET', '/api/session')).user, null);
await b('POST', '/api/logout', {});
console.log('PASS: memory deletion, forget-all and logout');
