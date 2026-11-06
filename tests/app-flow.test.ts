import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function app() {
  const nodes = new Map<string, any>(), requests: any[] = [], spoken: any[] = [];
  function node() {
    return { value: '', textContent: '', className: '', hidden: false, childNodes: [] as any[],
      get firstChild() { return this.childNodes[0]; },
      appendChild(n: any) { this.childNodes.push(n); return n; },
      removeChild(n: any) { this.childNodes.splice(this.childNodes.indexOf(n), 1); },
      setAttribute() {}, setAttributeNS() {}, getAttribute() { return null; },
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
  let callbacks: any;
  const context: any = {
    navigator: { userAgent: 'Android 4.4' }, localStorage: { getItem() { return null; }, setItem() {} },
    document: { body: node(), getElementById: element, querySelector: element, querySelectorAll() { return []; }, createElement: node, createElementNS: node, createTextNode: (text: string) => ({ textContent: text }), addEventListener() {} },
    location: { search: '' }, scrollTo() {}, matchMedia() { return { matches: true }; }, setTimeout() { return 1; }, clearTimeout() {}, setInterval() {}, XMLHttpRequest: XHR,
    AguirraMicrophone: { configure() {}, cancel() {}, setServer() {} },
    AguirraVoice: { configure(value: any) { callbacks = value; }, cleanText: (text: string) => text, prime() {}, stop() { callbacks?.onState('idle'); }, setServer() {}, setEleven() {}, setVoice() {}, voices() { return []; }, spectrum() { return null; }, speak(text: string, id: string | null) { spoken.push({ text, id }); callbacks.onState('speaking'); callbacks.onCaption(text); } },
  };
  context.window = context;
  vm.runInNewContext(readFileSync('public/memory-core.js', 'utf8'), context);
  vm.runInNewContext(readFileSync('public/app.js', 'utf8'), context);
  const data = { memories: [], threads: [], messages: [], topics: [], settings: { memory_enabled: true } };
  requests.shift().respond({ user: { id: 'owner', email: 'test@example.com' }, elevenlabs_ready: true });
  requests.shift().respond(data);
  return { nodes, spoken, requests, data, send(text: string) { element('home-input').value = text; element('home-form').onsubmit({ preventDefault() {} }); } };
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
