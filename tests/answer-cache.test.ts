import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import cache from '../shared/answer-cache.cjs';
const now = 1800000000000;
function records(question = 'O que é memória RAM?', memories: any[] = []) {
  return [{ id: 'q', role: 'user', content: question, reply_id: 'a' }, { id: 'a', role: 'assistant', content: 'RAM guarda dados temporariamente.', sources: [], cache_meta: cache.makeMeta(question, 'RAM guarda dados temporariamente.', 'google_ai', memories, true, now) }];
}
test('Same questions and conservative Portuguese rephrasings reuse the answer identically in browser and server', () => {
  assert.equal(readFileSync('public/answer-cache.js', 'utf8'), readFileSync('shared/answer-cache.cjs', 'utf8'));
  const client: any = {}; vm.runInNewContext(readFileSync('public/answer-cache.js', 'utf8'), client);
  for (const q of ['O QUE É MEMÓRIA RAM?', 'Me explique RAM', 'Você pode me explicar memória RAM?', 'Qual é a definição de RAM?', 'O que significa uma RAM?']) {
    assert.equal(cache.find(q, records(), [], true, now + 1)?.answer.id, 'a', q);
    assert.equal(client.AguirraAnswers.find(q, records(), [], true, now + 1)?.answer.id, 'a', q);
  }
  for (const q of ['Para que serve RAM?', 'O que é memória ROM?', 'O que é RAM em detalhes?', 'O que é RAM não volátil?', 'O que é RAM de 16 GB?']) assert.equal(cache.find(q, records(), [], true, now + 1), null, q);
  assert.notEqual(cache.signature('Quanto é 2 + 2?'), cache.signature('Quanto é 2 + 3?'));
  assert.notEqual(cache.signature('Como converter A para B?'), cache.signature('Como converter B para A?'));
});
test('No reuse for changing facts, credentials, context-dependent or personalized questions, failures, disabled memory or expired metadata', () => {
  for (const q of ['Quais as notícias de hoje?', 'Qual é a previsão do tempo?', 'O que é o dólar agora?', 'Quem é o presidente?', 'Qual minha meta?', 'Como faço isso?', 'Que horas são?', 'Quanto custa uma RAM?', 'Qual o medicamento para ansiedade?']) assert.equal(cache.signature(q), null, q);
  assert.equal(cache.makeMeta('O que é RAM?', 'Não consigo verificar.', 'google_ai', [], true, now), null);
  assert.equal(cache.makeMeta('O que é RAM?', 'Texto', 'unverified_current', [], true, now), null);
  assert.equal(cache.find('O que é RAM?', records(), [], false, now + 1), null);
  assert.equal(cache.find('O que é RAM?', records(), [], true, now + cache.ttl + 1), null);
  for (const override of [{ failed: true }, { exclude_context: true }, { cache_meta: null }, { cache_meta: { ...records()[1].cache_meta, expires_at: undefined } }]) {
    const data = records(); Object.assign(data[1], override); assert.equal(cache.find('O que é RAM?', data, [], true, now + 1), null);
  }
  const memories = [{ category: 'preferences', content: 'Prefere respostas curtas' }];
  assert.ok(cache.find('O que é RAM?', records(undefined, memories), memories, true, now + 1));
  assert.equal(cache.find('O que é RAM?', records(undefined, memories), [], true, now + 1), null, 'Forgetting context invalidates old answers');
  assert.equal(cache.find('O que é RAM?', records(), memories, true, now + 1), null, 'New context invalidates old answers');
  const copied = records(); copied[1].cache_meta = { ...copied[1].cache_meta, reused_from: 'previous' };
  assert.equal(cache.find('Me explique RAM', copied, [], true, now + cache.ttl + 1), null, 'Reuse never renews the original expiration');
});
test('Every question remains its own point, including repeats, failures and unanswered records', () => {
  const data = records().concat([{ id: 'q2', role: 'user', content: 'Me explique RAM', reply_id: 'a2' }, { id: 'a2', role: 'assistant', content: 'Resposta', cache_meta: null }, { id: 'q3', role: 'user', content: 'Sem resposta', reply_id: undefined }] as any);
  const points = cache.pairs(data); assert.equal(points.length, 3); assert.equal(points[1].answer.id, 'a2'); assert.equal(points[2].answer, null);
});
