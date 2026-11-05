import { createHmac } from 'node:crypto';
import { AppError, config } from './db.ts';
import { localMode } from './local-store.ts';
const localBuckets = new Map<string, { count: number; until: number }>();
export async function claimPublicBudget(kind: 'guest' | 'google', identity: string) {
  const secret = process.env.AGUIRRA_GUEST_SECRET;
  if (localMode()) {
    const now = Date.now(), period = kind === 'google' ? 86400000 : 3600000;
    const bucket = Math.floor(now / period), key = `${kind}:${kind === 'google' ? 'all' : identity}:${bucket}`;
    for (const [k, v] of localBuckets) if (v.until <= now) localBuckets.delete(k);
    const previous = localBuckets.get(key), count = (previous?.count || 0) + 1;
    if (count > (kind === 'google' ? 100 : 30)) throw new AppError(429, 'O limite gratuito foi atingido. Tente novamente mais tarde.');
    localBuckets.set(key, { count, until: (bucket + 1) * period }); return;
  }
  if (!secret) throw new AppError(503, 'O acesso público está sendo configurado. Tente novamente em alguns instantes.');
  const { url, key } = config();
  const visitor = createHmac('sha256', secret).update(new Date().toISOString().slice(0, 10) + ':' + identity).digest('hex');
  const response = await fetch(`${url}/rest/v1/rpc/aguirra_claim_public_budget`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ server_token: secret, budget_kind: kind, visitor_hash: visitor }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new AppError(503, 'A verificação do limite gratuito está indisponível. Tente novamente mais tarde.');
  if (await response.json() !== true) throw new AppError(429, kind === 'google' ? 'A cota diária de pesquisa do Aguirra terminou. Volte amanhã; nenhuma consulta paga será feita.' : 'Você atingiu o limite de perguntas desta hora. Aguarde antes de continuar.');
}
