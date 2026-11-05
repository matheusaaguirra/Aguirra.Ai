(function (root) {
  'use strict';
  var selected = '', serverAvailable = false, generation = 0, currentSpeech = null, currentAudio = null, currentRequest = null, audioUrl = null;
  var status = function () {}, notice = function () {}, onState = function () {}, onCaption = function () {}, onPulse = function () {};
  function voices() { try { return root.speechSynthesis && root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; } }
  function cleanText(text) { return String(text || '').replace(/^(?:Resposta da IA, sem pesquisa verificada na web\.|Consulta a fontes públicas\.)\s*/i, '').replace(/https?:\/\/\S+/g, '').replace(/\[\d+\]/g, '').replace(/[#*_`]/g, '').slice(0, 6000).trim(); }
  function chunks(text) { var parts = text.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/gm) || [text], result = [], i; for (i = 0; i < parts.length; i++) { var part = parts[i].trim(); while (part.length > 220) { var end = part.lastIndexOf(' ', 220); if (end < 60) end = 220; result.push(part.slice(0, end)); part = part.slice(end).trim(); } if (part) result.push(part); } return result; }
  function chooseVoice(available) { var chosen = null, best = -1, i; for (i = 0; i < available.length; i++) { var voice = available[i]; if (selected && voice.name === selected) return voice; if (!/^pt/i.test(voice.lang)) continue; var score = /^pt[-_]BR/i.test(voice.lang) ? 100 : 10; if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 40; if (/google/i.test(voice.name)) score += 20; if (voice.localService) score += 5; if (score > best) { best = score; chosen = voice; } } return chosen; }
  function ready() { onState('idle'); status('Voz pronta.'); }
  function unavailable(text, blocked) { onState(blocked ? 'blocked' : 'unavailable'); notice(text); }
  function stop() { generation++; if (currentRequest) { currentRequest.abort(); currentRequest = null; } if (audioUrl) { (root.URL || root.webkitURL).revokeObjectURL(audioUrl); audioUrl = null; } if (root.speechSynthesis) root.speechSynthesis.cancel(); if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; } currentSpeech = null; ready(); }
  function playComputer(source, run, text) {
    if (run !== generation) return;
    currentAudio = new root.Audio(source);
    currentAudio.onplay = function () { if (run === generation) { onState('speaking'); onCaption(text); status('Aguirra está falando.'); } };
    currentAudio.onended = function () { if (run === generation) ready(); };
    currentAudio.onerror = function () { if (run === generation) unavailable('Não consegui reproduzir a voz do computador. Confira as vozes instaladas no Windows.'); };
    try { var promise = currentAudio.play(); if (promise && promise.catch) promise.catch(function () { if (run === generation) unavailable('Toque em Ouvir novamente para liberar o áudio.', true); }); } catch (e) { unavailable('Toque em Ouvir novamente para iniciar o áudio.', true); }
  }
  function fallback(messageId, run, sample, text) {
    if (run !== generation) return;
    if (!serverAvailable) { unavailable('Instale ou ative uma voz em português no aparelho para ouvir as respostas.'); return; }
    if (messageId) { playComputer('/api/voice?id=' + encodeURIComponent(messageId), run, text); return; }
    if (!root.XMLHttpRequest || !(root.URL || root.webkitURL)) { unavailable('Este navegador não oferece reprodução da voz do computador.'); return; }
    var xhr = new root.XMLHttpRequest(); currentRequest = xhr;
    xhr.open('POST', '/api/voice', true); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.responseType = 'blob'; xhr.timeout = 65000;
    xhr.onload = function () { if (run !== generation) return; currentRequest = null; if (xhr.status !== 200) { unavailable('Não consegui gerar a voz no computador. Confira as vozes em português instaladas no Windows.'); return; } audioUrl = (root.URL || root.webkitURL).createObjectURL(xhr.response); playComputer(audioUrl, run, text); };
    xhr.onerror = xhr.ontimeout = function () { if (run === generation) unavailable('Não consegui conectar à voz do computador.'); };
    xhr.send(JSON.stringify({ text: text || 'Olá. Eu sou o Aguirra, seu assistente pessoal.' }));
  }
  function speak(text, messageId, sample) {
    stop(); var run = generation; text = cleanText(text); if (!text) return;
    function begin(retried) {
      if (run !== generation) return;
      var available = voices(), chosen = chooseVoice(available);
      if (selected === '__computer__') { fallback(messageId, run, sample, text); return; }
      if (!available.length && root.speechSynthesis && root.setTimeout && !retried) { root.setTimeout(function () { begin(true); }, 900); return; }
      if (!root.speechSynthesis || !root.SpeechSynthesisUtterance || !chosen) { fallback(messageId, run, sample, text); return; }
      var queue = chunks(text), index = 0;
      function next() {
        if (run !== generation) return;
        if (index >= queue.length) { currentSpeech = null; ready(); return; }
        var caption = queue[index++], utterance = new root.SpeechSynthesisUtterance(caption); currentSpeech = utterance;
        utterance.lang = chosen.lang || 'pt-BR'; utterance.voice = chosen; utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1;
        utterance.onstart = function () { if (run === generation) { onState('speaking'); onCaption(caption); status('Aguirra está falando.'); } };
        utterance.onboundary = function () { if (run === generation) onPulse(); };
        utterance.onend = next;
        utterance.onerror = function (event) { if (run !== generation || event.error === 'canceled' || event.error === 'interrupted') return; if (event.error === 'not-allowed') unavailable('Toque em Ouvir novamente para liberar o áudio.', true); else fallback(messageId, run, sample, text); };
        try { root.speechSynthesis.speak(utterance); } catch (e) { fallback(messageId, run, sample, text); }
      }
      next();
    }
    begin(false);
  }
  root.AguirraVoice = { speak: speak, stop: stop, voices: voices, cleanText: cleanText,
    configure: function (options) { selected = options.voice || ''; serverAvailable = !!options.server; status = options.onStatus || status; notice = options.onNotice || notice; onState = options.onState || onState; onCaption = options.onCaption || onCaption; onPulse = options.onPulse || onPulse; },
    setVoice: function (name) { selected = name || ''; }, setServer: function (enabled) { serverAvailable = !!enabled; }
  };
}(this));
