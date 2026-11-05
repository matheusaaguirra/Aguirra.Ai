import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { startGoogleLogin, completeGoogleLogin } from '../agent/lib/google-login.ts';
const origin = 'https://aguirra-ai.vercel.app';
test('Google login uses PKCE, fixed redirect and HttpOnly cookies; missing verifier and cross-origin starts fail', async () => {
  const saved = { ...process.env }, originalFetch = globalThis.fetch; let calls = 0, challenge = '';
  try {
    delete process.env.AGUIRRA_LOCAL; process.env.SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
    const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: '12345678-1234-4123-8123-123456789012', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test-signature'].join('.');
    globalThis.fetch = async (url, init) => {
      calls++;
      if (String(url).endsWith('/settings')) return Response.json({ external: { google: true } });
      assert.ok(String(url).includes('/token?grant_type=pkce'));
      const body = JSON.parse(String(init?.body)); assert.equal(body.auth_code, 'fixture-code');
      assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
      return Response.json({ access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: { id: '12345678-1234-4123-8123-123456789012', email: 'fixture@example.invalid' } });
    };
    const request = new Request(origin + '/api/google', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
    const response = await startGoogleLogin(request), data = await response.json();
    const url = new URL(data.url); assert.equal(url.origin, 'https://fixture.supabase.co'); assert.equal(url.searchParams.get('provider'), 'google'); challenge = url.searchParams.get('code_challenge')!; assert.ok(challenge);
    const redirect = new URL(url.searchParams.get('redirect_to')!); assert.equal(redirect.origin + redirect.pathname, origin + '/api/google-callback');
    const cookie = response.headers.get('set-cookie')!; assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
    const callback = new URL(origin + '/api/google-callback?code=fixture-code'); const flowId = redirect.searchParams.get('sb_flow_id'); if (flowId) callback.searchParams.set('sb_flow_id', flowId);
    const done = await completeGoogleLogin(new Request(callback, { headers: { Cookie: cookie.split(';')[0] } }));
    assert.equal(done.status, 303); assert.equal(done.headers.get('location'), origin + '/'); assert.ok(done.headers.getSetCookie().some(c => c.startsWith('aguirra_access=')));
    const before = calls;
    const missing = await completeGoogleLogin(new Request(callback)); assert.match(missing.headers.get('location')!, /google-failed/); assert.equal(calls, before);
    await assert.rejects(startGoogleLogin(new Request(origin + '/api/google', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })), /Origem/);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
