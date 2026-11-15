import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createDesktopServer } from '../desktop/aguirra-desktop.mjs';

function loadDesktopBridge() {
  const storage = new Map<string, string>();
  const context: any = {
    localStorage: {
      getItem(k: string) { return storage.get(k) ?? null; },
      setItem(k: string, v: string) { storage.set(k, v); },
      removeItem(k: string) { storage.delete(k); }
    }
  };
  context.window = context;
  vm.runInNewContext(readFileSync('public/desktop-bridge.js', 'utf8'), context);
  return context.AguirraDesktop;
}

test('AguirraDesktop.matchCommand identifies allowlisted launch commands and ignores questions', () => {
  const bridge = loadDesktopBridge();
  assert.equal(bridge.matchCommand('Abrir o WhatsApp'), 'whatsapp');
  assert.equal(bridge.matchCommand('abre o zap por favor'), 'whatsapp');
  assert.equal(bridge.matchCommand('iniciar calculadora'), 'calculator');
  assert.equal(bridge.matchCommand('abrir youtube'), 'youtube');
  assert.equal(bridge.matchCommand('abra o vs code'), 'vscode');

  assert.equal(bridge.matchCommand('O que é WhatsApp?'), null);
  assert.equal(bridge.matchCommand('Como funciona o Spotify?'), null);
  assert.equal(bridge.matchCommand('whatsapp'), null);
});

test('createDesktopServer enforces token auth, CORS/PNA headers, and action allowlist', async () => {
  const launched: string[] = [];
  const server = createDesktopServer({
    token: 'test-token-123456',
    launcher: (action: string) => {
      launched.push(action);
      return { ok: true, label: 'WhatsApp', target: 'whatsapp:' };
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const origin = 'https://aguirra-ai.vercel.app';

  try {
    const healthAnon = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
    assert.equal(healthAnon.status, 200);
    assert.equal(healthAnon.headers.get('access-control-allow-origin'), origin);
    assert.equal(healthAnon.headers.get('access-control-allow-private-network'), 'true');
    const healthAnonBody = await healthAnon.json() as any;
    assert.equal(healthAnonBody.ok, true);
    assert.equal(healthAnonBody.authenticated, false);

    const healthAuth = await fetch(`${baseUrl}/health`, {
      headers: { Origin: origin, 'X-Aguirra-Token': 'test-token-123456' }
    });
    const healthAuthBody = await healthAuth.json() as any;
    assert.equal(healthAuthBody.authenticated, true);

    const unauthExec = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'whatsapp' })
    });
    assert.equal(unauthExec.status, 401);

    const badAction = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Aguirra-Token': 'test-token-123456' },
      body: JSON.stringify({ action: 'powershell' })
    });
    assert.equal(badAction.status, 400);

    const okExec = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Aguirra-Token': 'test-token-123456' },
      body: JSON.stringify({ action: 'whatsapp' })
    });
    assert.equal(okExec.status, 200);
    const okBody = await okExec.json() as any;
    assert.equal(okBody.ok, true);
    assert.equal(okBody.action, 'whatsapp');
    assert.match(okBody.reply, /WhatsApp/);
    assert.deepEqual(launched, ['whatsapp']);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
