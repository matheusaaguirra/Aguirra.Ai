import { AppError } from './db.ts';
import { speechText } from './voice.ts';
const API = 'https://api.elevenlabs.io/v1';
export const ELEVEN_MODEL = 'eleven_multilingual_v2';
export function elevenReady() { return !!process.env.ELEVENLABS_API_KEY; }
async function provider(path: string, init: RequestInit = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new AppError(503, 'A voz ElevenLabs aguarda a configuração da chave no servidor.');
  let response: Response;
  try { response = await fetch(API + path, { ...init, headers: { ...init.headers, 'xi-api-key': key }, signal: AbortSignal.timeout(55000) }); }
  catch { throw new AppError(503, 'Não consegui conectar ao ElevenLabs. Tente novamente mais tarde.'); }
  if (!response.ok) throw new AppError(response.status === 429 ? 429 : 503, response.status === 429 ? 'A cota gratuita ou o limite de voz foi atingido. Nenhum uso extra será contratado.' : 'O ElevenLabs não liberou este pedido. Confira a chave, suas permissões e a voz selecionada.');
  return response;
}
export async function checkFreePlan(needed = 1) {
  const subscription = await (await provider('/user/subscription')).json();
  const extension = subscription.max_credit_limit_extension ?? subscription.max_character_limit_extension;
  if (subscription.tier !== 'free' || subscription.can_extend_character_limit !== false || subscription.allowed_to_extend_character_limit === true || extension !== 0) throw new AppError(403, 'O Aguirra só usa ElevenLabs no plano Free, com cobrança por excedente desativada.');
  if (!Number.isFinite(subscription.character_limit) || !Number.isFinite(subscription.character_count) || subscription.character_limit - subscription.character_count < needed) throw new AppError(429, 'Os créditos gratuitos do ElevenLabs acabaram. O texto continua disponível; nenhum uso pago será feito.');
}
export async function elevenSpeech(raw: string) {
  const text = speechText(raw);
  if (!text || text.length > 1500) throw new AppError(400, 'Envie até 1.500 caracteres por trecho de voz.');
  const voice = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(voice)) throw new AppError(503, 'O identificador da voz ElevenLabs está inválido.');
  await checkFreePlan(text.length);
  const response = await provider(`/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }) });
  const result = await response.json();
  if (typeof result.audio_base64 !== 'string' || result.audio_base64.length > 3_500_000 || !/^[A-Za-z0-9+/=]+$/.test(result.audio_base64)) throw new AppError(503, 'O áudio retornado pelo ElevenLabs está inválido.');
  return { audio_base64: result.audio_base64, alignment: result.normalized_alignment || result.alignment || null, provider: 'elevenlabs' };
}
export function validateRecording(encoded: string) {
  if (!encoded || encoded.length > 900000 || !/^[A-Za-z0-9+/=]+$/.test(encoded)) throw new AppError(400, 'Grave uma pergunta de até 20 segundos.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 3244 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) !== bytes.length - 8 || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.toString('ascii', 12, 16) !== 'fmt ' || bytes.readUInt32LE(16) !== 16 || bytes.readUInt16LE(20) !== 1 || bytes.readUInt16LE(22) !== 1 || bytes.readUInt32LE(24) !== 16000 || bytes.readUInt32LE(28) !== 32000 || bytes.readUInt16LE(32) !== 2 || bytes.readUInt16LE(34) !== 16 || bytes.toString('ascii', 36, 40) !== 'data' || bytes.readUInt32LE(40) !== bytes.length - 44 || bytes.length > 640044 || bytes.length % 2) throw new AppError(400, 'O áudio deve ser uma gravação WAV mono de até 20 segundos.');
  return bytes;
}
export async function elevenTranscribe(encoded: string) {
  const bytes = validateRecording(encoded); await checkFreePlan();
  const form = new FormData(); form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'pergunta.wav'); form.append('model_id', 'scribe_v2'); form.append('language_code', 'por'); form.append('tag_audio_events', 'false');
  const result = await (await provider('/speech-to-text', { method: 'POST', body: form })).json();
  if (typeof result.text !== 'string' || !result.text.trim()) throw new AppError(422, 'Não identifiquei uma pergunta. Tente falar mais perto do microfone.');
  return result.text.trim().slice(0, 4000);
}
