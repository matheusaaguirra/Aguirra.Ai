import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localAuth, localDb, localLogout, closeLocalStore, LOCAL_USER_ID } from '../agent/lib/local-store.ts';
import { parseFeed } from '../agent/lib/news.ts';

const directory = mkdtempSync(join(tmpdir(), 'aguirra-test-'));
process.env.AGUIRRA_DATA_DIR = directory;
process.env.AGUIRRA_LOCAL_PASSWORD = 'disposable-test-access';
after(() => { closeLocalStore(); rmSync(directory, { recursive: true, force: true }); });

test('Local code, sessions, refresh and logout work without a cloud account', () => {
  assert.throws(() => localAuth('token?grant_type=password', { password: 'wrong' }));
  const login = localAuth('token?grant_type=password', { password: 'disposable-test-access' }) as any;
  assert.equal((localAuth('user', undefined, login.access_token) as any).id, LOCAL_USER_ID);
  const next = localAuth('token?grant_type=refresh_token', { refresh_token: login.refresh_token }) as any;
  assert.throws(() => localAuth('user', undefined, login.access_token));
  localLogout(next.access_token); assert.throws(() => localAuth('user', undefined, next.access_token));
});
test('SQLite keeps memories across reconnection and forget-all removes personal context', () => {
  const row = { user_id: LOCAL_USER_ID, category: 'preferences', key: 'style', content: 'Prefere exemplos curtos', origin: 'manual' };
  localDb('aguirra_memories?on_conflict=user_id,key', 'POST', row); closeLocalStore();
  assert.equal(localDb('aguirra_memories?select=*&limit=500', 'GET')[0].content, row.content);
  localDb('aguirra_memories?on_conflict=user_id,key', 'POST', { ...row, content: 'Prefere exemplos completos' });
  assert.equal(localDb('aguirra_memories?select=*', 'GET').length, 1);
  localDb('rpc/aguirra_forget_all', 'POST', {}); assert.equal(localDb('aguirra_memories?select=*', 'GET').length, 0);
});
test('Public feeds are parsed as data; unsafe links and XML entities are rejected', () => {
  const parsed = parseFeed('<rss><channel><item><title><![CDATA[Uma notícia]]></title><link>https://www.bbc.com/portuguese/test</link><description><![CDATA[<p>Resumo</p>]]></description><pubDate>Wed, 04 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Bad link</title><link>javascript:alert(1)</link></item></channel></rss>');
  assert.equal(parsed.length, 1); assert.equal(parsed[0].description, 'Resumo');
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>'));
});
