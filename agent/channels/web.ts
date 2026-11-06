import { defineChannel, GET, POST, DELETE, type RouteHandlerArgs } from "eve/channels";
import { visitor, visitorData, store, namespace, digest, item, stableId, importedItems, legacyBatch } from "../lib/cloud-graph.ts";
import answerCache from "../../shared/answer-cache.cjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, authFetch, config, db, getSession, loadData, safeOrigin, sessionCookies, type Session } from "../lib/db.ts";
import { categories, extract, normalize, redact, relevant, sensitive, topics, type Memory } from "../lib/memory.ts";
import { localLogout, localMode } from "../lib/local-store.ts";
import { answerQuestion, guestInput, guestContext, guestLearned } from "../lib/answers.ts";
import { googleReady } from "../lib/google.ts";
import { intent, identityAnswer } from "../lib/questions.ts";
import { claimPublicBudget } from "../lib/public-budget.ts";
import { googleLoginAvailable, startGoogleLogin, completeGoogleLogin } from "../lib/google-login.ts";
import { assistantLog, assistantHistory } from "../lib/assistant-log.ts";
import { elevenReady, elevenSpeech, elevenTranscribe } from "../lib/elevenlabs.ts";
import { serverVoiceAvailable, synthesizeWave } from "../lib/voice.ts";

