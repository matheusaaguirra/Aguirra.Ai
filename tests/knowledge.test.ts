import test from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeQuery, needsCurrent, parseKnowledge, readKnowledge } from '../agent/lib/knowledge.ts';
test('Public retrieval is for explicit factual topics and avoids current or personal statements', () => {
  assert.equal(knowledgeQuery('O que é memória RAM? Responda em poucas frases.'), 'memória RAM');
  assert.equal(knowledgeQuery('Prefiro respostas curtas'), null);
  assert.equal(knowledgeQuery('Meu nome é Ana'), null);
  assert.equal(needsCurrent('Quem é o presidente atual?'), true);
  assert.equal(needsCurrent('O que é memória RAM?'), false);
});
test('Public knowledge sources reject external and unsafe URLs and bound excerpts', () => {
  const result = parseKnowledge({ query: { pages: { 1: { title: 'RAM', fullurl: 'https://pt.wikipedia.org/wiki/RAM', extract: 'a'.repeat(4000) }, 2: { title: 'Bad', fullurl: 'javascript:alert(1)', extract: 'bad' }, 3: { title: 'Other', fullurl: 'https://other.example/a', extract: 'bad' } } } });
  assert.equal(result.length, 1); assert.equal(result[0].content.length, 3000);
});
test('Slow or failing optional sources briefly reuse an empty result, then recover with real source metadata', async () => {
  const fetch = globalThis.fetch, now = Date.now; let calls = 0, time = now();
  try {
    Date.now = () => time;
    globalThis.fetch = async () => { calls++; throw new DOMException('Source timeout', 'TimeoutError'); };
    assert.deepEqual(await readKnowledge('O que é latência de rede?'), []);
    assert.deepEqual(await readKnowledge('O que é latência de rede?'), []); assert.equal(calls, 1);
    time += 31000;
    globalThis.fetch = async () => { calls++; return Response.json({ query: { pages: { 1: { title: 'Latência de rede', fullurl: 'https://pt.wikipedia.org/wiki/Lat%C3%AAncia', extract: 'Tempo necessário para transmitir dados.' } } } }); };
    const recovered = await readKnowledge('O que é latência de rede?'); assert.equal(recovered.length, 1); assert.equal(calls, 2);
    assert.deepEqual(await readKnowledge('O que é latência de rede?'), recovered); assert.equal(calls, 2);
  } finally { globalThis.fetch = fetch; Date.now = now; }
});
