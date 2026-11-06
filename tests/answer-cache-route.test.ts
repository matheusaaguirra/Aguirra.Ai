import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chat } from '../agent/channels/web.ts';
import { localDb, closeLocalStore, LOCAL_USER_ID } from '../agent/lib/local-store.ts';
import cache from '../shared/answer-cache.cjs';
test('Authenticated cached requests create separate question points without a model; forced refresh never reuses them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aguirra-answer-route-')), env = { ...process.env }, fetch = globalThis.fetch; let calls = 0;
  try {
    process.env.AGUIRRA_LOCAL = 'true'; process.env.AGUIRRA_DATA_DIR = dir; process.env.AGUIRRA_AI_ENABLED = 'false'; delete process.env.VERCEL; delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    globalThis.fetch = async () => { calls++; throw new Error('A cached answer must not contact a provider'); };
    const thread = LOCAL_USER_ID, qid = randomUUID(), aid = randomUUID(), text = 'RAM guarda dados temporariamente.';
    localDb('aguirra_threads', 'POST', { id: thread, title: 'Registros', user_id: thread });
    localDb('aguirra_messages', 'POST', { id: aid, user_id: thread, thread_id: thread, role: 'assistant', content: text, cache_meta: cache.makeMeta('O que é RAM?', text, 'google_ai', [], true) });
    localDb('aguirra_messages', 'POST', { id: qid, user_id: thread, thread_id: thread, role: 'user', content: 'O que é RAM?', reply_id: aid });
    const session = { user: { id: thread, email: 'local@test.invalid' }, token: 'local', cookies: [] };
    const request = (refresh: boolean) => new Request('http://local/api/ask', { method: 'POST', headers: { Origin: 'http://local', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Me explique memória RAM', request_id: randomUUID(), force_refresh: refresh }) });
    const response = await chat(request(false), {} as any, session), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.cached, true); assert.equal(result.reply, text); assert.equal(calls, 0);
    assert.notEqual(result.answer_id, aid); assert.equal(result.cache_meta.reused_from, qid);
    assert.equal(cache.pairs(localDb('aguirra_messages?select=*', 'GET')).length, 2);
    const forced = await chat(request(true), {} as any, session); assert.equal(forced.status, 503, 'Without a model, force refresh must fail instead of silently reusing');
    assert.equal(calls, 0); assert.equal(cache.pairs(localDb('aguirra_messages?select=*', 'GET')).length, 3);
  } finally {
    globalThis.fetch = fetch; closeLocalStore(); for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); rmSync(dir, { recursive: true, force: true });
  }
});
