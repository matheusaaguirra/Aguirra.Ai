(function (root) {
  'use strict';
  var selected = '', serverAvailable = false, generation = 0, currentSpeech = null, currentAudio = null, status = function () {}, notice = function () {};
  function voices() { try { return root.speechSynthesis && root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; } }
  function stop() { generation++; if (root.speechSynthesis) root.speechSynthesis.cancel(); if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; } currentSpeech = null; status('Voz pronta.'); }
  function fallback(messageId, run, sample) {
    if (run !== generation) return;
    if (!serverAvailable || (!messageId && !sample)) { notice('Não encontrei uma voz disponível. No modo local, o Windows também pode gerar o áudio para o tablet.'); return; }
    currentAudio = new root.Audio('/api/voice?' + (sample ? 'sample=1' : 'id=' + encodeURIComponent(messageId)));
    currentAudio.onplay = function () { if (run === generation) status('Aguirra está falando com a voz do computador.'); };
    currentAudio.onended = function () { if (run === generation) status('Voz pronta.'); };
    currentAudio.onerror = function () { if (run === generation) notice('Não consegui reproduzir a voz do computador. Confira as vozes instaladas no Windows ou tente outra voz do navegador.'); };
    try { var promise = currentAudio.play(); if (promise && promise.catch) promise.catch(function () { if (run === generation) notice('Toque em “Ouvir resposta” para liberar o áudio neste navegador.'); }); } catch (e) { notice('Toque em “Ouvir resposta” para iniciar o áudio.'); }
  }
  function speak(text, messageId, sample) {
    stop(); var run = generation, available = voices(), chosen = null, i;
    if (selected === '__computer__') { fallback(messageId, run, sample); return; }
    text = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[#*_`]/g, '').slice(0, 6000).trim();
    if (!text) return;
    for (i = 0; i < available.length; i++) if (available[i].name === selected) chosen = available[i];
    if (!chosen) for (i = 0; i < available.length; i++) if (/^pt[-_]BR/i.test(available[i].lang) && available[i].localService) { chosen = available[i]; break; }
    if (!chosen) for (i = 0; i < available.length; i++) if (/^pt/i.test(available[i].lang)) { chosen = available[i]; break; }
    if (!root.speechSynthesis || !root.SpeechSynthesisUtterance || !available.length) { fallback(messageId, run, sample); return; }
    currentSpeech = new root.SpeechSynthesisUtterance(text); currentSpeech.lang = 'pt-BR'; currentSpeech.rate = 0.96; currentSpeech.pitch = 0.92; currentSpeech.volume = 1;
    if (chosen) currentSpeech.voice = chosen;
    currentSpeech.onstart = function () { if (run === generation) status('Aguirra está falando.'); };
    currentSpeech.onend = function () { if (run === generation) { currentSpeech = null; status('Voz pronta.'); } };
    currentSpeech.onerror = function (event) { if (run === generation && event.error !== 'canceled' && event.error !== 'interrupted') fallback(messageId, run, sample); };
    try { root.speechSynthesis.speak(currentSpeech); } catch (e) { fallback(messageId, run, sample); }
  }
  root.AguirraVoice = {
    speak: speak, stop: stop, voices: voices,
    configure: function (options) { selected = options.voice || ''; serverAvailable = !!options.server; status = options.onStatus || status; notice = options.onNotice || notice; },
    setVoice: function (name) { selected = name || ''; },
    setServer: function (enabled) { serverAvailable = !!enabled; }
  };
}(this));
