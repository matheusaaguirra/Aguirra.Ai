import { AppError, db, type Session } from './db.ts';
export async function assistantLog(session: Session) {
  const id = session.user.id;
  const found = await db(session, `aguirra_threads?id=eq.${id}&select=id`);
  if (!found.length) {
    try { await db(session, 'aguirra_threads', 'POST', {id, user_id: id, title: 'Registros do Aguirra'}); }
    catch (error) { if (!(error instanceof AppError) || error.status !== 409) throw error; }
  }
  return id;
}
export function assistantHistory(messages: any[], requestId: string) {
  return messages.filter(m => m.id !== requestId && !m.exclude_context && !m.failed).slice(-6).map(m => ({role: m.role as 'user' | 'assistant', text: m.content.slice(0, 1200)}));
}
