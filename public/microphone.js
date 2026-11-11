(function (root) {
  'use strict';
  var recognition = null, stream = null, context = null, source = null, processor = null, analyser = null, samples = [], sampleCount = 0;
  var active = false, generation = 0, timer = null, recording = false, server = false, useRecorder = false;
  var onState = function () {}, onText = function () {}, onNotice = function () {}, onResult = function () {}, transcribe = function () {};
  function state(value) { onState(value); }
  function clearCapture() { if (timer) root.clearTimeout(timer); timer = null; if (processor) { processor.onaudioprocess = null; processor.disconnect(); processor = null; } if (source) { source.disconnect(); source = null; } if (stream) { var tracks = stream.getTracks ? stream.getTracks() : []; for (var i = 0; i < tracks.length; i++) tracks[i].stop(); stream = null; } if (context) { if (context.close) context.close(); context = null; } analyser = null; }
  function cancel() { generation++; active = false; recording = false; if (recognition) { recognition.abort(); recognition = null; } clearCapture(); samples = []; sampleCount = 0; state('idle'); }
  function problem(error) { var name = error && (error.error || error.name) || ''; var messages = { 'not-allowed': 'Permita o microfone nas configurações deste site e tente novamente.', NotAllowedError: 'Permita o microfone nas configurações deste site e tente novamente.', 'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz.', 'audio-capture': 'Não encontrei um microfone disponível. Confira o dispositivo de entrada.', NotFoundError: 'Não encontrei um microfone disponível.', NotReadableError: 'O microfone está ocupado por outro aplicativo.', 'no-speech': 'Não ouvi uma pergunta. Toque no microfone e fale novamente.', network: 'O reconhecimento do navegador não conectou. Confira a internet.', 'language-not-supported': 'O navegador não oferece reconhecimento em português.' }; return messages[name] || 'Não consegui iniciar o microfone. Confira a permissão e tente no Chrome.'; }
  function wav(chunks, rate) {
    var total = 0, i, j; for (i = 0; i < chunks.length; i++) total += chunks[i].length;
    var input = new Float32Array(total), offset = 0; for (i = 0; i < chunks.length; i++) { input.set(chunks[i], offset); offset += chunks[i].length; }
    var length = Math.min(320000, Math.floor(total * 16000 / rate)), buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
    function word(at, value) { for (var k = 0; k < value.length; k++) view.setUint8(at + k, value.charCodeAt(k)); }
    word(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, length * 2, true);
    for (i = 0; i < length; i++) { var start = Math.floor(i * rate / 16000), end = Math.max(start + 1, Math.floor((i + 1) * rate / 16000)), sum = 0; for (j = start; j < end && j < input.length; j++) sum += input[j]; var value = Math.max(-1, Math.min(1, sum / (end - start))); view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true); }
    var bytes = new Uint8Array(buffer), binary = ''; for (i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return root.btoa(binary);
  }
  function finishRecording(run) { if (!recording || run !== generation) return; var rate = context.sampleRate, recorded = samples; recording = false; active = false; clearCapture(); samples = []; sampleCount = 0; if (!recorded.length) { state('idle'); onNotice('Não capturei áudio. Tente novamente.'); return; } state('transcribing'); transcribe(wav(recorded, rate), function (err, result) { if (run !== generation) return; state('idle'); if (err) onNotice(err.message); else if (result && result.text) onResult(result.text); }); }
  function record(run) {
    var AudioContext = root.AudioContext || root.webkitAudioContext, nav = root.navigator || {}, legacy = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;
    if (!server || !AudioContext || !(nav.mediaDevices && nav.mediaDevices.getUserMedia) && !legacy) { active = false; state('idle'); onNotice(server ? 'Este navegador não oferece captura de áudio. Use o Chrome ou o ditado do teclado.' : 'Reconhecimento indisponível neste navegador. A gravação alternativa será liberada com a chave ElevenLabs; por enquanto use o ditado do teclado.'); return; }
    function failure(error) { if (run !== generation) return; active = false; clearCapture(); state('idle'); onNotice(problem(error)); }
    function opened(media) { if (run !== generation) { var tracks = media.getTracks(); for (var i = 0; i < tracks.length; i++) tracks[i].stop(); return; } stream = media;
      try { context = new AudioContext(); source = context.createMediaStreamSource(media); analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .85; processor = context.createScriptProcessor(4096, 1, 1); samples = []; sampleCount = 0; recording = true; source.connect(analyser); source.connect(processor); processor.connect(context.destination); processor.onaudioprocess = function (event) { if (!recording) return; var input = event.inputBuffer.getChannelData(0); samples.push(new Float32Array(input)); sampleCount += input.length; if (sampleCount >= context.sampleRate * 20) finishRecording(run); }; if (context.resume) context.resume(); state('listening'); timer = root.setTimeout(function () { finishRecording(run); }, 20000); } catch (error) { failure(error); }
    }
    try { if (nav.mediaDevices && nav.mediaDevices.getUserMedia) nav.mediaDevices.getUserMedia({audio: {echoCancellation:true, noiseSuppression:true}, video:false}).then(opened, failure); else legacy.call(nav, {audio:true, video:false}, opened, failure); } catch (error) { failure(error); }
  }
  function toggle() {
    if (active) { if (recording) finishRecording(generation); else if (recognition) recognition.stop(); else cancel(); return; }
    if (root.isSecureContext === false && root.location && !/^(localhost|127\.0\.0\.1)$/.test(root.location.hostname)) { onNotice('Abra o Aguirra pelo endereço HTTPS para liberar o microfone.'); return; }
    cancel(); var run = generation, Recognition = root.SpeechRecognition || root.webkitSpeechRecognition; active = true; state('requesting');
    if (!Recognition || useRecorder) { record(run); return; }
    var finalText = '', failed = false;
    try { recognition = new Recognition(); recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
      recognition.onstart = function () { if (run === generation) { state('listening'); timer = root.setTimeout(function () { if (recognition) recognition.stop(); }, 25000); } };
      recognition.onresult = function (event) { if (run !== generation) return; var interim = ''; finalText = ''; for (var i = 0; i < event.results.length; i++) { var text = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += text + ' '; else interim += text; } onText((finalText + interim).trim()); };
      recognition.onerror = function (event) { if (run !== generation || event.error === 'aborted') return; failed = true; active = false; recognition = null; if (timer) root.clearTimeout(timer); state('idle'); if (server && /network|service-not-allowed/.test(event.error)) { useRecorder = true; onNotice('O reconhecimento do navegador falhou. Toque novamente para gravar e transcrever com ElevenLabs.'); } else onNotice(problem(event)); };
      recognition.onend = function () { if (run !== generation || failed) return; active = false; recognition = null; if (timer) root.clearTimeout(timer); state('idle'); if (!failed && finalText.trim()) onResult(finalText.trim()); else if (!failed) onNotice('Não identifiquei uma pergunta. Toque no microfone e fale novamente.'); };
      recognition.start();
    } catch (error) { active = false; recognition = null; state('idle'); onNotice(problem(error)); }
  }
  root.AguirraMicrophone = { toggle: toggle, cancel: cancel, setServer: function (ready) { server = !!ready; }, spectrum: function () { if (!analyser) return null; var data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); return data; }, encodeWave: wav,
    configure: function (options) { onState = options.onState || onState; onText = options.onText || onText; onNotice = options.onNotice || onNotice; onResult = options.onResult || onResult; transcribe = options.transcribe || transcribe; }
  };
}(this));

