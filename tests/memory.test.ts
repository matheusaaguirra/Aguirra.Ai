import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { extract, relevant, redact, sensitive, topics, type Memory } from '../agent/lib/memory.ts';
import { safeOrigin, sessionCookies, AppError } from '../agent/lib/db.ts';

test('Explicit preferences and corrections become reviewable memories', () => {
  assert.deepEqual(extract('Prefiro respostas curtas.'), [{ category: 'preferences', key: 'prefere respostas curtas', content: 'Prefere respostas curtas', origin: 'declared' }]);
  assert.equal(extract('Meu nome é Matheus')[0].key, extract('Meu nome é Ana')[0].key);
  assert.equal(extract('Meu objetivo é aprender italiano')[0].category, 'goals');
});
test('Questions, hypothetical preferences and credentials never become memories', () => {
  for (const text of ['Será que prefiro Angular?', 'Se eu prefiro respostas curtas', 'Imagine que meu nome é Ana', 'Minha senha é teste123', 'Guarde que meu CPF é 123.456.789-10', 'Lembre que minha religião é X', 'Guarde o token: abcdef']) assert.equal(extract(text).length, 0, text);
  assert.ok(sensitive('Meu cartão é 1234567891234567'));
  assert.ok(!redact('Minha senha: teste123').includes('teste123'));
});
test('Retrieval includes preferences and relevant projects, not unrelated notes', () => {
  const memories: Memory[] = [{ category: 'preferences', key: 'short', content: 'Prefere respostas curtas', origin: 'declared' }, { category: 'projects', key: 'wealthos', content: 'Projeto WealthOS com Angular', origin: 'manual' }, { category: 'notes', key: 'plants', content: 'Cultivar girassóis', origin: 'manual' }];
  assert.deepEqual(relevant(memories, 'Quero desenvolver o WealthOS').map(m => m.key), ['wealthos', 'short']);
  assert.deepEqual(relevant(memories.filter(m => m.key !== 'short'), 'Notícias hoje').map(m => m.key), []);
});
test('Topic frequency is not a preference or fact', () => { assert.ok(topics('O que acontece no Brasil hoje?').includes('Notícias')); assert.equal(extract('O que acontece no Brasil hoje?').length, 0); });
test('Legacy client and server apply identical memory rules', () => {
  const context: any = {}; vm.runInNewContext(readFileSync('public/memory-core.js', 'utf8'), context);
  for (const text of ['Meu nome é Matheus', 'Prefiro respostas curtas.', 'Meu objetivo é aprender italiano', 'Estou desenvolvendo WealthOS', 'Lembre que uso Android 4.4', 'Guarde que minha senha é teste', 'Prefiro JavaScript?', 'Se eu prefiro Angular', 'Meu CPF é 123.456.789-10']) {
    assert.deepEqual(JSON.parse(JSON.stringify(context.AguirraMemory.extract(text))), extract(text));
    assert.equal(context.AguirraMemory.redact(text), redact(text));
  }
});
test('Cross-site writes are rejected and session tokens are HttpOnly', () => {
  assert.throws(() => safeOrigin(new Request('https://aguirra.test/api/chat', { method: 'POST', headers: { origin: 'https://other.test', 'content-type': 'application/json' } })), AppError);
  assert.doesNotThrow(() => safeOrigin(new Request('https://aguirra.test/api/chat', { method: 'POST', headers: { origin: 'https://aguirra.test', 'content-type': 'application/json' } })));
  const cookies = sessionCookies({ access_token: 'test-access', refresh_token: 'test-refresh' }, new Request('https://aguirra.test'));
  assert.ok(cookies.every(c => c.includes('HttpOnly') && c.includes('Secure') && c.includes('SameSite=Lax')));
});
