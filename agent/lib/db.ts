export class AppError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export interface Session { user: { id: string; email: string }; token: string; cookies: string[]; }
export function config() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new AppError(503, "O acesso à nuvem está sendo configurado. A memória neste aparelho continua disponível.");
  return { url, key };
}
export async function authFetch(path: string, body?: unknown, token?: string) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, { method: body ? "POST" : "GET", headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
  const data = await response.json();
  if (!response.ok) throw new AppError(response.status === 429 ? 429 : 401, response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : (data.error_code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : "Não consegui autenticar. Confira e-mail, senha e a confirmação da sua conta."));
  return data;
}
export function sessionCookies(data: { access_token: string; refresh_token: string }, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return [`aguirra_access=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`, `aguirra_refresh=${data.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`];
}
function cookie(request: Request, key: string) { return (request.headers.get("cookie") || "").split(";").map(p => p.trim()).find(p => p.startsWith(`${key}=`))?.slice(key.length + 1); }
export async function getSession(request: Request, optional = false): Promise<Session | null> {
  const token = cookie(request, "aguirra_access"), refresh = cookie(request, "aguirra_refresh");
  if (token) { try { const user = await authFetch("user", undefined, token); return { user, token, cookies: [] }; } catch (err) { if (!(err instanceof AppError) || err.status !== 401) throw err; } }
  if (refresh) { try { const data = await authFetch("token?grant_type=refresh_token", { refresh_token: refresh }); return { user: data.user, token: data.access_token, cookies: sessionCookies(data, request) }; } catch (err) { if (!(err instanceof AppError) || err.status !== 401) throw err; } }
  if (optional) return null;
  throw new AppError(401, "Entre na sua conta para conversar com a IA e acessar sua memória na nuvem.");
}
export async function db<T = any[]>(session: Session, path: string, method = "GET", body?: unknown, prefer = "return=representation"): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${session.token}`, "Content-Type": "application/json", Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) { if (response.status === 409) throw new AppError(409, "Este pedido já foi recebido. Confira o histórico antes de reenviar."); throw new AppError(response.status === 401 ? 401 : 503, "Não consegui salvar ou recuperar seus dados. Tente novamente."); }
  const content = await response.text(); return (content ? JSON.parse(content) : []) as T;
}
export async function loadData(session: Session) {
  const [memories, threads, messages, topicRows, settings] = await Promise.all([
    db(session, "aguirra_memories?select=*&order=updated_at.desc&limit=500"), db(session, "aguirra_threads?select=*&order=created_at.desc&limit=100"),
    db(session, "aguirra_messages?select=*&order=created_at.desc&limit=1000"), db(session, "aguirra_topics?select=*&order=name"), db(session, "aguirra_settings?select=*&limit=1"),
  ]);
  return { memories, threads, messages: messages.reverse(), topics: topicRows, settings: settings[0] || { memory_enabled: true } };
}
export function safeOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new AppError(403, "Origem do pedido não autorizada.");
  const type = request.headers.get("content-type") || "";
  if (request.method !== "DELETE" && !type.startsWith("application/json")) throw new AppError(415, "Envie o pedido como JSON.");
}