(function (root) {
  'use strict';
  var enabled = false, paused = false, rec = null, retry = null, deadline = null, run = 0, armed = false, failures = 0;
  var report = function () {}, deliver = function () {};
  function status(text) { report(text, enabled, armed); }
  function clearDeadline() { if (deadline) root.clearTimeout(deadline); deadline = null; }
  function disarm() { armed = false; clearDeadline(); }
  function stop() {
    run++;
    if (retry) root.clearTimeout(retry);
    retry = null; disarm();
    var old = rec; rec = null;
    if (old) { try { old.abort(); } catch (e) {} }
  }
  function disable(text) { enabled = false; stop(); status(text || 'Ativar por voz'); }
  function listen() {
    if (!enabled || paused || rec) return;
    var Recognition = root.SpeechRecognition || root.webkitSpeechRecognition, token = ++run;
    if (!Recognition || root.isSecureContext === false) { disable('Ativação por voz indisponível neste navegador. Use o microfone.'); return; }
    try {
      var instance = rec = new Recognition(), submitted = false;
      instance.lang = 'pt-BR'; instance.continuous = true; instance.interimResults = false;
      instance.onstart = function () { if (token === run) status(armed ? 'Estou ouvindo seu pedido…' : 'Diga “Aguirra”'); };
      instance.onresult = function (event) {
        if (token !== run || submitted) return;
        failures = 0;
        for (var i = event.resultIndex || 0; i < event.results.length; i++) {
          if (!event.results[i].isFinal) continue;
          var text = event.results[i][0].transcript.trim();
          var wake = /\b(?:aguirra|aguira|agirra)\b[\s,:.!?—-]*/i.exec(text);
          if (wake) {
            armed = true; clearDeadline();
            text = text.slice(wake.index + wake[0].length).trim();
            deadline = root.setTimeout(function () { disarm(); status('Diga “Aguirra”'); }, 12000);
          } else if (!armed) continue;
          if (!text) { status('Estou ouvindo seu pedido…'); continue; }
          submitted = true; paused = true; stop(); status('Preparando resposta…'); deliver(text); return;
        }
      };
      instance.onerror = function (event) {
        if (token !== run || event.error === 'aborted' || event.error === 'no-speech') return;
        if (/not-allowed|audio-capture|language-not-supported/.test(event.error)) {
          disable('Escuta desativada. Confira a permissão do microfone e a compatibilidade do navegador.'); return;
        }
        failures++;
        if (failures >= 3) disable('Reconhecimento sem conexão. Toque em ativar por voz para tentar novamente.');
      };
      instance.onend = function () {
        if (token !== run) return;
        rec = null;
        if (enabled && !paused) retry = root.setTimeout(listen, Math.min(5000, 450 + failures * 1200));
      };
      instance.start();
    } catch (e) { disable('Não consegui iniciar a escuta. Confira a permissão do microfone.'); }
  }
  root.AguirraWake = {
    configure: function (options) { report = options.onStatus; deliver = options.onCommand; },
    toggle: function () { if (enabled) disable(); else { enabled = true; paused = false; failures = 0; status('Permitindo escuta…'); listen(); } },
    pause: function (value) {
      if (paused === !!value) return;
      paused = !!value;
      if (paused) { stop(); if (enabled) status('Escuta em pausa'); }
      else if (enabled) listen();
    },
    armed: function () { return armed; }
  };
}(this));
