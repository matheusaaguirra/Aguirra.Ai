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
