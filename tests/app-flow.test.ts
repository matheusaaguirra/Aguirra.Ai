import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import answers from '../shared/answer-cache.cjs';

function app(signedIn = true) {
  const nodes = new Map<string, any>(), requests: any[] = [], spoken: any[] = [];
  function node() {
    return { attributes: {} as Record<string, string>, value: '', textContent: '', className: '', hidden: false, childNodes: [] as any[],
      get firstChild() { return this.childNodes[0]; },
      appendChild(n: any) { this.childNodes.push(n); return n; },
      removeChild(n: any) { this.childNodes.splice(this.childNodes.indexOf(n), 1); },
      setAttribute(name: string, value: string) { this.attributes[name] = value; }, setAttributeNS() {}, getAttribute(): string | null { return null; },
    };
  }
  function element(id: string) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }
  class XHR {
    method = ''; path = ''; body: any; status = 0; readyState = 0; responseText = ''; onreadystatechange?: () => void;
    open(method: string, path: string) { this.method = method; this.path = path; }
    setRequestHeader() {}
    send(body: any) { this.body = body ? JSON.parse(body) : null; requests.push(this); }
    respond(data: any, status = 200) { this.status = status; this.responseText = JSON.stringify(data); this.readyState = 4; this.onreadystatechange?.(); }
  }
  const brainNav = node(); brainNav.getAttribute = () => 'brain';
  let callbacks: any;
  const context: any = {
    navigator: { userAgent: 'Android 4.4' }, localStorage: { getItem() { return null; }, setItem() {} },
    document: { body: node(), getElementById: element, querySelector: element, querySelectorAll(selector: string) { return selector === '[data-view],[data-open]' ? [brainNav] : []; }, createElement: node, createElementNS: node, createTextNode: (text: string) => ({ textContent: text }), addEventListener() {} },
    location: { search: '' }, scrollTo() {}, matchMedia() { return { matches: true }; }, setTimeout() { return 1; }, clearTimeout() {}, setInterval() {}, XMLHttpRequest: XHR,
    AguirraMicrophone: { configure() {}, cancel() {}, setServer() {} },
    AguirraVoice: { configure(value: any) { callbacks = value; }, cleanText: (text: string) => text, prime() {}, clearCache() {}, stop() { callbacks?.onState('idle'); }, setServer() {}, setEleven() {}, setVoice() {}, voices() { return []; }, spectrum() { return null; }, speak(text: string, id: string | null) { spoken.push({ text, id }); callbacks.onState('speaking'); callbacks.onCaption(text); } },
  };
  context.window = context;
  vm.runInNewContext(readFileSync('public/memory-core.js', 'utf8'), context);
  vm.runInNewContext(readFileSync('public/answer-cache.js', 'utf8'), context);
  vm.runInNewContext(readFileSync('public/app.js', 'utf8'), context);
  const data = { memories: [], threads: [], messages: [], topics: [], settings: { memory_enabled: true } };
  requests.shift().respond({ user: signedIn ? { id: 'owner', email: 'test@example.com' } : null, elevenlabs_ready: true });
  if (signedIn) requests.shift().respond(data);
  return { nodes, spoken, requests, data, openBrain() { (brainNav as any).onclick(); }, send(text: string) { element('home-input').value = text; element('home-form').onsubmit({ preventDefault() {} }); } };
}
test('Signed-in identity speaks before history persistence and is never spoken twice', () => {
  const page = app(); page.send('Quem é você?');
  assert.equal(page.requests[0].path, '/api/ask'); assert.equal(page.spoken.length, 1);
  assert.match(page.spoken[0].text, /Matheus Almeida Guirra/); assert.equal(page.spoken[0].id, null);
  assert.match(page.nodes.get('orb-stage').className, /is-speaking/);
  const text = page.spoken[0].text;
  page.requests.shift().respond({ reply: text, answer_id: 'saved-response', learned: false });
  assert.equal(page.spoken.length, 1); assert.equal(page.requests[0].path, '/api/data');
  page.requests.shift().respond(page.data); assert.equal(page.spoken.length, 1);
});
test('Generated answers start speaking before data refresh and failed identity sync does not interrupt its voice', () => {
  const page = app(); page.send('Explique memória RAM'); assert.equal(page.spoken.length, 0);
  page.requests.shift().respond({ reply: 'RAM guarda os dados em uso.', answer_id: 'ram-answer' });
  assert.deepEqual(page.spoken, [{ text: 'RAM guarda os dados em uso.', id: 'ram-answer' }]);
  assert.equal(page.requests[0].path, '/api/data'); page.requests.shift().respond(page.data);
  page.send('Quem te criou?'); assert.equal(page.spoken.length, 2);
  page.requests.shift().respond({ error: 'Sem conexão.' }, 503);
  assert.equal(page.spoken.length, 2); assert.match(page.nodes.get('toast').textContent, /registro desta pergunta/);
});

test('A guest repeats and rephrases saved questions without any new answer request; refresh bypasses reuse', () => {
  const page = app(false); page.send('O que é memória RAM?');
  assert.equal(page.requests.length, 1);
  page.requests.shift().respond({ reply: 'RAM guarda dados temporariamente.', mode: 'google_ai', sources: [] });
  page.send('Me explique RAM');
  assert.equal(page.requests.length, 0); assert.equal(page.spoken.length, 2);
  assert.equal(page.spoken[1].text, 'RAM guarda dados temporariamente.');
  page.send('Para que serve RAM?'); assert.equal(page.requests.length, 1, 'Different intent must generate a new answer');
});
test('Signed-in answer memory speaks immediately while its new question is recorded', () => {
  const page = app(), text = 'RAM guarda dados temporariamente.'; page.send('O que é memória RAM?');
  const request = page.requests.shift(), questionId = request.body.request_id;
  const meta = answers.makeMeta('O que é memória RAM?', text, 'google_ai', [], true);
  request.respond({ reply: text, answer_id: 'ram-answer', cache_meta: meta, mode: 'google_ai' });
  page.data.messages.push({ id: questionId, role: 'user', content: 'O que é memória RAM?', reply_id: 'ram-answer' } as never, { id: 'ram-answer', role: 'assistant', content: text, cache_meta: meta } as never);
  page.requests.shift().respond(page.data);
  page.send('Me explique memória RAM');
  assert.equal(page.spoken.length, 2); assert.equal(page.requests[0].path, '/api/ask');
  page.requests.shift().respond({ reply: text, answer_id: 'second', cached: true });
  assert.equal(page.spoken.length, 2, 'Persistence confirmation must not repeat cached audio');
});

test('The brain renders one point per question and lets the user explicitly refresh a saved answer', () => {
  const page = app(false); page.send('O que é RAM?');
  page.requests.shift().respond({ reply: 'RAM guarda dados temporariamente.', mode: 'google_ai' });
  page.send('Me explique memória RAM'); page.openBrain();
  assert.match(page.nodes.get('brain-summary').textContent, /2 perguntas/);
  const points = page.nodes.get('brain-svg').childNodes.filter((n: any) => n.attributes?.role === 'button');
  assert.equal(points.length, 2); assert.notEqual(points[0].attributes['aria-label'], points[1].attributes['aria-label']);
  page.nodes.get('question-list').childNodes[0].onclick();
  assert.equal(page.nodes.get('question-detail').hidden, false);
  const actions = page.nodes.get('question-detail').childNodes.find((n: any) => n.className === 'question-actions');
  actions.childNodes[1].onclick();
  assert.equal(page.requests[0].path, '/api/ask'); assert.equal(page.requests[0].body.force_refresh, true);
});
