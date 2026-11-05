(function (root) {
  'use strict';
  var selected = '', serverAvailable = false, generation = 0, currentSpeech = null, currentAudio = null, currentRequest = null, audioUrl = null, status = function () {}, notice = function () {};
  function voices() { try { return root.speechSynthesis && root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; } }
  function stop() { generation++; if (currentRequest) { currentRequest.abort(); currentRequest = null; } if (audioUrl) { (root.URL || root.webkitURL).revokeObjectURL(audioUrl); audioUrl = null; } if (root.speechSynthesis) root.speechSynthesis.cancel(); if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; } currentSpeech = null; status('Voz pronta.'); }
  function playComputer(source, run) {
    if (run !== generation) return;
    currentAudio = new root.Audio(source);
    currentAudio.onplay = function () { if (run === generation) status('Aguirra está falando com a voz do computador.'); };
    currentAudio.onended = function () { if (run === generation) status('Voz pronta.'); };
    currentAudio.onerror = function () { if (run === generation) notice('Não consegui reproduzir a voz do computador. Confira as vozes instaladas no Windows ou tente outra voz do navegador.'); };
    try { var promise = currentAudio.play(); if (promise && promise.catch) promise.catch(function () { if (run === generation) notice('Toque em “Ouvir resposta” para liberar o áudio neste navegador.'); }); } catch (e) { notice('Toque em “Ouvir resposta” para iniciar o áudio.'); }
  }
  function fallback(messageId, run, sample, text) {
    if (run !== generation) return;
    if (!serverAvailable) { notice('Não encontrei uma voz disponível. No modo local, o Windows também pode gerar o áudio para o tablet.'); return; }
    if (messageId) { playComputer('/api/voice?id=' + encodeURIComponent(messageId), run); return; }
    if (!root.XMLHttpRequest || !(root.URL || root.webkitURL)) { notice('Este navegador não oferece reprodução de voz local sem conta. Tente outro navegador.'); return; }
    var xhr = new root.XMLHttpRequest(); currentRequest = xhr;
    xhr.open('POST', '/api/voice', true); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.responseType = 'blob'; xhr.timeout = 65000;
    xhr.onload = function () { if (run !== generation) return; currentRequest = null; if (xhr.status !== 200) { notice('Não consegui gerar a voz no computador. Confira as vozes em português instaladas no Windows.'); return; } audioUrl = (root.URL || root.webkitURL).createObjectURL(xhr.response); playComputer(audioUrl, run); };
    xhr.onerror = xhr.ontimeout = function () { if (run === generation) notice('Não consegui conectar à voz do computador.'); };
    xhr.send(JSON.stringify({ text: String(text || 'Olá. Eu sou o Aguirra, seu assistente pessoal.').slice(0, 6000) }));
  }
  function speak(text, messageId, sample) {
    stop(); var run = generation, available = voices(), chosen = null, i;
    if (selected === '__computer__') { fallback(messageId, run, sample, text); return; }
    text = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[#*_`]/g, '').slice(0, 6000).trim();
    if (!text) return;
    for (i = 0; i < available.length; i++) if (available[i].name === selected) chosen = available[i];
    if (!chosen) for (i = 0; i < available.length; i++) if (/^pt[-_]BR/i.test(available[i].lang) && available[i].localService) { chosen = available[i]; break; }
    if (!chosen) for (i = 0; i < available.length; i++) if (/^pt/i.test(available[i].lang)) { chosen = available[i]; break; }
    if (!root.speechSynthesis || !root.SpeechSynthesisUtterance || !available.length) { fallback(messageId, run, sample, text); return; }
    currentSpeech = new root.SpeechSynthesisUtterance(text); currentSpeech.lang = 'pt-BR'; currentSpeech.rate = 0.96; currentSpeech.pitch = 0.92; currentSpeech.volume = 1;
    if (chosen) currentSpeech.voice = chosen;
    currentSpeech.onstart = function () { if (run === generation) status('Aguirra está falando.'); };
    currentSpeech.onend = function () { if (run === generation) { currentSpeech = null; status('Voz pronta.'); } };
    currentSpeech.onerror = function (event) { if (run === generation && event.error !== 'canceled' && event.error !== 'interrupted') fallback(messageId, run, sample, text); };
    try { root.speechSynthesis.speak(currentSpeech); } catch (e) { fallback(messageId, run, sample, text); }
  }
  root.AguirraVoice = {
    speak: speak, stop: stop, voices: voices,
    configure: function (options) { selected = options.voice || ''; serverAvailable = !!options.server; status = options.onStatus || status; notice = options.onNotice || notice; },
    setVoice: function (name) { selected = name || ''; },
    setServer: function (enabled) { serverAvailable = !!enabled; }
  };
}(this));
