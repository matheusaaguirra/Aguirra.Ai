(function () {
  'use strict';
  var M = window.AguirraMemory, storageKey = 'aguirra.local.v1', preferencesKey = 'aguirra.preferences.v1';
  var user = null, busy = false, activeView = 'home', currentThread = null, memoryFilter = 'all', editingMemory = null, authMode = 'login', toastTimer, modalFocus = null;
  var oldAndroid = /Android 4\./.test(navigator.userAgent), state = empty(), preferences = readJSON(preferencesKey, { low_power: oldAndroid, voice: false });
  function $(id) { return document.getElementById(id); }
  function empty() { return { memories: [], threads: [], messages: [], topics: [], settings: { memory_enabled: true } }; }
  function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : ((r & 3) | 8)).toString(16); }); }
  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function saveLocal() { if (user) return; try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { toast('O navegador não conseguiu salvar. Exporte seus dados para não perder o contexto.'); } }
  function savePreferences() { try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch (e) { /* Session-only settings remain usable. */ } }
  function el(tag, cls, content) { var n = document.createElement(tag); if (cls) n.className = cls; if (content !== undefined) n.appendChild(document.createTextNode(String(content))); return n; }
  function wipe(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').hidden = true; }, 5000); }
  function request(method, path, body, callback) {
    var xhr = new XMLHttpRequest(), finished = false;
    function finish(err, data) { if (finished) return; finished = true; callback(err, data); }
    xhr.open(method, path, true); xhr.timeout = path === '/api/chat' ? 180000 : 20000;
    xhr.setRequestHeader('Accept', 'application/json');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () { if (xhr.readyState !== 4) return; var data; try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; } if (xhr.status >= 200 && xhr.status < 300) finish(null, data); else finish({ status: xhr.status, message: data.error || 'Não consegui conectar ao servidor agora.' }, data); };
    xhr.onerror = function () { finish({ message: 'Sem conexão com o servidor. Suas memórias neste aparelho continuam disponíveis.' }); };
    xhr.ontimeout = function () { finish({ message: 'A resposta demorou mais que o esperado. Confira o histórico antes de reenviar.' }); };
    xhr.send(body ? JSON.stringify(body) : null);
  }
  function go(view) {
    var views = document.querySelectorAll('.view'), buttons = document.querySelectorAll('[data-view]'), names = { home: 'Central', chat: 'Conversas', brain: 'Mapa cerebral', history: 'Histórico', settings: 'Configurações' }, i;
    activeView = view;
    for (i = 0; i < views.length; i++) views[i].className = 'view' + (views[i].id === 'view-' + view ? ' active' : '');
    for (i = 0; i < buttons.length; i++) buttons[i].className = 'nav-item' + (buttons[i].getAttribute('data-view') === view ? ' selected' : '');
    $('page-name').textContent = names[view]; if (view === 'brain') renderBrain(); if (view === 'history') renderHistory(); if (view === 'settings') renderSettings(); if (view === 'chat') renderMessages();
    if (view !== 'home' || preferences.low_power) drawOrb(0); else startOrb();
    window.scrollTo(0, 0);
  }
  function localDate(date, timeOnly) { var d = new Date(date || new Date()); if (timeOnly) return pad(d.getHours()) + ':' + pad(d.getMinutes()); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() { var d = new Date(), months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']; $('clock-label').textContent = localDate(d, true); $('date-label').textContent = d.getDate() + ' de ' + months[d.getMonth()] + ', ' + d.getFullYear(); }
  function render() {
    var count = state.memories.length;
    $('home-memory-count').textContent = pad(count); $('nav-memory-count').textContent = String(count);
    $('context-description').textContent = count ? 'Preferências, objetivos e ideias que dão contexto às suas próximas conversas.' : 'Seu núcleo começa com uma conversa. Conte uma preferência ou algo que queira guardar.';
    $('last-connection').textContent = count ? state.memories[0].content : 'As ideias que você guardar aparecerão aqui.';
    $('account-name').textContent = user ? (user.email || 'Sua conta') : 'Seu espaço pessoal'; $('avatar').textContent = user ? user.email.charAt(0).toUpperCase() : 'V'; $('account-state').textContent = user ? 'Memória sincronizada' : 'Memória neste aparelho';
    $('chat-storage-label').textContent = user ? 'Sincronizado na sua conta' : 'Neste aparelho';
    renderSettings(); if (activeView === 'brain') renderBrain(); if (activeView === 'chat') renderMessages(); if (activeView === 'history') renderHistory();
  }
  function renderMessages() {
    var box = $('messages'); wipe(box);
    var messages = state.messages.filter(function (m) { return m.thread_id === currentThread; });
    if (!messages.length) { var intro = el('div', 'empty-state'); intro.appendChild(el('strong', '', 'Uma conversa muda tudo.')); intro.appendChild(el('span', '', 'Pergunte algo ou conte uma preferência. Seu núcleo começa por aqui.')); box.appendChild(intro); }
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i], row = el('article', 'message ' + m.role + (m.failed ? ' message-error' : ''));
      row.appendChild(el('span', 'message-avatar', m.role === 'user' ? 'V' : 'a')); row.appendChild(el('div', 'message-name', m.role === 'user' ? 'VOCÊ' : 'AGUIRRA'));
      row.appendChild(el('div', 'message-text', m.content));
      if (m.sources && m.sources.length) { var sources = el('div', 'sources'); for (var j = 0; j < m.sources.length; j++) { var source = m.sources[j]; if (!/^https:\/\//i.test(source.url)) continue; var link = el('a', 'source-link', '[' + (j + 1) + '] ' + source.title); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; sources.appendChild(link); } row.appendChild(sources); }
      row.appendChild(el('div', 'message-time', localDate(m.created_at, true))); box.appendChild(row);
    }
    box.scrollTop = box.scrollHeight;
  }
  function addMessage(role, text, failed) { var m = { id: uid(), thread_id: currentThread, role: role, content: text, created_at: new Date().toISOString(), sources: [], failed: !!failed }; state.messages.push(m); return m; }
  function ensureThread(text) { if (currentThread) return; currentThread = uid(); state.threads.unshift({ id: currentThread, title: text.slice(0, 80), created_at: new Date().toISOString() }); }
  function learn(text, messageId) {
    if (state.settings.memory_enabled !== false) { var extracted = M.extract(text); for (var i = 0; i < extracted.length; i++) putLocalMemory(extracted[i], messageId); }
    var topics = M.topics(text); for (var j = 0; j < topics.length; j++) { var found = null; for (var k = 0; k < state.topics.length; k++) if (state.topics[k].name === topics[j]) found = state.topics[k]; if (found) found.count++; else state.topics.push({ name: topics[j], count: 1 }); }
  }
  function putLocalMemory(m, messageId) {
    var index = -1; for (var i = 0; i < state.memories.length; i++) if (state.memories[i].key === m.key) index = i;
    m.id = index >= 0 ? state.memories[index].id : uid(); m.updated_at = new Date().toISOString(); m.source_message_id = messageId || null;
    if (index >= 0) state.memories.splice(index, 1); state.memories.unshift(m);
  }
  function localAnswer(text, learned) {
    var s = M.normalize(text);
    if (/que (dia|horas)|data de hoje|hora atual/.test(s)) return 'Agora são ' + localDate(new Date(), true) + ' de ' + localDate() + ', pelo relógio e fuso deste aparelho.';
    if (/lembra|memori|sabe sobre mim/.test(s)) return state.memories.length ? 'Este é o seu núcleo neste aparelho:\n\n' + state.memories.map(function (m) { return '• ' + m.content; }).join('\n') + '\n\nVocê pode editar ou esquecer qualquer item no Mapa cerebral.' : 'Seu núcleo ainda está vazio. Conte, por exemplo: “Prefiro respostas curtas com exemplos”. Você também pode guardar uma memória diretamente no mapa.';
    if (learned.length) return 'Guardei no seu núcleo: ' + learned[0].content + '. Você pode revisar essa memória no Mapa cerebral. Entre na sua conta para usar esse contexto nas respostas da IA e sincronizar entre aparelhos.';
    return 'Seu pedido ficou no histórico deste aparelho. Para conversar com a IA e pesquisar informações atuais, entre na sua conta. Enquanto isso, você pode explorar o mapa, guardar preferências e consultar data e hora.';
  }
  function send(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    if (text.length > 4000) { toast('Sua mensagem deve ter até 4.000 caracteres.'); return; }
    text = M.redact(text); go('chat'); $('home-input').value = ''; $('chat-input').value = '';
    if (!user) { ensureThread(text); var message = addMessage('user', text); learn(text, message.id); var answer = localAnswer(text, M.extract(text)); addMessage('assistant', answer); saveLocal(); render(); speak(answer); return; }
    var hadThread = currentThread; ensureThread(text); var pending = addMessage('user', text); renderMessages(); setBusy(true);
    request('POST', '/api/chat', { message: text, thread_id: hadThread, request_id: pending.id }, function (err, result) {
      setBusy(false);
      if (err) { addMessage('assistant', err.message, true); toast(err.message); renderMessages(); if (err.status === 401) openAuth(); return; }
      currentThread = result.thread_id; loadData(function () { renderMessages(); if (result.learned) toast('Nova conexão guardada no seu núcleo.'); speak(result.reply); });
    });
  }
  function setBusy(value) { busy = value; $('chat-submit').disabled = value; $('chat-input').disabled = value; $('chat-activity').textContent = value ? 'Aguirra está conectando as ideias…' : ''; $('orb-state').textContent = value ? 'CONECTANDO IDEIAS' : 'PRONTO PARA OUVIR SUAS IDEIAS'; }
  function loadData(callback) { request('GET', '/api/data', null, function (err, data) { if (err) { toast(err.message); if (callback) callback(err); return; } state = data; render(); if (callback) callback(); }); }
  function renderHistory() {
    var list = $('history-list'), query = M.normalize($('history-search').value); wipe(list);
    var threads = state.threads.filter(function (t) { return M.normalize(t.title).indexOf(query) !== -1 || state.messages.some(function (m) { return m.thread_id === t.id && M.normalize(m.content).indexOf(query) !== -1; }); });
    if (!threads.length) { list.appendChild(el('div', 'empty-state', query ? 'Nenhuma conversa encontrada para essa busca.' : 'Suas conversas aparecerão aqui. Comece pela Central.')); return; }
    for (var i = 0; i < threads.length; i++) (function (thread) { var button = el('button', 'history-card'); var total = state.messages.filter(function (m) { return m.thread_id === thread.id; }).length; button.appendChild(el('h3', '', thread.title)); button.appendChild(el('p', '', localDate(thread.created_at) + ' · ' + total + ' mensagens  ↗')); button.onclick = function () { currentThread = thread.id; go('chat'); }; list.appendChild(button); }(threads[i]));
  }
  function svgEl(tag, attrs, content) { var n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); if (content !== undefined) n.textContent = content; return n; }
  function renderBrain() {
    $('brain-summary').textContent = state.memories.length + ' memórias · ' + state.topics.length + ' assuntos';
    var svg = $('brain-svg'); wipe(svg);
    var cats = ['profile', 'preferences', 'goals', 'projects', 'notes'], coords = [[180, 87], [526, 84], [597, 239], [366, 307], [125, 240]], i;
    svg.appendChild(svgEl('circle', { cx: 360, cy: 174, r: 110, fill: 'none', stroke: '#293821', 'stroke-dasharray': '2 8' }));
    svg.appendChild(svgEl('circle', { cx: 360, cy: 174, r: 150, fill: 'none', stroke: '#202d19' }));
    for (i = 0; i < cats.length; i++) {
      var count = state.memories.filter(function (m) { return m.category === cats[i]; }).length;
      svg.appendChild(svgEl('line', { x1: 360, y1: 174, x2: coords[i][0], y2: coords[i][1], stroke: count ? '#8a8e57' : '#34422b', 'stroke-width': count ? 1.5 : 1 }));
      var group = svgEl('g', { tabindex: '0', role: 'button', 'aria-label': M.categories[cats[i]] + ', ' + count + ' memórias', cursor: 'pointer' });
      group.appendChild(svgEl('circle', { cx: coords[i][0], cy: coords[i][1], r: count ? 20 : 13, fill: count ? '#3b4228' : '#1e2b17', stroke: count ? '#c1b578' : '#52613e' }));
      group.appendChild(svgEl('text', { x: coords[i][0], y: coords[i][1] + 4, 'text-anchor': 'middle', fill: '#d0c38c', 'font-size': '11', 'font-family': 'monospace' }, String(count)));
      group.appendChild(svgEl('text', { x: coords[i][0], y: coords[i][1] + 38, 'text-anchor': 'middle', fill: '#9bad86', 'font-size': '12', 'font-family': 'Arial' }, M.categories[cats[i]]));
      (function (category, node) { node.onclick = function () { memoryFilter = category; renderBrain(); }; node.onkeydown = function (event) { if (event.keyCode === 13 || event.keyCode === 32) { event.preventDefault(); memoryFilter = category; renderBrain(); } }; }(cats[i], group)); svg.appendChild(group);
    }
    svg.appendChild(svgEl('circle', { cx: 360, cy: 174, r: 45, fill: '#303b23', stroke: '#b7ad70', 'stroke-width': '1.5' }));
    svg.appendChild(svgEl('text', { x: 360, y: 175, 'text-anchor': 'middle', fill: '#e0cf95', 'font-size': '15', 'font-family': 'Georgia' }, 'Aguirra'));
    svg.appendChild(svgEl('text', { x: 360, y: 194, 'text-anchor': 'middle', fill: '#9caa82', 'font-size': '8', 'font-family': 'monospace', 'letter-spacing': '2' }, 'NÚCLEO'));
    var filters = $('memory-filters'); wipe(filters); var allCats = ['all'].concat(cats);
    for (i = 0; i < allCats.length; i++) (function (cat) { var b = el('button', 'filter-button' + (memoryFilter === cat ? ' selected' : ''), cat === 'all' ? 'Todas as conexões' : M.categories[cat]); b.onclick = function () { memoryFilter = cat; renderBrain(); }; filters.appendChild(b); }(allCats[i]));
    var list = $('memory-list'); wipe(list); var items = state.memories.filter(function (m) { return memoryFilter === 'all' || m.category === memoryFilter; });
    if (!items.length) { var emptyState = el('div', 'empty-state'); emptyState.appendChild(el('strong', '', 'Todo contexto começa pequeno.')); emptyState.appendChild(el('span', '', 'Conte uma preferência ou toque em “Guardar uma memória”. Seu mapa cresce a partir de informações reais.')); list.appendChild(emptyState); }
    for (i = 0; i < items.length; i++) (function (m) { var card = el('article', 'memory-card'); card.appendChild(el('span', 'section-label', M.categories[m.category] || 'Anotações')); card.appendChild(el('p', '', m.content)); card.appendChild(el('div', 'memory-meta', (m.origin === 'declared' ? 'DECLARADO POR VOCÊ' : 'GUARDADO POR VOCÊ') + ' · ' + localDate(m.updated_at))); var actions = el('div', 'memory-actions'), edit = el('button', '', 'Editar'), remove = el('button', '', 'Esquecer'); edit.onclick = function () { openMemory(m); }; remove.onclick = function () { deleteMemory(m); }; actions.appendChild(edit); actions.appendChild(remove); card.appendChild(actions); list.appendChild(card); }(items[i]));
    var topics = $('topic-list'); wipe(topics); var sorted = state.topics.slice().sort(function (a, b) { return b.count - a.count; });
    if (!sorted.length) topics.appendChild(el('p', '', 'Os assuntos aparecerão conforme você conversar.'));
    for (i = 0; i < sorted.length; i++) topics.appendChild(el('span', 'topic-chip', sorted[i].name + ' · ' + sorted[i].count));
  }
  function renderSettings() {
    $('setting-low-power').checked = !!preferences.low_power; $('setting-voice').checked = !!preferences.voice; $('setting-memory').checked = state.settings.memory_enabled !== false;
    $('settings-storage').textContent = user ? 'Sua memória está sincronizada na sua conta. O mapa e o histórico aparecem nos aparelhos em que você entrar.' : 'Suas memórias estão neste navegador. Entre para sincronizar entre aparelhos.';
    $('settings-login').textContent = user ? 'Gerenciar minha conta ↗' : 'Entrar ou criar conta ↗';
    $('sync-local').hidden = !user || !(readJSON(storageKey, empty()).memories || []).length;
    $('compatibility-description').textContent = oldAndroid ? 'Android antigo detectado. Recomendamos o modo econômico. Voz e tela cheia dependem do navegador.' : 'O modo econômico funciona em qualquer aparelho. Os recursos de voz aparecem conforme a compatibilidade do navegador.';
    document.body.className = preferences.low_power ? 'low-power' : '';
    $('power-shortcut').textContent = preferences.low_power ? '◐ Modo econômico ativo' : '◐ Modo econômico';
  }
  function openModal(id) { modalFocus = document.activeElement; $(id).hidden = false; var input = $(id).querySelector('input,textarea'); if (input) input.focus(); }
  function closeModal(id) { $(id).hidden = true; if (modalFocus && modalFocus.focus) modalFocus.focus(); }
  function openAuth() { $('auth-feedback').textContent = ''; $('auth-title').textContent = user ? 'Sua conta está conectada.' : 'Entre no seu espaço.'; $('auth-form').hidden = !!user; $('toggle-auth').hidden = !!user; $('logout-button').hidden = !user; openModal('auth-modal'); }
  function openMemory(m) { editingMemory = m ? m.id : null; $('memory-category').value = m ? m.category : 'preferences'; $('memory-content').value = m ? m.content : ''; $('memory-feedback').textContent = ''; $('memory-title').textContent = m ? 'Ajustar uma conexão.' : 'O que devo guardar?'; openModal('memory-modal'); }
  function deleteMemory(m) {
    if (!window.confirm('Esquecer esta memória? Ela deixará de entrar nas próximas respostas. O texto original continua no histórico até você apagá-lo.')) return;
    if (!user) { state.memories = state.memories.filter(function (x) { return x.id !== m.id; }); saveLocal(); render(); return; }
    request('DELETE', '/api/memory?id=' + encodeURIComponent(m.id), null, function (err) { if (err) toast(err.message); else loadData(); });
  }
  function speak(text) { if (!preferences.voice || !('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return; window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; window.speechSynthesis.speak(u); }
  function setupVoice() {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition, buttons = document.querySelectorAll('[data-mic]');
    for (var i = 0; i < buttons.length; i++) (function (button) { if (!Recognition) { button.hidden = true; return; } button.onclick = function () { var recognition; try { recognition = new Recognition(); recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = false; recognition.onstart = function () { button.className = 'mic-button listening'; toast('Ouvindo…'); }; recognition.onend = function () { button.className = 'mic-button'; }; recognition.onerror = function () { button.className = 'mic-button'; toast('O ditado não está disponível agora. Você pode digitar sua mensagem.'); }; recognition.onresult = function (event) { $(button.getAttribute('data-mic')).value = event.results[0][0].transcript; }; recognition.start(); } catch (e) { toast('Este navegador não conseguiu ativar o microfone.'); } }; }(buttons[i]));
  }
  var orbTimer = null, orbPhase = 0;
  function drawOrb(phase) {
    var canvas = $('orb'), ctx = canvas.getContext && canvas.getContext('2d'); if (!ctx) return;
    var width = canvas.width, height = canvas.height, cx = width / 2, cy = height / 2 - 5, radius = 94, ring, i;
    ctx.clearRect(0, 0, width, height);
    var glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 125); glow.addColorStop(0, 'rgba(227,206,133,.19)'); glow.addColorStop(.5, 'rgba(195,174,105,.025)'); glow.addColorStop(1, 'rgba(195,174,105,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(159,157,102,.10)'; ctx.lineWidth = .6;
    for (ring = 0; ring < 9; ring++) { ctx.beginPath(); for (i = 0; i <= 100; i++) { var angle = i / 100 * Math.PI * 2; var x = radius * Math.cos(angle), y = radius * Math.sin(angle) * Math.sin(ring * .37 + phase * .12); var rot = ring * .37 + phase * .1; var rx = x * Math.cos(rot) - y * Math.sin(rot), ry = x * Math.sin(rot) + y * Math.cos(rot); if (i === 0) ctx.moveTo(cx + rx, cy + ry); else ctx.lineTo(cx + rx, cy + ry); } ctx.stroke(); }
    for (ring = 0; ring < 4; ring++) { ctx.strokeStyle = ring === 0 ? 'rgba(224,201,128,.60)' : 'rgba(193,179,109,.30)'; ctx.lineWidth = ring === 0 ? 1 : .7; ctx.beginPath(); var rotation = ring * 1.05 + .2; for (i = 0; i <= 110; i++) { var t = i / 110 * 2 * Math.PI; var ex = Math.cos(t) * (radius + 23), ey = Math.sin(t) * (25 + ring * 9); var px = cx + ex * Math.cos(rotation) - ey * Math.sin(rotation), py = cy + ex * Math.sin(rotation) + ey * Math.cos(rotation); if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); var orbit = phase * .3 + ring * 1.7, ox = Math.cos(orbit) * (radius + 23), oy = Math.sin(orbit) * (25 + ring * 9); ctx.fillStyle = '#d8c487'; ctx.beginPath(); ctx.arc(cx + ox * Math.cos(rotation) - oy * Math.sin(rotation), cy + ox * Math.sin(rotation) + oy * Math.cos(rotation), 2, 0, Math.PI * 2); ctx.fill(); }
    var seed = 47; for (i = 0; i < 76; i++) { seed = (seed * 16807) % 2147483647; var theta = (seed / 2147483647) * Math.PI * 2 + phase * .08; seed = (seed * 16807) % 2147483647; var phi = Math.acos(2 * seed / 2147483647 - 1); var dx = radius * Math.sin(phi) * Math.cos(theta), dy = radius * Math.cos(phi); ctx.fillStyle = 'rgba(210,196,131,' + (.2 + .5 * (Math.sin(theta) + 1) / 2) + ')'; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, i % 6 === 0 ? 1.6 : .7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e5d29c'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }
  function startOrb() { if (orbTimer) { clearTimeout(orbTimer); orbTimer = null; } drawOrb(orbPhase); if (preferences.low_power || activeView !== 'home' || document.hidden) return; orbPhase += .025; orbTimer = setTimeout(startOrb, 70); }
  function bind() {
    var buttons = document.querySelectorAll('[data-view],[data-open]'), i;
    for (i = 0; i < buttons.length; i++) buttons[i].onclick = function () { go(this.getAttribute('data-view') || this.getAttribute('data-open')); };
    var prompts = document.querySelectorAll('[data-prompt]'); for (i = 0; i < prompts.length; i++) prompts[i].onclick = function () { send(this.getAttribute('data-prompt')); };
    $('home-form').onsubmit = function (event) { event.preventDefault(); send($('home-input').value); }; $('chat-form').onsubmit = function (event) { event.preventDefault(); send($('chat-input').value); };
    $('new-conversation').onclick = function () { if (busy) { toast('Espere a resposta atual antes de abrir outra conversa.'); return; } currentThread = null; renderMessages(); $('chat-input').focus(); };
    $('history-search').oninput = renderHistory; $('add-memory').onclick = function () { openMemory(); };
    $('account-button').onclick = openAuth; $('settings-login').onclick = openAuth; $('close-auth').onclick = function () { closeModal('auth-modal'); }; $('close-memory').onclick = function () { closeModal('memory-modal'); };
    $('toggle-auth').onclick = function () { authMode = authMode === 'login' ? 'register' : 'login'; $('auth-title').textContent = authMode === 'login' ? 'Entre no seu espaço.' : 'Crie seu espaço pessoal.'; $('auth-submit').textContent = authMode === 'login' ? 'Entrar' : 'Criar conta'; $('toggle-auth').textContent = authMode === 'login' ? 'Ainda não tenho conta ↗' : 'Já tenho uma conta ↗'; $('auth-feedback').textContent = ''; };
    $('auth-form').onsubmit = function (event) { event.preventDefault(); $('auth-submit').disabled = true; $('auth-feedback').textContent = 'Conectando…'; request('POST', '/api/auth', { mode: authMode, email: $('auth-email').value, password: $('auth-password').value }, function (err, data) { $('auth-submit').disabled = false; $('auth-password').value = ''; if (err) { $('auth-feedback').textContent = err.message; return; } if (!data.user) { $('auth-feedback').textContent = data.message || 'Confira seu e-mail para confirmar a conta e depois entre aqui.'; return; } user = data.user; currentThread = null; closeModal('auth-modal'); loadData(); setStatus('Conta conectada'); toast('Seu espaço está conectado.'); }); };
    $('logout-button').onclick = function () { request('POST', '/api/logout', {}, function (err) { if (err) { toast(err.message); return; } user = null; currentThread = null; state = readJSON(storageKey, empty()); closeModal('auth-modal'); render(); setStatus('Neste aparelho'); }); };
    $('memory-form').onsubmit = function (event) { event.preventDefault(); var content = $('memory-content').value.trim(); if (!content) return; if (M.sensitive(content)) { $('memory-feedback').textContent = 'Guarde preferências e objetivos. Credenciais e informações sensíveis não entram no núcleo.'; return; } var m = { category: $('memory-category').value, content: content, key: M.normalize(content).slice(0, 100), origin: 'manual' }; if (!user) { if (editingMemory) { var old = state.memories.filter(function (x) { return x.id === editingMemory; })[0]; if (old) m.key = old.key; } putLocalMemory(m); saveLocal(); render(); closeModal('memory-modal'); toast('Conexão guardada no seu núcleo.'); return; } request('POST', '/api/memory', { id: editingMemory, category: m.category, content: m.content }, function (err) { if (err) { $('memory-feedback').textContent = err.message; return; } closeModal('memory-modal'); loadData(); toast('Memória sincronizada.'); }); };
    $('setting-low-power').onchange = function () { preferences.low_power = this.checked; savePreferences(); renderSettings(); startOrb(); }; $('power-shortcut').onclick = function () { preferences.low_power = !preferences.low_power; savePreferences(); renderSettings(); startOrb(); toast(preferences.low_power ? 'Modo econômico ativado.' : 'Animação ativada.'); };
    $('setting-voice').onchange = function () { preferences.voice = this.checked; savePreferences(); if (this.checked && !('speechSynthesis' in window)) toast('A leitura por voz não está disponível neste navegador.'); };
    $('setting-memory').onchange = function () { var enabled = this.checked; if (!user) { state.settings.memory_enabled = enabled; saveLocal(); return; } request('POST', '/api/settings', { memory_enabled: enabled }, function (err) { if (err) { $('setting-memory').checked = state.settings.memory_enabled !== false; toast(err.message); } else state.settings.memory_enabled = enabled; }); };
    $('stop-voice').onclick = function () { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
    $('sync-local').onclick = function () { var local = readJSON(storageKey, empty()); if (!local.memories.length) return; request('POST', '/api/import', { memories: local.memories.map(function (m) { return { category: m.category, content: m.content }; }) }, function (err) { if (err) toast(err.message); else { loadData(); toast('Memórias importadas. O histórico local permanece neste aparelho.'); } }); };
    $('export-data').onclick = function () { var data = JSON.stringify({ format: 'aguirra-export-v1', exported_at: new Date().toISOString(), data: state }, null, 2), url; try { var blob = new Blob([data], { type: 'application/json' }); url = (window.URL || window.webkitURL).createObjectURL(blob); var a = el('a', '', 'Baixar dados'); a.href = url; a.download = 'aguirra-meus-dados.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { (window.URL || window.webkitURL).revokeObjectURL(url); }, 20000); } catch (e) { var exportWindow = window.open('', '_blank'); if (exportWindow) { exportWindow.document.body.appendChild(exportWindow.document.createElement('pre')).textContent = data; } else toast('Seu navegador bloqueou a exportação. Tente pelo computador.'); } };
    $('clear-data').onclick = function () { if (!window.confirm('Apagar todo o histórico, assuntos e memórias' + (user ? ' da sua conta em todos os aparelhos' : ' deste aparelho') + '? Essa ação não pode ser desfeita.')) return; if (!user) { state = empty(); currentThread = null; saveLocal(); render(); toast('Seu núcleo foi limpo.'); return; } request('DELETE', '/api/data', null, function (err) { if (err) toast(err.message); else { currentThread = null; loadData(); toast('Histórico e núcleo apagados da sua conta.'); } }); };
    $('fullscreen-button').onclick = function () { var root = document.documentElement, enter = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen; var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen; if (document.fullscreenElement || document.webkitFullscreenElement) { if (exit) exit.call(document); } else if (enter) { var p = enter.call(root); if (p && p.catch) p.catch(function () { toast('O navegador não permitiu a tela cheia.'); }); } else toast('Este navegador não oferece tela cheia.'); };
    document.addEventListener('visibilitychange', startOrb);
    document.addEventListener('keydown', function (event) { if (event.keyCode === 27) { closeModal('auth-modal'); closeModal('memory-modal'); } var modal = !$('auth-modal').hidden ? $('auth-modal') : (!$('memory-modal').hidden ? $('memory-modal') : null); if (event.keyCode !== 9 || !modal) return; var all = modal.querySelectorAll('button,input,textarea,select'), nodes = [], k; for (k = 0; k < all.length; k++) if (!all[k].hidden && all[k].offsetWidth > 0) nodes.push(all[k]); if (!nodes.length) return; if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); } });
  }
  function setStatus(text) { wipe($('connection-status')); $('connection-status').appendChild(el('i')); $('connection-status').appendChild(document.createTextNode(text)); }
  state = readJSON(storageKey, empty()); if (!state.memories || !state.messages || !state.threads || !state.topics || !state.settings) state = empty();
  bind(); setupVoice(); tick(); setInterval(tick, 15000); render(); startOrb();
  request('GET', '/api/session', null, function (err, data) { if (err) { setStatus('Neste aparelho'); $('server-capabilities').textContent = 'Servidor indisponível. Memória local, mapa e histórico continuam funcionando.'; return; } user = data.user || null; setStatus(user ? 'Conta conectada' : 'Neste aparelho'); $('server-capabilities').textContent = 'Conversa com IA: ' + (data.ai ? 'configurada' : 'aguardando configuração') + '. Pesquisa web: ' + (data.search ? 'configurada' : 'aguardando configuração') + '.'; if (user) loadData(); else render(); });
}());
