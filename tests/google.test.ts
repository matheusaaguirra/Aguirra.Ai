import test from 'node:test';
import assert from 'node:assert/strict';
import { googleReady, GOOGLE_MODEL, groundedAnswer, researchGoogle } from '../agent/lib/google.ts';
const uri = 'https://example.org/italia';
const text = 'Roma é a capital da Itália.';
const grounding = { webSearchQueries: ['capital da Itália'], groundingChunks: [{ web: { uri, title: 'Itália' } }], groundingSupports: [{ segment: { text, startIndex: 0, endIndex: text.length }, groundingChunkIndices: [0] }], searchEntryPoint: { renderedContent: '<div>Google</div>' } };
test('Only actually grounded answers have citations and Google suggestions', () => {
  const result = groundedAnswer(text, [{ sourceType: 'url', title: 'Itália', url: uri }, { sourceType: 'url', url: 'javascript:alert(1)' }], { groundingMetadata: grounding } as any);
  assert.equal(groundedAnswer('Sobre qual cidade você quer saber?', [], undefined).mode, 'clarification');
  assert.equal(result.sources.length, 1); assert.equal(result.reply, text + ' [1]'); assert.equal(result.search_entry_point, '<div>Google</div>');
  assert.throws(() => groundedAnswer('Invented answer', [], undefined));
  assert.throws(() => groundedAnswer(text, [{ sourceType: 'url', url: uri }], { groundingMetadata: { ...grounding, webSearchQueries: [] } } as any));
});
test('Free Google requests use the pinned model, grounded sources and no paid fallback', async () => {
  const originalFetch = globalThis.fetch, saved = { ...process.env }; let calls = 0;
  try {
    process.env.AGUIRRA_LOCAL = 'true'; delete process.env.VERCEL;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'disposable-test-key'; delete process.env.AGUIRRA_GOOGLE_FREE_TIER;
    globalThis.fetch = async (request, options) => {
      calls++; assert.match(String(request), new RegExp(GOOGLE_MODEL));
      const body = JSON.parse(String(options?.body)); assert.ok(body.tools.some((t: any) => t.googleSearch));
      assert.ok(String(options?.body).includes('Qual é a capital da Itália?'));
      return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', groundingMetadata: grounding }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 12, totalTokenCount: 24 }, modelVersion: GOOGLE_MODEL });
    };
    assert.equal(googleReady(), false); await assert.rejects(researchGoogle('teste', { history: [], memories: [] })); assert.equal(calls, 0);
    process.env.AGUIRRA_GOOGLE_FREE_TIER = 'confirmed-no-billing'; assert.equal(googleReady(), true);
    const result = await researchGoogle('Qual é a capital da Itália?', { history: [], memories: [] });
    assert.equal(result.mode, 'google'); assert.equal(result.sources[0].url, uri); assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'Free quota exhausted', code: 429 } }, { status: 429 }); };
    await assert.rejects(researchGoogle('Qual é a capital da Itália?', { history: [], memories: [] }), /cota gratuita/); assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
