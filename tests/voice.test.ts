import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { speechText, serverVoiceAvailable } from '../agent/lib/voice.ts';

test('Speech text omits raw URLs and bounds long responses', () => {
  assert.equal(speechText('Olá. https://example.com/source **Resposta**'), 'Olá.  Resposta');
  assert.equal(speechText('a'.repeat(7000)).length, 6000);
  if (process.platform !== 'win32') assert.equal(serverVoiceAvailable(), false);
});
test('Synthetic browser voice prefers installed local Brazilian Portuguese and can stop', () => {
  let spoken: any, canceled = 0;
  const context: any = {
    speechSynthesis: { cancel() { canceled++; }, getVoices() { return [{ name: 'English', lang: 'en-US', localService: true }, { name: 'Português local', lang: 'pt-BR', localService: true }]; }, speak(value: any) { spoken = value; } },
    SpeechSynthesisUtterance: function(this: any, text: string) { this.text = text; },
  };
  vm.runInNewContext(readFileSync('public/voice.js','utf8'), context);
  context.AguirraVoice.speak('Olá, eu sou o Aguirra.');
  assert.equal(spoken.voice.name, 'Português local'); assert.equal(spoken.lang, 'pt-BR');
  context.AguirraVoice.stop(); assert.ok(canceled >= 2);
});
test('Old browsers can play a local computer WAV without a speech synthesis API', () => {
  let source = '', played = false;
  const context: any = { Audio: function(this: any, src: string) { source = src; this.play = () => { played = true; }; this.pause = () => {}; } };
  vm.runInNewContext(readFileSync('public/voice.js','utf8'), context);
  context.AguirraVoice.configure({ server: true });
  context.AguirraVoice.speak('Uma resposta', 'own-message');
  assert.equal(source, '/api/voice?id=own-message'); assert.equal(played, true);
});
test('Guest audio uses POST without exposing the reply in a URL and cancels stale requests', () => {
  let xhr: any, played = '', revoked = false;
  const context: any = {
    XMLHttpRequest: function(this: any) { xhr = this; this.open = (method: string, path: string) => { assert.equal(method, 'POST'); assert.equal(path, '/api/voice'); }; this.setRequestHeader = () => {}; this.send = (data: string) => { assert.equal(JSON.parse(data).text, 'Minha resposta local'); }; this.abort = () => {}; },
    URL: { createObjectURL: () => 'blob:guest-voice', revokeObjectURL: () => { revoked = true; } },
    Audio: function(this: any, src: string) { this.play = () => { played = src; }; this.pause = () => {}; },
  };
  vm.runInNewContext(readFileSync('public/voice.js', 'utf8'), context);
  context.AguirraVoice.configure({ server: true }); context.AguirraVoice.speak('Minha resposta local');
  xhr.status = 200; xhr.response = {}; xhr.onload(); assert.equal(played, 'blob:guest-voice');
  context.AguirraVoice.stop(); assert.equal(revoked, true);
  context.AguirraVoice.speak('Minha resposta local'); const stale = xhr; context.AguirraVoice.stop(); played = ''; stale.onload(); assert.equal(played, '');
});

test('Natural Portuguese voice, sentence captions and speaking lifecycle stay synchronized; stop cancels the queue', () => {
  const spoken: any[] = [], captions: string[] = [], states: string[] = [];
  const context: any = {
    speechSynthesis: { cancel() {}, getVoices() { return [{name:'Português básico', lang:'pt-BR', localService:true}, {name:'Microsoft Francisca Natural', lang:'pt-BR', localService:false}]; }, speak(value: any) { spoken.push(value); } },
    SpeechSynthesisUtterance: function(this: any, text: string) { this.text = text; }
  };
  vm.runInNewContext(readFileSync('public/voice.js','utf8'), context);
  context.AguirraVoice.configure({onState: (s: string) => states.push(s), onCaption: (s: string) => captions.push(s)});
  context.AguirraVoice.speak('Resposta da IA, sem pesquisa verificada na web.\n\nOlá. Vamos conversar? Tudo bem.');
  assert.equal(spoken[0].voice.name, 'Microsoft Francisca Natural'); assert.equal(spoken[0].pitch, 1); assert.equal(spoken[0].rate, 1);
  assert.equal(spoken[0].text, 'Olá.'); assert.equal(states.at(-1), 'idle');
  spoken[0].onstart(); assert.equal(states.at(-1), 'speaking'); assert.equal(captions[0], 'Olá.');
  spoken[0].onend(); assert.equal(spoken[1].text, 'Vamos conversar?'); spoken[1].onstart(); assert.equal(captions[1], 'Vamos conversar?');
  context.AguirraVoice.stop(); spoken[1].onend(); assert.equal(spoken.length, 2); assert.equal(states.at(-1), 'idle');
  context.AguirraVoice.setVoice('Português básico'); context.AguirraVoice.speak('Teste.'); assert.equal(spoken[2].voice.name, 'Português básico');
});
test('Speech preserves long content across bounded chunks and reports autoplay blocking without an animated speaking state', () => {
  const spoken: any[] = [], states: string[] = [];
  const text = 'Uma frase com pausas naturais e palavras. '.repeat(30).trim();
  const context: any = {speechSynthesis: {cancel() {}, getVoices() {return [{name:'Português',lang:'pt-BR'}];}, speak(v: any) {spoken.push(v);}}, SpeechSynthesisUtterance: function(this: any, text: string) {this.text = text;}};
  vm.runInNewContext(readFileSync('public/voice.js','utf8'), context); context.AguirraVoice.configure({onState: (s: string) => states.push(s)});
  context.AguirraVoice.speak(text); for(let i = 0; i < spoken.length; i++) {assert.ok(spoken[i].text.length <= 220); spoken[i].onend();}
  assert.equal(spoken.map(s => s.text).join(' '), text);
  context.AguirraVoice.speak('Teste de áudio.'); spoken.at(-1).onerror({error:'not-allowed'}); assert.equal(states.at(-1), 'blocked');
  assert.equal(speechText('Consulta a fontes públicas.\n\nUma resposta.'), 'Uma resposta.');
});
