import test from 'node:test';
import assert from 'node:assert/strict';
import { googleReady, GOOGLE_MODEL, validateAnswer, respondGoogle } from '../agent/lib/google.ts';
const documents = [{ title: 'RAM', url: 'https://pt.wikipedia.org/wiki/RAM', content: 'Memória de acesso aleatório.' }];
test('Replies stay clean and source metadata only references fetched documents', () => {
  const result = validateAnswer({ answer: 'RAM é memória de acesso aleatório.', source_ids: [1] }, documents);
  assert.equal(result.reply, 'RAM é memória de acesso aleatório.');
  assert.equal(result.sources[0].url, documents[0].url); assert.equal(result.mode, 'public_sources');
  assert.throws(() => validateAnswer({ answer: 'Invented reference', source_ids: [2] }, documents));
  const direct = validateAnswer({ answer: 'Olá', source_ids: [] }, []); assert.equal(direct.mode, 'google_ai'); assert.equal(direct.reply, 'Olá');
});
test('Free chat uses the supported fixed model without any paid Google Search tool', async () => {
  const originalFetch = globalThis.fetch, saved = { ...process.env }; let calls = 0;
  try {
    process.env.AGUIRRA_LOCAL = 'true'; delete process.env.VERCEL;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'disposable-test-key'; delete process.env.AGUIRRA_GOOGLE_FREE_CHAT;
    globalThis.fetch = async (request, options) => {
      calls++; assert.match(String(request), new RegExp(GOOGLE_MODEL));
      const body = JSON.parse(String(options?.body)); assert.ok(!body.tools?.length); assert.equal(body.generationConfig.responseMimeType, 'application/json');
      return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ answer: 'RAM é memória de acesso aleatório.', source_ids: [1] }) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 20, totalTokenCount: 32 }, modelVersion: GOOGLE_MODEL });
    };
    assert.equal(googleReady(), false); await assert.rejects(respondGoogle('teste', { history: [], memories: [] })); assert.equal(calls, 0);
    process.env.AGUIRRA_GOOGLE_FREE_CHAT = 'confirmed-no-billing';
    const result = await respondGoogle('O que é RAM?', { history: [], memories: [] }, documents);
    assert.equal(result.mode, 'public_sources'); assert.equal(calls, 1);
    const successFetch = globalThis.fetch; let outage = true;
    globalThis.fetch = async (url, options) => { if (outage) { outage = false; calls++; return Response.json({ error: { message: 'High demand' } }, { status: 503 }); } assert.match(String(url), /gemini-3.1-flash-lite/); return successFetch(String(url).replace('gemini-3.1-flash-lite', GOOGLE_MODEL), options); };
    await respondGoogle('teste', { history: [], memories: [] }, documents); assert.equal(calls, 3);
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'Free quota exhausted', code: 429 } }, { status: 429 }); };
    await assert.rejects(respondGoogle('teste', { history: [], memories: [] }), /cota gratuita/); assert.equal(calls, 4);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
