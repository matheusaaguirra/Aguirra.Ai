import test from 'node:test';
import assert from 'node:assert/strict';
import {checkFreePlan, elevenReady, elevenSpeech, elevenTranscribe, validateRecording, ELEVEN_MODEL, ELEVEN_NUMERIC_MODEL} from '../agent/lib/elevenlabs.ts';
const free = {tier:'free', can_extend_character_limit:false, max_credit_limit_extension:0, character_count:0, character_limit:10000};
function wave(seconds = 1) {const b = Buffer.alloc(44+seconds*32000); b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVE',8); b.write('fmt ',12); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(16000,24); b.writeUInt32LE(32000,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(b.length-44,40); return b.toString('base64');}
test('ElevenLabs only generates on a verified Free plan without overages; errors never trigger paid retries', async () => {
  const fetch = globalThis.fetch, key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID; let calls: string[] = [], plan: any = {...free};
  try {
    delete process.env.ELEVENLABS_API_KEY; assert.equal(elevenReady(),false); await assert.rejects(elevenSpeech('Olá'),/chave/);
    process.env.ELEVENLABS_API_KEY = 'disposable-test-key'; process.env.ELEVENLABS_VOICE_ID = 'test_voice_123';
    globalThis.fetch = async (url, options) => {calls.push(String(url)); assert.equal(new Headers(options?.headers).get('xi-api-key'), 'disposable-test-key'); if (String(url).endsWith('/user/subscription')) return Response.json(plan); assert.match(String(url),/text-to-speech\/test_voice_123\/with-timestamps/); const body=JSON.parse(String(options?.body)); assert.equal(body.model_id,ELEVEN_MODEL); assert.equal(body.text,'Olá.'); return Response.json({audio_base64:'SUQz',normalized_alignment:{characters:['O','l','á','.'],character_start_times_seconds:[0,.1,.2,.3]}});};
    const result = await elevenSpeech('Olá.'); assert.equal(result.provider,'elevenlabs'); assert.equal(calls.length,2);
    for (const invalid of [{...free,tier:'creator'},{...free,can_extend_character_limit:true},{...free,max_credit_limit_extension:'unlimited'},{...free,max_credit_limit_extension:undefined}]) {plan=invalid; const before:number=calls.length; await assert.rejects(elevenSpeech('Olá.'),/Free/); assert.equal(calls.length,before+1);}
    plan={...free,character_count:9999}; await assert.rejects(checkFreePlan(5),/créditos gratuitos/);
    plan={...free}; globalThis.fetch=async()=>{calls.push('failed');return new Response('',{status:429});}; const before:number=calls.length; await assert.rejects(elevenSpeech('Olá.'),/cota gratuita/); assert.equal(calls.length,before+1);
  } finally {globalThis.fetch=fetch; if(key===undefined)delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=key;if(voice===undefined)delete process.env.ELEVENLABS_VOICE_ID;else process.env.ELEVENLABS_VOICE_ID=voice;}
});
test('Voice recording bounds and format are validated before upload, then Scribe receives Portuguese WAV', async () => {
  assert.equal(validateRecording(wave()).length,32044); assert.throws(()=>validateRecording(wave(21)),/20 segundos/); assert.throws(()=>validateRecording(Buffer.from('not audio').toString('base64')),/WAV/);
  const fetch=globalThis.fetch,key=process.env.ELEVENLABS_API_KEY; let calls=0;
  try { process.env.ELEVENLABS_API_KEY='disposable'; globalThis.fetch=async(url,options)=>{calls++; if(String(url).endsWith('/user/subscription'))return Response.json(free); assert.equal(String(url),'https://api.elevenlabs.io/v1/speech-to-text'); const form=options?.body as FormData; assert.equal(form.get('model_id'),'scribe_v2');assert.equal(form.get('language_code'),'por');assert.equal((form.get('file') as File).type,'audio/wav');return Response.json({text:'Qual é a data de hoje?'});};
    assert.equal(await elevenTranscribe(wave()),'Qual é a data de hoje?');assert.equal(calls,2);
    await assert.rejects(elevenTranscribe('bad'),/20 segundos|WAV/);assert.equal(calls,2);
  }finally{globalThis.fetch=fetch;if(key===undefined)delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=key;}
});

test('Conversational speech uses fast Portuguese synthesis while dates retain free number normalization', async () => {
  const fetch = globalThis.fetch, key = process.env.ELEVENLABS_API_KEY; const bodies: any[] = [];
  try {
    process.env.ELEVENLABS_API_KEY = 'disposable';
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/user/subscription')) return Response.json(free);
      bodies.push(JSON.parse(String(options?.body))); return Response.json({ audio_base64: 'SUQz' });
    };
    await elevenSpeech('Sou o Aguirra, seu assistente pessoal.');
    await elevenSpeech('Hoje é 6 de novembro de 2026, às 14:30.');
    assert.equal(bodies[0].model_id, ELEVEN_MODEL); assert.equal(bodies[0].language_code, 'pt');
    assert.equal(bodies[1].model_id, ELEVEN_NUMERIC_MODEL);
    for (const body of bodies) assert.equal(body.apply_text_normalization, undefined, 'Never request Enterprise-only normalization');
  } finally { globalThis.fetch = fetch; if (key === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = key; }
});
