import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function disk() {
  const records = new Map<string, any>(); let created = false, now = 1800000000000;
  const store = {
    get(key: string) { const r: any = {}; setImmediate(() => { r.result = records.get(key); r.onsuccess?.(); }); return r; },
    put(value: any) { records.set(value.key, structuredClone(value)); }, delete(key: string) { records.delete(key); },
    openCursor() {
      const request: any = {}, keys = [...records.keys()]; let index = 0;
      function next() { const key = keys[index++]; request.result = key === undefined ? null : { value: records.get(key), delete() { records.delete(key); }, continue() { setImmediate(next); } }; request.onsuccess?.(); }
      setImmediate(next); return request;
    },
  };
  const db = { createObjectStore() {}, transaction() { return { objectStore() { return store; } }; } };
  const indexedDB = { open() { const r: any = { result: db }; setImmediate(() => { if (!created) { created = true; r.onupgradeneeded?.(); } r.onsuccess?.(); }); return r; } };
  function load(owner: string) { const context: any = { indexedDB, setTimeout, clearTimeout, Date: { now: () => now } }; vm.runInNewContext(readFileSync('public/audio-cache.js', 'utf8'), context); const cache = context.AguirraAudioCache; cache.setScope(owner); return cache; }
  return { records, load, advance() { now += 8 * 86400000; } };
}
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve)); };
const read = (cache: any, text: string): Promise<any> => new Promise(resolve => cache.read(text, resolve));
test('Audio survives reload, stays isolated per owner, expires and can be forgotten without an API', async () => {
  const d = disk(), a = d.load('user:a'); assert.equal(await read(a, 'RAM'), null);
  a.write('RAM', { audio_base64: 'SUQz', alignment: null }); await flush();
  assert.equal((await read(d.load('user:a'), 'RAM')).audio_base64, 'SUQz', 'New page reuses persisted audio');
  const b = d.load('user:b'); assert.equal(await read(b, 'RAM'), null); b.clear(); await flush();
  assert.ok(await read(a, 'RAM')); a.clear(); await flush(); assert.equal(await read(a, 'RAM'), null);
  a.write('RAM', { audio_base64: 'SUQz' }); await flush(); d.advance(); assert.equal(await read(a, 'RAM'), null);
});
test('Audio storage stays bounded and unsupported browsers continue without persistent audio', async () => {
  const d = disk(), a = d.load('guest'); await read(a, 'warm');
  for (let i = 0; i < 23; i++) { a.write('clip' + i, { audio_base64: 'SUQz' }); await flush(); }
  assert.equal(d.records.size, 20);
  const context: any = { setTimeout, clearTimeout }; vm.runInNewContext(readFileSync('public/audio-cache.js', 'utf8'), context);
  assert.equal(await read(context.AguirraAudioCache, 'RAM'), null);
});
