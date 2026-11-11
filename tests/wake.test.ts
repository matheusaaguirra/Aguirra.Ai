import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup(supported = true) {
  const instances: any[] = [], tasks = new Map<number, () => void>(), commands: string[] = [], statuses: any[] = [];
  let serial = 0;
  const root: any = {
    isSecureContext: true,
    setTimeout(fn: () => void) { tasks.set(++serial, fn); return serial; },
    clearTimeout(id: number) { tasks.delete(id); },
    SpeechRecognition: supported ? function (this: any) {
      instances.push(this); this.start = () => this.onstart(); this.abort = () => {};
    } : undefined
  };
  vm.runInNewContext(readFileSync('public/microphone.js', 'utf8'), root);
  const wake = root.AguirraWake;
  wake.configure({ onCommand: (text: string) => commands.push(text), onStatus: (...args: any[]) => statuses.push(args) });
  function say(text: string) {
    instances.at(-1).onresult({resultIndex: 0, results: [Object.assign([{transcript: text}], {isFinal: true})]});
  }
  return { wake, instances, commands, statuses, tasks, say };
}
test('Wake mode ignores background speech, accepts one command after Aguirra and discards stale results', () => {
  const f = setup(); f.wake.toggle(); f.say('Qual é a capital do Brasil?'); assert.equal(f.commands.length, 0);
  f.say('Aguirra, qual é a capital do Brasil?'); assert.deepEqual(f.commands, ['qual é a capital do Brasil?']);
  f.say('Aguirra repita'); assert.equal(f.commands.length, 1);
  f.wake.pause(false); f.say('aguirra'); assert.equal(f.commands.length, 1);
  f.say('Que horas são?'); assert.equal(f.commands.length, 2);
});
test('Wake mode expires a name-only activation, pauses during playback and restarts after browser end', () => {
  const f = setup(); f.wake.toggle(); f.say('Aguirra'); [...f.tasks.values()].forEach(fn => fn()); f.tasks.clear();
  f.say('fala ambiente'); assert.equal(f.commands.length, 0);
  f.instances.at(-1).onend(); [...f.tasks.values()].forEach(fn => fn()); f.tasks.clear();
  assert.equal(f.instances.length, 2);
  f.wake.pause(true); f.say('Aguirra, oi'); assert.equal(f.commands.length, 0);
  f.wake.pause(false); f.say('Aguirra, oi'); assert.deepEqual(f.commands, ['oi']);
});
test('Permission denial and unsupported browsers stop the wake loop', () => {
  const f = setup(); f.wake.toggle(); f.instances[0].onerror({error: 'not-allowed'});
  assert.equal(f.statuses.at(-1)[1], false); assert.equal(f.tasks.size, 0);
  const unsupported = setup(false); unsupported.wake.toggle();
  assert.equal(unsupported.statuses.at(-1)[1], false);
});

test('Hidden pages cannot restart recognition or accept late transcripts', () => {
  const f = setup();
  const document = { hidden: false };
  // Expose visibility as the browser does, including before visibilitychange is dispatched.
  const root: any = {document, isSecureContext: true, SpeechRecognition: function (this: any) {
    f.instances.push(this); this.start = () => {}; this.abort = () => {};
  }, setTimeout: () => 1, clearTimeout() {}};
  vm.runInNewContext(readFileSync('public/microphone.js', 'utf8'), root);
  root.AguirraWake.configure({onCommand: (text: string) => f.commands.push(text), onStatus() {}});
  root.AguirraWake.toggle();
  const old = f.instances.at(-1);
  document.hidden = true;
  old.onresult({results: [Object.assign([{transcript: 'Aguirra responda'}], {isFinal: true})]});
  assert.equal(f.commands.length, 0);
  root.AguirraWake.pause(true); root.AguirraWake.pause(false);
  assert.equal(f.instances.length, 1);
  document.hidden = false;
  root.AguirraWake.pause(true); root.AguirraWake.pause(false);
  assert.equal(f.instances.length, 2);
});
