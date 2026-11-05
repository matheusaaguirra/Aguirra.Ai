import { createClient } from '@supabase/supabase-js';
import { AppError, config, sessionCookies, safeOrigin } from './db.ts';
import { localMode } from './local-store.ts';
const cookieName = 'aguirra_oauth_pkce';
let statusCache: { enabled: boolean; expires: number } | null = null;
export async function googleLoginAvailable() {
  if (localMode()) return false;
  if (statusCache && statusCache.expires > Date.now()) return statusCache.enabled;
  try {
    const { url, key } = config(); const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: key }, signal: AbortSignal.timeout(6000) });
    const enabled = response.ok && (await response.json()).external?.google === true;
    statusCache = { enabled, expires: Date.now() + 60000 }; return enabled;
  } catch { return false; }
}
function publicOrigin(request: Request) {
  const allowed = process.env.AGUIRRA_PUBLIC_URL || 'https://aguirra-ai.vercel.app';
  const origin = new URL(allowed).origin;
  if (!origin.startsWith('https://') || new URL(request.url).origin !== origin) throw new AppError(403, 'Entre com Google pelo endereço público do Aguirra.');
  return origin;
}
function clearPkce() { return cookieName + '=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }
function oauthClient(request: Request) {
  const { url, key } = config(); let jar: Record<string, string> = {};
  try { const value = (request.headers.get('cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1); const parsed = JSON.parse(decodeURIComponent(value || '{}')); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) jar = Object.fromEntries(Object.entries(parsed).filter(([k, v]) => k.endsWith('-code-verifier') && typeof v === 'string' && k.length < 200 && v.length < 2000)) as Record<string, string>; } catch { /* A malformed cookie starts a new flow. */ }
  const client = createClient(url, key, { auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, storage: {
    getItem: (k: string) => jar[k] || null,
    setItem: (k: string, v: string) => { if (k.endsWith('-code-verifier')) jar[k] = v; },
    removeItem: (k: string) => { delete jar[k]; },
  } } });
  return { client, hasVerifier: () => Object.keys(jar).some(k => !k.endsWith('-flows-code-verifier')), cookie: () => {
    const value = encodeURIComponent(JSON.stringify(jar)); if (value.length > 3500) throw new AppError(400, 'Há várias tentativas de entrada abertas. Conclua a última ou tente em outra janela.');
    return `${cookieName}=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  } };
}
export async function startGoogleLogin(request: Request) {
  safeOrigin(request); const origin = publicOrigin(request);
  if (!(await googleLoginAvailable())) throw new AppError(503, 'A entrada com Google ainda aguarda ativação pelo proprietário. Você pode continuar sem conta ou entrar por e-mail.');
  const flow = oauthClient(request);
  const { data, error } = await flow.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/api/google-callback', scopes: 'openid email profile', skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
  if (error || !data.url) throw new AppError(503, 'Não consegui iniciar a entrada com Google. Tente novamente.');
  if (new URL(data.url).origin !== new URL(config().url).origin) throw new AppError(503, 'Endereço de autenticação inválido.');
  return new Response(JSON.stringify({ url: data.url }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': flow.cookie() } });
}
export async function completeGoogleLogin(request: Request) {
  const origin = publicOrigin(request), url = new URL(request.url);
  const headers = new Headers({ Location: origin + '/?auth=google-failed', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); headers.append('Set-Cookie', clearPkce());
  const code = url.searchParams.get('code');
  if (localMode() || url.searchParams.has('error') || !code || code.length > 2000) return new Response(null, { status: 303, headers });
  const flow = oauthClient(request); if (!flow.hasVerifier()) return new Response(null, { status: 303, headers });
  try {
    const flowId = url.searchParams.get('sb_flow_id');
    const { data, error } = await flow.client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (!error && data.session) { sessionCookies(data.session, request).forEach(c => headers.append('Set-Cookie', c)); headers.set('Location', origin + '/'); }
  } catch { /* Never echo OAuth codes, tokens or provider errors. */ }
  return new Response(null, { status: 303, headers });
}
