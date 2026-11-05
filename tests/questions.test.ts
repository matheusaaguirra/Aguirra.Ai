import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { intent } from '../agent/lib/questions.ts';
import { guestInput, guestContext, answerQuestion } from '../agent/lib/answers.ts';
import { selectArticles, type NewsItem } from '../agent/lib/news.ts';
const id = '12345678-1234-4123-8123-123456789012';
test('Question intent remains on topic, including on the legacy client', () => {
  const cases = [['O que é memória RAM?', 'question'], ['Como acontecem terremotos?', 'question'], ['Que dia será a próxima corrida?', 'question'], ['Que horas abre o banco?', 'question'], ['Você lembra quem descobriu o Brasil?', 'question'], ['O que você sabe sobre mim?', 'memory'], ['O que você lembra?', 'memory'], ['Que horas são?', 'clock'], ['Que dia é hoje?', 'clock'], ['O que está acontecendo nos Estados Unidos?', 'news'], ['Notícias de carros', 'news'], ['E no Brasil?', 'question'], ['Olá Aguirra', 'greeting']];
  const client: any = {}; vm.runInNewContext(readFileSync('public/memory-core.js', 'utf8'), client);
  for (const [question, expected] of cases) { assert.equal(intent(question), expected, question); assert.equal(client.AguirraMemory.intent(question), expected, question); }
});
test('Guests send bounded context without an account or cloud identity', () => {
  const input = guestInput.parse({ message: 'Como desenvolver meu projeto?', request_id: id, memories: [{ category: 'preferences', content: 'Prefere exemplos curtos' }], history: [{ role: 'user', text: 'Minha senha: nao-enviar' }] });
  assert.equal(guestContext(input).memories.length, 1); assert.ok(!guestContext(input).history[0].text.includes('nao-enviar'));
  assert.equal(guestContext({ ...input, memory_enabled: false }).memories.length, 0);
  assert.throws(() => guestInput.parse({ ...input, history: Array(7).fill(input.history[0]) }));
  assert.throws(() => guestInput.parse({ ...input, message: 'x'.repeat(4001) }));
});
test('News about a specific topic never silently becomes unrelated regional headlines', () => {
  const items = [{ title: 'Nova fábrica de carros no Brasil', description: 'Indústria automotiva', source: 'BBC', url: 'https://www.bbc.com/1', published_at: null }, { title: 'Mudanças no futebol', description: 'Campeonato brasileiro', source: 'BBC', url: 'https://www.bbc.com/2', published_at: null }] as NewsItem[];
  assert.equal(selectArticles(items, 'Notícias sobre carros no Brasil').length, 1);
  assert.equal(selectArticles(items, 'Notícias de astronomia no Brasil').length, 0);
  assert.equal(selectArticles(items.concat([{ ...items[0], title: 'Voos desviados na Europa', description: 'Aeroportos europeus' }]), 'O que está acontecendo no Brasil?').length, 2);
});
test('Guest basic answers do not need a model or claim Google research', async () => {
  const response = await answerQuestion('Olá', { history: [], memories: [] });
  assert.match(response.reply, /sem precisar de conta/); assert.equal(response.sources.length, 0);
  const clock = await answerQuestion('Que dia é hoje?', { history: [], memories: [] }); assert.match(clock.reply, /Brasília/);
});