const uuid = z.string().uuid();
const memoryInput = z.object({ id: uuid.nullish(), category: z.enum(categories), content: z.string().trim().min(3).max(500) });
function json(data: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
  cookies.forEach(c => headers.append("Set-Cookie", c)); return new Response(JSON.stringify(data), { status, headers });
}
async function body(request: Request, limit = 128_000) {
  const reader = request.body?.getReader(); if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new AppError(413, "O pedido excedeu o limite de tamanho."); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError(400, "Pedido JSON inválido."); }
}
async function saveMemory(session: Session, input: z.infer<typeof memoryInput>) {
  if (sensitive(input.content)) throw new AppError(400, "Credenciais e dados sensíveis não entram no núcleo. Guarde preferências, objetivos e projetos.");
  if (input.id) {
    const previous = await db(session, `aguirra_memories?id=eq.${input.id}&select=source_message_id`);
    if (previous[0]?.source_message_id) await db(session, `aguirra_messages?id=eq.${previous[0].source_message_id}`, "PATCH", { exclude_context: true });
    return db(session, `aguirra_memories?id=eq.${input.id}`, "PATCH", { content: input.content, category: input.category, origin: "manual", source_message_id: null, updated_at: new Date().toISOString() });
  }
  return db(session, "aguirra_memories?on_conflict=user_id,key", "POST", { user_id: session.user.id, key: normalize(input.content).slice(0, 100), category: input.category, content: input.content, origin: "manual", source_message_id: null, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=representation");
}
export async function guestChat(request: Request, args: RouteHandlerArgs) {
  const input = guestInput.parse(await body(request)), space = visitor(request);
  await claimPublicBudget('guest', args.requestIp || 'unknown');
  const data = await visitorData(space.owner);
  const previous = data.messages.find(m => m.id === input.request_id);
  const saved = previous && data.messages.find(m => m.id === previous.reply_id);
  if (saved) return json({reply:saved.content,answer_id:saved.id,sources:saved.sources || []},200,space.cookies);
  const message = redact(input.message), enabled = data.settings.memory_enabled !== false;
  const learned = enabled ? extract(message) : [];
  const hit = input.force_refresh ? null : answerCache.find(message,data.messages,data.memories,enabled);
  const context = guestContext({...input,message,history:assistantHistory(data.messages,input.request_id),memories:data.memories,memory_enabled:enabled});
  context.points = answerCache.related(message,data.messages,data.memories,enabled);
  const started = new Date().toISOString(), aid = stableId('reply/' + input.request_id);
  let result, status = 200;
  try {
    result = hit ? {reply:hit.answer.content,sources:hit.answer.sources || [],mode:'answer_memory'} : await answerQuestion(message,context,learned);
  } catch (e) {
    status = e instanceof AppError ? e.status : 503;
    result = {reply:e instanceof AppError ? e.message : 'Não consegui responder agora.',sources:[],mode:'error'};
  }
  const meta = hit ? {...hit.answer.cache_meta,reused_from:hit.question.id} : answerCache.makeMeta(message,result.reply,result.mode || '',data.memories,enabled);
  if(meta && !hit) meta.related_to = context.points.map(p=>p.id);
  const q = {id:input.request_id,thread_id:'visitor',role:'user',content:message,reply_id:aid,created_at:started};
  const a = {id:aid,thread_id:'visitor',role:'assistant',content:result.reply,sources:result.sources,cache_meta:meta,failed:status!==200,created_at:new Date().toISOString()};
  await store(space.owner,'put',[item('message',q.id,q),item('message',aid,a),...learned.map(m=>item('memory',m.key,{...m,id:stableId(m.key),source_message_id:q.id,updated_at:started}))]);
  return json(status===200 ? {...result,answer_id:aid,cached:!!hit,cache_meta:meta,learned:!!learned.length} : {error:result.reply},status,space.cookies);
}
export async function chat(request: Request, args: RouteHandlerArgs, session: Session) {
  const input = z.object({ message: z.string().trim().min(1).max(4000), thread_id: uuid.nullish(), request_id: uuid, force_refresh: z.boolean().default(false) }).parse(await body(request));
  const duplicate = await db(session, `aguirra_messages?id=eq.${input.request_id}&select=thread_id,reply_id`);
  if (duplicate.length) {
    if (duplicate[0].reply_id) { const replies = await db(session, `aguirra_messages?id=eq.${duplicate[0].reply_id}&select=id,content,sources,search_entry_point,cache_meta`); return json({ answer_id: replies[0]?.id, cache_meta: replies[0]?.cache_meta, thread_id: duplicate[0].thread_id, reply: replies[0]?.content || "Pedido já processado.", sources: replies[0]?.sources || [], search_entry_point: replies[0]?.search_entry_point, learned: false }, 200, session.cookies); }
    throw new AppError(409, "Este pedido já foi recebido. Aguarde a conclusão ou confira o histórico.");
  }
  const quota = await db<boolean>(session, "rpc/aguirra_claim_request", "POST", {});
  if (!quota) throw new AppError(429, "Seu limite desta hora foi atingido. Aguarde antes de enviar novas perguntas.");
  const message = redact(input.message), threadId = await assistantLog(session);
  // Identity needs no memories or past replies, but remains recorded in the same history.
  const directIdentity = identityAnswer(message);
  const [, data] = await Promise.all([db(session, "aguirra_messages", "POST", { id: input.request_id, user_id: session.user.id, thread_id: threadId, role: "user", content: message }), directIdentity ? Promise.resolve(null) : loadData(session)]);
  const learned = !data || data.settings.memory_enabled === false ? [] : extract(message);
  for (const memory of learned) await db(session, "aguirra_memories?on_conflict=user_id,key", "POST", { user_id: session.user.id, ...memory, source_message_id: input.request_id, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=representation");
  await Promise.all((directIdentity ? [] : topics(message)).map(name => db(session, "rpc/aguirra_touch_topic", "POST", { topic_name: name })));
  const allMemories: Memory[] = !data ? [] : learned.length ? await db(session, "aguirra_memories?select=*&order=updated_at.desc&limit=500") : data.memories;
  const context = intent(message) === "memory" ? allMemories.slice(0, 50) : relevant(allMemories, message);
  const previous = data ? assistantHistory(data.messages, input.request_id) : [];
  try {
    const reused = !input.force_refresh && data ? answerCache.find(message, data.messages, allMemories, data.settings.memory_enabled) : null;
    const points = data ? answerCache.related(message,data.messages,allMemories,data.settings.memory_enabled) : [];
    const result = reused ? { reply: reused.answer.content, sources: reused.answer.sources || [], search_entry_point: null, mode: "answer_memory" } : await answerQuestion(message, { history: previous, points, memories: context.map(m => ({ category: m.category, content: m.content })) }, learned);
    const { reply, sources, search_entry_point, mode } = result;
    const cache_meta = reused ? { ...reused.answer.cache_meta, reused_from: reused.question.id } : answerCache.makeMeta(message, reply, mode || "", allMemories, data?.settings.memory_enabled);
    if(cache_meta && !reused) cache_meta.related_to = points.map(p => p.id);
    const replyId = randomUUID();
    await db(session, "aguirra_messages", "POST", { id: replyId, user_id: session.user.id, thread_id: threadId, role: "assistant", content: reply, cache_meta, sources, search_entry_point: search_entry_point || null });
    await db(session, `aguirra_messages?id=eq.${input.request_id}`, "PATCH", { reply_id: replyId });
    return json({ cached: !!reused, cache_meta, thread_id: threadId, answer_id: replyId, reply, learned: learned.length > 0, sources, search_entry_point, mode }, 200, session.cookies);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Não consegui concluir a resposta. No modo local, confira se o Ollama está aberto e o modelo foi baixado. Seu pedido e as memórias já formadas foram salvos.";
    await db(session, "aguirra_messages", "POST", { user_id: session.user.id, thread_id: threadId, role: "assistant", content: message, failed: true });
    return json({ error: message, thread_id: threadId }, error instanceof AppError ? error.status : 503, session.cookies);
  }
}
function checkImported(records: any[], messages: any[], memories: any[]) {
  const complete = records.every(record => record.kind === 'message'
    ? messages.some(m => m.id === record.id && m.content === record.content && m.role === record.role)
    : memories.some(m => m.key === record.key && m.content === record.content && m.category === record.category));
  if (!complete) throw new AppError(409,'Já existe um registro diferente com o mesmo identificador. O histórico anterior foi preservado.');
}
async function verifyImported(session: Session, records: any[]) {
  const ids = records.filter(r => r.kind === 'message').map(r => uuid.parse(r.id));
  const [messages, memories] = await Promise.all([
    ids.length ? db(session,'aguirra_messages?select=id,role,content&id=in.('+ids.join(',')+')') : [],
    records.some(r => r.kind === 'memory') ? db(session,'aguirra_memories?select=key,category,content') : []
  ]);
  checkImported(records,messages,memories);
}
async function handle(request: Request, args: RouteHandlerArgs): Promise<Response> {
  let session: Session | null = null;
  try {
    safeOrigin(request); const url = new URL(request.url), resource = args.params.resource;
    if (resource === "google" && request.method === "POST") return await startGoogleLogin(request);
    if (resource === "google-callback" && request.method === "GET") return await completeGoogleLogin(request);
    if (resource === "session" && request.method === "GET") {
      session = await getSession(request, true);
      const space = localMode() ? null : visitor(request);
      return json({ visitor_available: !!(space?.existing), user: session?.user || null, local: localMode(), ai: googleReady() || (localMode() && process.env.AGUIRRA_AI_ENABLED !== "false"), guest_chat: true, google_login: await googleLoginAvailable(), google_ready: googleReady(), google_search: false, model: googleReady() ? "gemini-3.5-flash-lite" : null, search: true, search_mode: googleReady() ? "public_sources" : "rss", paid_apis: false, tts_server: serverVoiceAvailable(), elevenlabs_ready: elevenReady(), transcription_ready: elevenReady() }, 200, session ? session.cookies : space?.cookies);
    }
    if (resource === "auth" && request.method === "POST") {
      const input = z.object({ mode: z.enum(["login", "register"]), email: z.string().email().max(254), password: z.string().min(8).max(128) }).parse(await body(request));
      const data = await authFetch(input.mode === "login" ? "token?grant_type=password" : "signup", { email: input.email, password: input.password });
      return data.access_token ? json({ user: data.user }, 200, sessionCookies(data, request)) : json({ message: "Confira seu e-mail para confirmar sua conta. Depois, volte aqui para entrar." });
    }
    if (resource === "logout" && request.method === "POST") {
      session = await getSession(request, true); if (session && localMode()) localLogout(session.token); else if (session) { const { url: base, key } = config(); const result = await fetch(`${base}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(10_000) }); if (!result.ok && result.status !== 401) throw new AppError(503, "Não foi possível encerrar a sessão. Tente novamente."); }
      return json({ ok: true }, 200, ["aguirra_access=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0", "aguirra_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"]);
    }
    if ((resource === "ask" || resource === "chat") && request.method === "POST") {
      session = await getSession(request, true);
      return session ? await chat(request, args, session) : await guestChat(request, args);
    }
    if ((resource === "speech" || resource === "transcribe") && request.method === "POST") {
      if (!elevenReady()) throw new AppError(503, "ElevenLabs aguarda a chave de uma conta gratuita no servidor.");
      await claimPublicBudget('guest', args.requestIp || 'unknown');
      if (resource === "speech") { const input = z.object({ text: z.string().trim().min(1).max(1500) }).parse(await body(request)); if(localMode()) return json(await elevenSpeech(input.text));
        const current = await getSession(request,true), space = visitor(request);
        const owner = current ? namespace('audio/' + current.user.id) : space.owner;
        const key = digest('flash-v1/' + (process.env.ELEVENLABS_VOICE_ID || 'George') + '/' + input.text);
        const cached = !localMode() && await store(owner,'audio',[],key);
        if(cached) return json(cached,200,current?.cookies || space.cookies);
        const audio = await elevenSpeech(input.text);
        await store(owner,'put',[item('audio',key,audio)]);
        return json(audio,200,current?.cookies || space.cookies); }
      const input = z.object({ audio: z.string().min(1).max(900000) }).parse(await body(request, 950000));
      return json({ text: await elevenTranscribe(input.audio) });
    }
    if (resource === "voice" && request.method === "POST") {
      if (!serverVoiceAvailable()) throw new AppError(503, "Use uma voz disponível no navegador ou execute o Aguirra no Windows.");
      const input = z.object({ text: z.string().trim().min(1).max(6000) }).parse(await body(request));
      await claimPublicBudget('guest', args.requestIp || 'unknown');
      const wave = await synthesizeWave(input.text);
      return new Response(new Uint8Array(wave).buffer, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    session = await getSession(request, true);
    if (resource === 'import-graph' && request.method === 'POST') {
      const entries = importedItems(legacyBatch.parse(await body(request, 1800000)));
      const records = entries.map(entry => entry.value);
      if (session) {
        await db(session,'rpc/aguirra_import_graph','POST',{batch:records});
        await verifyImported(session,records);
        return json({ok:true},200,session.cookies);
      }
      const space = visitor(request);
      await claimPublicBudget('guest',args.requestIp || 'unknown');
      await store(space.owner,'import',entries);
      const saved = await visitorData(space.owner);
      checkImported(records,saved.messages,saved.memories);
      return json({ok:true},200,space.cookies);
    }
    if (resource === 'adopt-visitor' && request.method === 'POST' && session) {
      const space = visitor(request);
      if (space.existing) {
        const old = await visitorData(space.owner);
        const records = old.messages.concat(old.memories);
        for (let i=0;i<records.length;i+=50) {
          const batch=records.slice(i,i+50);
          await db(session,'rpc/aguirra_import_graph','POST',{batch});
          await verifyImported(session,batch);
        }
      }
      return json({ok:true},200,[...session.cookies,'aguirra_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
    }
    if (!session) {
      const space = visitor(request);
      if (resource === 'data' && request.method === 'GET') return json(await visitorData(space.owner),200,space.cookies);
      if (request.method !== 'GET') await claimPublicBudget('guest',args.requestIp || 'unknown');
      if (resource === 'memory' && request.method === 'POST') {
        const m=memoryInput.parse(await body(request)); if(sensitive(m.content)) throw new AppError(400,'Dados sensíveis não entram no núcleo.');
        const existing = m.id ? (await visitorData(space.owner)).memories.find(r => r.id===m.id) : null;
        const id=m.id || randomUUID(), key=existing ? existing.key : id; await store(space.owner,'put',[item('memory',key,{...m,id,key,origin:'manual',updated_at:new Date().toISOString()})]);
      } else if(resource === 'memory' && request.method === 'DELETE') {
        const id=uuid.parse(url.searchParams.get('id')); const current=await visitorData(space.owner); const memory=current.memories.find(m=>m.id===id); if(memory) await store(space.owner,'remove_memory',[],memory.key);
      } else if(resource === 'settings' && request.method === 'POST') {
        const settings=z.object({memory_enabled:z.boolean()}).parse(await body(request)); await store(space.owner,'put',[item('setting','current',settings)]);
      } else if(resource === 'data' && request.method === 'DELETE') await store(space.owner,'clear');
      else throw new AppError(404,'Rota não encontrada.');
      return json({ok:true},200,space.cookies);
    }
    if (resource === "voice" && request.method === "GET") {
      if (!serverVoiceAvailable()) throw new AppError(503, "Use a voz do navegador ou execute o Aguirra no Windows para gerar o áudio localmente.");
      const sample = url.searchParams.get("sample") === "1";
      let text = "Olá. Eu sou o Aguirra, seu assistente pessoal. Estou pronto para conversar com você.";
      if (!sample) { const id = uuid.parse(url.searchParams.get("id")); const messages = await db(session, `aguirra_messages?id=eq.${id}&select=role,content`); if (!messages[0] || messages[0].role !== "assistant") throw new AppError(404, "Resposta não encontrada."); text = messages[0].content; }
      const wave = await synthesizeWave(text);
      const headers = new Headers({ "Content-Type": "audio/wav", "Cache-Control": "private,no-store", "X-Content-Type-Options": "nosniff" }); session.cookies.forEach(c => headers.append("Set-Cookie",c));
      return new Response(new Uint8Array(wave).buffer, { headers });
    }
    if (resource === "data" && request.method === "GET") return json(await loadData(session), 200, session.cookies);
    if (resource === "memory" && request.method === "POST") { await saveMemory(session, memoryInput.parse(await body(request))); return json({ ok: true }, 200, session.cookies); }
    if (resource === "memory" && request.method === "DELETE") {
      const id = uuid.parse(url.searchParams.get("id")); const found = await db(session, `aguirra_memories?id=eq.${id}&select=source_message_id`);
      if (found[0]?.source_message_id) await db(session, `aguirra_messages?id=eq.${found[0].source_message_id}`, "PATCH", { exclude_context: true });
      await db(session, `aguirra_memories?id=eq.${id}`, "DELETE"); return json({ ok: true }, 200, session.cookies);
    }
    if (resource === "settings" && request.method === "POST") { const input = z.object({ memory_enabled: z.boolean() }).parse(await body(request)); await db(session, "aguirra_settings?on_conflict=user_id", "POST", { user_id: session.user.id, ...input }, "resolution=merge-duplicates,return=representation"); return json({ ok: true }, 200, session.cookies); }
    if (resource === "import" && request.method === "POST") { const input = z.object({ memories: z.array(memoryInput.omit({ id: true })).max(100) }).parse(await body(request)); for (const m of input.memories) if (!sensitive(m.content)) await saveMemory(session, m); return json({ ok: true }, 200, session.cookies); }
    if (resource === "data" && request.method === "DELETE") { await db(session, "rpc/aguirra_forget_all", "POST", {}); if(!localMode()) await store(namespace('audio/'+session.user.id),'clear_audio'); return json({ ok: true }, 200, session.cookies); }
    return json({ error: "Rota não encontrada." }, 404, session.cookies);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Confira os campos enviados. A mensagem pode ter até 4.000 caracteres e a memória até 500." }, 400, session?.cookies);
    if (error instanceof AppError) return json({ error: error.message }, error.status, session?.cookies);
    console.error("aguirra_request_failed", error instanceof Error ? error.name : "unknown", error instanceof Error ? error.message.slice(0, 180) : "", (error as any)?.cause?.code || "");
    return json({ error: "Não consegui concluir o pedido agora. Confira sua conexão e tente novamente." }, 503, session?.cookies);
  }
}
export default defineChannel({ routes: [GET("/api/:resource", handle), POST("/api/:resource", handle), DELETE("/api/:resource", handle)] });
