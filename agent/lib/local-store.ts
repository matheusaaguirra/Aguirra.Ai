import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
export const localMode = () => process.env.AGUIRRA_LOCAL === "true" && !process.env.VERCEL;
let database: DatabaseSync | undefined;
function connection() {
  if (database) return database;
  const dir = resolve(process.env.AGUIRRA_DATA_DIR || ".aguirra"); mkdirSync(dir, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(join(dir, "memory.sqlite")); database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL)");
  database.prepare("INSERT OR IGNORE INTO store(id,content) VALUES(1,?)").run(JSON.stringify({ tables: {}, sessions: [], rates: {} })); return database;
}
function transaction<T>(fn: (data: any) => T): T {
  const db = connection(); db.exec("BEGIN IMMEDIATE");
  try { const data = JSON.parse((db.prepare("SELECT content FROM store WHERE id=1").get() as any).content); const result = fn(data); db.prepare("UPDATE store SET content=? WHERE id=1").run(JSON.stringify(data)); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const user = { id: LOCAL_USER_ID, email: "Aguirra local" };
function passwordMatches(password: string) {
  if (process.env.AGUIRRA_LOCAL_PASSWORD) { const a = hash(password), b = hash(process.env.AGUIRRA_LOCAL_PASSWORD); return timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  try { const config = JSON.parse(readFileSync(join(resolve(process.env.AGUIRRA_DATA_DIR || ".aguirra"), "access.json"), "utf8")); return timingSafeEqual(scryptSync(password, config.salt, 64), Buffer.from(config.hash, "hex")); } catch { return false; }
}
function newSession(data: any) {
  const access = randomBytes(32).toString("hex"), refresh = randomBytes(32).toString("hex"), family = randomUUID();
  data.sessions = data.sessions.filter((s: any) => s.expires > Date.now());
  data.sessions.push({ token: hash(access), family, kind: "access", expires: Date.now() + 3600_000 }, { token: hash(refresh), family, kind: "refresh", expires: Date.now() + 30 * 86400_000 });
  return { access_token: access, refresh_token: refresh, user };
}
export function localAuth(path: string, body?: any, token?: string) {
  if (path === "user") return transaction(data => { if (!data.sessions.some((s: any) => s.token === hash(token || "") && s.kind === "access" && s.expires > Date.now())) throw Object.assign(new Error("Sessão local expirada."), { status: 401 }); return user; });
  if (path.includes("refresh_token")) return transaction(data => { const old = data.sessions.find((s: any) => s.token === hash(body?.refresh_token || "") && s.kind === "refresh" && s.expires > Date.now()); if (!old) throw Object.assign(new Error("Sessão local expirada."), { status: 401 }); data.sessions = data.sessions.filter((s: any) => s.family !== old.family); return newSession(data); });
  if (path === "signup") throw Object.assign(new Error("O modo local usa o código exibido no terminal do computador."), { status: 400 });
  if (path.includes("grant_type=password")) {
    const allowed = transaction(data => { const bucket = String(Math.floor(Date.now() / 60000)); data.loginAttempts = data.loginAttempts || {}; data.loginAttempts = { [bucket]: (data.loginAttempts[bucket] || 0) + 1 }; return data.loginAttempts[bucket] <= 20; });
    if (!allowed) throw Object.assign(new Error("Muitas tentativas. Aguarde um minuto."), { status: 429 });
    if (!passwordMatches(body?.password || "")) throw Object.assign(new Error("Código incorreto. Confira o terminal do computador."), { status: 401 });
    return transaction(newSession);
  }
  throw Object.assign(new Error("Operação local inválida."), { status: 400 });
}
export function localLogout(token: string) { transaction(data => { const found = data.sessions.find((s: any) => s.token === hash(token)); if (found) data.sessions = data.sessions.filter((s: any) => s.family !== found.family); }); }
export function clearLocalSessions() { transaction(data => { data.sessions = []; }); }
export function closeLocalStore() { database?.close(); database = undefined; }
const tables = ["aguirra_memories", "aguirra_threads", "aguirra_messages", "aguirra_topics", "aguirra_settings"];
export function localDb(path: string, method: string, body?: any): any {
  return transaction(data => {
    const url = new URL("http://local/" + path), table = url.pathname.slice(1);
    if (table === "rpc/aguirra_claim_request") { const hour = new Date().toISOString().slice(0, 13), day = hour.slice(0, 10); const daily = Object.keys(data.rates).filter(k => k.startsWith(day)).reduce((sum, k) => sum + data.rates[k], 0); if ((data.rates[hour] || 0) >= 30 || daily >= 100) return false; data.rates = Object.fromEntries(Object.entries(data.rates).filter(([k]) => k.startsWith(day))); data.rates[hour] = (data.rates[hour] || 0) + 1; return true; }
    if (table === "rpc/aguirra_touch_topic") { const items = data.tables.aguirra_topics ||= []; const found = items.find((x: any) => x.name === body.topic_name); if (found) found.count++; else items.push({ user_id: LOCAL_USER_ID, name: body.topic_name, count: 1 }); return []; }
    if (table === "rpc/aguirra_forget_all") { for (const t of tables) if (t !== "aguirra_settings") data.tables[t] = []; return []; }
    if (!tables.includes(table)) throw new Error("Unknown local collection");
    const rows = data.tables[table] ||= [];
    const filters = [...url.searchParams].filter(([k, v]) => !["select", "order", "limit", "on_conflict"].includes(k) && v.startsWith("eq."));
    const matches = (r: any) => r.user_id === LOCAL_USER_ID && filters.every(([k, v]) => String(r[k]) === v.slice(3));
    if (method === "GET") { let found = rows.filter(matches); const order = url.searchParams.get("order"); if (order) { const [key, direction] = order.split("."); found = found.sort((a: any,b: any) => String(a[key]).localeCompare(String(b[key])) * (direction === "desc" ? -1 : 1)); } found = found.slice(0, Number(url.searchParams.get("limit") || 1000)); const select = url.searchParams.get("select"); return JSON.parse(JSON.stringify(select && select !== "*" ? found.map((r: any) => Object.fromEntries(select.split(",").map(k => [k,r[k]]))) : found)); }
    if (method === "DELETE") { data.tables[table] = rows.filter((r: any) => !matches(r)); return []; }
    if (method === "PATCH") { const result = rows.filter(matches); for (const r of result) Object.assign(r, body, { user_id: LOCAL_USER_ID }); return JSON.parse(JSON.stringify(result)); }
    if (method === "POST") {
      if (body.user_id && body.user_id !== LOCAL_USER_ID) throw new Error("Wrong local owner");
      const conflict = url.searchParams.get("on_conflict")?.split(","); const existing = conflict ? rows.find((r: any) => conflict.every(k => r[k] === body[k])) : rows.find((r: any) => body.id && r.id === body.id);
      if (existing && !conflict) throw Object.assign(new Error("Este pedido já foi recebido."), { status: 409 });
      if (existing) { Object.assign(existing, body); return [existing]; }
      const row = { id: randomUUID(), user_id: LOCAL_USER_ID, created_at: new Date().toISOString(), failed: false, exclude_context: false, sources: [], ...body };
      if (table === "aguirra_messages" && !(data.tables.aguirra_threads || []).some((t: any) => t.id === row.thread_id && t.user_id === LOCAL_USER_ID)) throw new Error("Unknown local thread");
      rows.push(row); return [row];
    }
    throw new Error("Unknown local operation");
  });
}
