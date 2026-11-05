(function (root) {
  'use strict';
  var selected = '', elevenAvailable = false, audioContext = null, audioAnalyser = null, audioNode = null, cache = [], serverAvailable = false, generation = 0, currentSpeech = null, currentAudio = null, currentRequest = null, audioUrl = null;
  var status = function () {}, notice = function () {}, onState = function () {}, onCaption = function () {}, onPulse = function () {};
  function voices() { try { return root.speechSynthesis && root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; } }
  function cleanText(text) { return String(text || '').replace(/^(?:Resposta da IA, sem pesquisa verificada na web\.|Consulta a fontes públicas\.)\s*/i, '').replace(/https?:\/\/\S+/g, '').replace(/\[\d+\]/g, '').replace(/[#*_`]/g, '').slice(0, 6000).trim(); }
  function chunks(text) { var parts = text.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/gm) || [text], result = [], i; for (i = 0; i < parts.length; i++) { var part = parts[i].trim(); while (part.length > 220) { var end = part.lastIndexOf(' ', 220); if (end < 60) end = 220; result.push(part.slice(0, end)); part = part.slice(end).trim(); } if (part) result.push(part); } return result; }
  function chooseVoice(available) { var chosen = null, best = -1, i; for (i = 0; i < available.length; i++) { var voice = available[i]; if (selected && voice.name === selected) return voice; if (!/^pt/i.test(voice.lang)) continue; var score = /^pt[-_]BR/i.test(voice.lang) ? 100 : 10; if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 40; if (/google/i.test(voice.name)) score += 20; if (voice.localService) score += 5; if (score > best) { best = score; chosen = voice; } } return chosen; }
  function ready() { onState('idle'); status('Voz pronta.'); }
  function unavailable(text, blocked) { onState(blocked ? 'blocked' : 'unavailable'); notice(text); }
  function stop() { generation++; if (audioNode) { audioNode.disconnect(); audioNode = null; } if (audioAnalyser) audioAnalyser.disconnect(); audioAnalyser = null; if (currentRequest) { currentRequest.abort(); currentRequest = null; } if (audioUrl) { (root.URL || root.webkitURL).revokeObjectURL(audioUrl); audioUrl = null; } if (root.speechSynthesis) root.speechSynthesis.cancel(); if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; } currentSpeech = null; ready(); }
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
  function prime() { try { var AudioContext = root.AudioContext || root.webkitAudioContext; if (AudioContext && !audioContext) audioContext = new AudioContext(); if (audioContext && audioContext.resume) audioContext.resume(); } catch (e) { /* Audio playback still works without analysis. */ } }
  function speechParts(text) { var result = [], remaining = text; while (remaining.length > 1200) { var end = remaining.lastIndexOf('. ', 1200); if (end < 400) end = remaining.lastIndexOf(' ', 1200); if (end < 1) end = 1200; else end++; result.push(remaining.slice(0, end).trim()); remaining = remaining.slice(end).trim(); } if (remaining) result.push(remaining); return result; }
  function cues(alignment, text) { if (!alignment || !alignment.characters || !alignment.character_start_times_seconds) return [{ start: 0, text: text }]; var result = [], part = '', start = 0; for (var i = 0; i < alignment.characters.length; i++) { if (!part) start = alignment.character_start_times_seconds[i] || 0; part += alignment.characters[i]; if (/[.!?\n]/.test(alignment.characters[i]) || (part.length > 100 && /\s/.test(alignment.characters[i]))) { if (part.trim()) result.push({ start: start, text: part.trim() }); part = ''; } } if (part.trim()) result.push({ start: start, text: part.trim() }); return result.length ? result : [{ start: 0, text: text }]; }
  function playEleven(data, text, run, ended) {
    if (run !== generation) return;
    try {
      var binary = root.atob(data.audio_base64), bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (audioUrl) (root.URL || root.webkitURL).revokeObjectURL(audioUrl);
      audioUrl = (root.URL || root.webkitURL).createObjectURL(new root.Blob([bytes], {type:'audio/mpeg'})); currentAudio = new root.Audio(audioUrl); var captions = cues(data.alignment, text), lastCaption = -1;
      if (audioNode) { audioNode.disconnect(); audioNode = null; } audioAnalyser = null;
      try { if (audioContext && audioContext.createMediaElementSource) { audioAnalyser = audioContext.createAnalyser(); audioAnalyser.fftSize = 256; audioAnalyser.smoothingTimeConstant = .88; audioNode = audioContext.createMediaElementSource(currentAudio); audioNode.connect(audioAnalyser); audioAnalyser.connect(audioContext.destination); } } catch (analysisError) { audioAnalyser = null; if (audioNode) { audioNode.disconnect(); audioNode = null; } }
      currentAudio.onplay = function () { if (run === generation) { onState('speaking'); onCaption(captions[0].text); status('Aguirra está falando com ElevenLabs.'); } };
      currentAudio.ontimeupdate = function () { if (run !== generation) return; var index = 0; for (var j = 1; j < captions.length && captions[j].start <= currentAudio.currentTime; j++) index = j; if (index !== lastCaption) { lastCaption = index; onCaption(captions[index].text); } };
      currentAudio.onended = function () { if (run === generation) ended(); };
      currentAudio.onerror = function () { if (run === generation) unavailable('Não consegui reproduzir o áudio ElevenLabs neste navegador.'); };
      var promise = currentAudio.play(); if (promise && promise.catch) promise.catch(function () { if (run === generation) unavailable('Toque em Ouvir novamente para liberar o áudio ElevenLabs.', true); });
    } catch (e) { if (run === generation) unavailable('Este navegador não conseguiu reproduzir o áudio ElevenLabs. Selecione a voz do aparelho em Configurações.'); }
  }
  function speakEleven(text, run) {
    var parts = speechParts(text), index = 0;
    function next() { if (run !== generation) return; if (index >= parts.length) { ready(); return; } var part = parts[index++];
      for (var i = 0; i < cache.length; i++) if (cache[i].text === part) { playEleven(cache[i].data, part, run, next); return; }
      onState('loading'); status('Preparando voz ElevenLabs…');
      var xhr = new root.XMLHttpRequest(); currentRequest = xhr; xhr.open('POST', '/api/speech', true); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.timeout = 65000;
      xhr.onload = function () { if (run !== generation) return; currentRequest = null; var data; try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; } if (xhr.status !== 200 || !data.audio_base64) { unavailable(data.error || 'A voz ElevenLabs não está disponível agora. O texto continua aqui.'); return; } cache.push({text:part, data:data}); if (cache.length > 2) cache.shift(); playEleven(data, part, run, next); };
      xhr.onerror = xhr.ontimeout = function () { if (run === generation) unavailable('Não consegui carregar a voz ElevenLabs. Tente novamente.'); }; xhr.send(JSON.stringify({text:part}));
    }
    next();
  }
  function speak(text, messageId, sample) {
    prime(); stop(); var run = generation; text = cleanText(text); if (!text) return;
    if (selected === '__elevenlabs__' && elevenAvailable) { speakEleven(text, run); return; }
    if (selected === '__elevenlabs__' && !elevenAvailable) notice('ElevenLabs aguarda a chave no servidor. Usando a voz do aparelho como alternativa.');
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
  root.AguirraVoice = { speak: speak, stop: stop, voices: voices, cleanText: cleanText, prime: prime, clearCache: function () { cache = []; }, spectrum: function () { if (!audioAnalyser) return null; var data = new Uint8Array(audioAnalyser.frequencyBinCount); audioAnalyser.getByteFrequencyData(data); return data; }, setEleven: function (ready) { elevenAvailable = !!ready; },
    configure: function (options) { selected = options.voice || ''; serverAvailable = !!options.server; status = options.onStatus || status; notice = options.onNotice || notice; onState = options.onState || onState; onCaption = options.onCaption || onCaption; onPulse = options.onPulse || onPulse; },
    setVoice: function (name) { selected = name || ''; }, setServer: function (enabled) { serverAvailable = !!enabled; }
  };
}(this));
