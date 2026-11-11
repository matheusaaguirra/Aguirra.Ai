(function () {
  'use strict';
  var M = window.AguirraMemory, A = window.AguirraAnswers, storageKey = 'aguirra.local.v1', preferencesKey = 'aguirra.preferences.v1';
  var user = null, localApi = false, voiceServer = false, googleLoginReady = false, sessionReady = false, busy = false, activeView = 'home', memoryFilter = 'all', editingMemory = null, authMode = 'login', toastTimer, modalFocus = null;
  var graphTopic = null, visitorAvailable = false, importing = false;
  var G = window.AguirraGraph, mapIndex;
  var elevenReady = false, micProcessing = false, lastDataSync = 0, questionPage = 0, selectedQuestion = null;
  var oldAndroid = /Android 4\./.test(navigator.userAgent), state = empty(), preferences = readJSON(preferencesKey, { low_power: oldAndroid, voice: true });
  if (preferences.voice_provider_version !== 1) { preferences.voice_name = '__elevenlabs__'; preferences.voice_provider_version = 1; savePreferences(); }
  if (preferences.voice_version !== 2) { preferences.voice = true; preferences.voice_version = 2; savePreferences(); }
  function $(id) { return document.getElementById(id); }
  function empty() { return { memories: [], threads: [], messages: [], topics: [], settings: { memory_enabled: true } }; }
  function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : ((r & 3) | 8)).toString(16); }); }
  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function savePreferences() { try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch (e) { /* Session-only settings remain usable. */ } }
  function el(tag, cls, content) { var n = document.createElement(tag); if (cls) n.className = cls; if (content !== undefined) n.appendChild(document.createTextNode(String(content))); return n; }
  function icon(name) { var n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); n.setAttribute('class', 'icon'); n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true'); use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#i-' + name); n.appendChild(use); return n; }
  function iconLabel(button, name, text) { wipe(button); button.appendChild(icon(name)); button.appendChild(document.createTextNode(' ' + text)); }
  function wipe(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').hidden = true; }, 5000); }
  function request(method, path, body, callback) {
    var xhr = new XMLHttpRequest(), finished = false;
    function finish(err, data) { if (finished) return; finished = true; callback(err, data); }
    xhr.open(method, path, true); xhr.timeout = path === '/api/ask' || path === '/api/transcribe' ? 180000 : 20000;
    xhr.setRequestHeader('Accept', 'application/json');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () { if (xhr.readyState !== 4) return; var data; try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; } if (xhr.status >= 200 && xhr.status < 300) finish(null, data); else finish({ status: xhr.status, message: data.error || 'Não consegui conectar ao servidor agora.' }, data); };
    xhr.onerror = function () { finish({ message: 'Sem conexão com o Supabase. Tente novamente.' }); };
    xhr.ontimeout = function () { finish({ message: 'A resposta demorou mais que o esperado. Confira o histórico antes de reenviar.' }); };
    xhr.send(body ? JSON.stringify(body) : null);
  }
  function go(view) {
    var views = document.querySelectorAll('.view'), buttons = document.querySelectorAll('[data-view]'), names = { home: 'Central', brain: 'Mapa cerebral', history: 'Histórico', settings: 'Configurações' }, i;
    activeView = view;
    for (i = 0; i < views.length; i++) views[i].className = views[i].className.replace(/\s+active\b/g, '') + (views[i].id === 'view-' + view ? ' active' : '');
    for (i = 0; i < buttons.length; i++) {
      var current = buttons[i].getAttribute('data-view') === view;
      buttons[i].className = 'nav-item' + (current ? ' selected' : '');
      buttons[i].setAttribute('aria-current', current ? 'page' : 'false');
    }
    $('page-name').textContent = names[view]; if (view === 'brain') renderBrain(); if (view === 'history') renderHistory(); if (view === 'settings') renderSettings();
    startOrb();
    window.scrollTo(0, 0);
  }
  function localDate(date, timeOnly) { var d = new Date(date || new Date()); if (timeOnly) return pad(d.getHours()) + ':' + pad(d.getMinutes()); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() { var d = new Date(), months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']; $('clock-label').textContent = localDate(d, true); $('date-label').textContent = d.getDate() + ' de ' + months[d.getMonth()] + ', ' + d.getFullYear(); }
  function render() {
    var points = A.pairs(state.messages), count = state.memories.length + points.length;
    mapIndex = G.relations(points, state.memories);
    var answerCount = G.memoryCount(points), notes = state.memories.length;
    $('home-memory-count').textContent = String(answerCount);
    $('home-memory-label').textContent = answerCount === 1 ? 'memória de resposta' : 'memórias de resposta';
    $('nav-memory-count').textContent = String(count);
    $('mini-map-wrap').hidden = count === 0;
    if (count) G.draw($('mini-brain'), G.network(points.slice(-50), state.memories.slice(0, 12), mapIndex), null, null, true);
    $('context-description').textContent = points.length + (points.length === 1 ? ' pergunta' : ' perguntas') + ' · ' + notes + (notes === 1 ? ' nota' : ' notas');
    $('last-point').hidden = count === 0;
    var latestQuestion = points.length ? points[points.length - 1].question : null, latestNote = state.memories[0];
    var latest = latestNote && (!latestQuestion || latestNote.updated_at > latestQuestion.created_at) ? latestNote : latestQuestion;
    $('last-connection').textContent = latest ? latest.content : '';
    $('account-name').textContent = user ? (user.email || 'Sua conta') : 'Seu espaço pessoal'; wipe($('avatar')); $('avatar').appendChild(icon('user')); $('account-state').textContent = user ? (localApi ? 'Memória no seu computador' : 'Memória sincronizada') : 'Visitante · Supabase';
    renderSettings(); if (activeView === 'brain') renderBrain(); if (activeView === 'history') renderHistory();
  }
  function addMessage(role, text, failed) { var m = { id: uid(), thread_id: state.log_id, role: role, content: text, created_at: new Date().toISOString(), sources: [], failed: !!failed }; state.messages.push(m); mapIndex = null; return m; }
  function ensureLog() { if (!state.log_id) state.log_id = uid(); }
  function send(text, forceRefresh) {
    text = String(text || '').trim(); if (!text || busy || micProcessing) return; if (!sessionReady) { toast('Conectando ao Aguirra. Envie novamente em um instante.'); return; }
    if (text.length > 4000) { toast('Sua mensagem deve ter até 4.000 caracteres.'); return; }
    text = M.redact(text); window.AguirraVoice.prime(); window.AguirraMicrophone.cancel(); window.AguirraVoice.stop(); go('home'); $('voice-hint').hidden = true; $('home-input').value = '';
    var reused = !forceRefresh && Date.now() - lastDataSync < 60000 ? A.find(text, state.messages, state.memories, state.settings.memory_enabled) : null;
    ensureLog(); var pending = addMessage('user', text), payload = { message: text, request_id: pending.id, force_refresh: !!forceRefresh };
    setBusy(true);
    // Identity is the same on the device and server. Speak now while the signed-in record is saved.
    var immediateIdentity = M.identityAnswer(text);
    if (immediateIdentity || reused) speak(immediateIdentity || reused.answer.content, { id: null });
    request('POST', '/api/ask', payload, function (err, result) {
      setBusy(false);
      if (err) {
        if (immediateIdentity || reused) { toast('Não consegui confirmar o registro desta pergunta no histórico. ' + err.message); loadData(); return; }
        addMessage('assistant', err.message, true); toast(err.message);
        speak(err.message, {id:null}); loadData();
        return;
      }
      if (!immediateIdentity && !reused) speak(result.reply, { id: result.answer_id || null });
      else if (lastReply === window.AguirraVoice.cleanText(result.reply)) lastReplyId = result.answer_id || null;
      else speak(result.reply,{id:result.answer_id || null});
      loadData(function () { if (result.learned) toast('Nova conexão guardada no seu núcleo.'); });
    });
  }
  function setBusy(value) { busy = value; $('home-submit').disabled = value; $('home-input').disabled = value; if (value) hideCaption(); updateOrbState(); }
  function loadData(callback) { request('GET', '/api/data', null, function (err, data) { if (err) { toast(err.message); if (callback) callback(err); return; } var oldContext = A.contextKey(state.memories, state.settings.memory_enabled); state = data; lastDataSync = Date.now(); if (oldContext !== A.contextKey(state.memories, state.settings.memory_enabled)) window.AguirraVoice.clearCache(); render(); if (callback) callback(); }); }
  function renderHistory() {
    var list = $('history-list'), query = M.normalize($('history-search').value), found = 0; wipe(list);
    for (var i = state.messages.length - 1; i >= 0; i--) {
      var question = state.messages[i]; if (question.role !== 'user') continue;
      var response = null;
      if (question.reply_id) { for (var r = 0; r < state.messages.length; r++) if (state.messages[r].id === question.reply_id) response = state.messages[r]; }
      if (!response) for (var j = i + 1; j < state.messages.length; j++) { if (state.messages[j].thread_id !== question.thread_id) continue; if (state.messages[j].role === 'user') break; if (state.messages[j].role === 'assistant') { response = state.messages[j]; break; } }
      if (query && M.normalize(question.content + ' ' + (response ? response.content : '')).indexOf(query) === -1) continue;
      found++;
      (function (q, r) {
        var card = el('article', 'history-card'), details = el('details', 'history-record'), summary = el('summary', '');
        summary.appendChild(el('span', 'section-label', localDate(q.created_at) + ' · ' + localDate(q.created_at, true))); summary.appendChild(el('h3', '', q.content));
        details.appendChild(summary);
        var answer = el('div', 'history-answer'); if (r && r.cache_meta && r.cache_meta.reused_from) answer.appendChild(el('p', 'section-label', 'Recuperada do seu núcleo')); answer.appendChild(el('p', 'history-answer-text', r ? window.AguirraVoice.cleanText(r.content) : 'Esta pergunta foi registrada, mas não tem uma resposta salva.'));
        var sources = r && r.sources || [], links = el('div', 'sources');
        for (var k = 0; k < sources.length; k++) { if (!/^https:\/\//i.test(sources[k].url)) continue; var link = el('a', 'source-link', sources[k].title); link.href = sources[k].url; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.appendChild(link); }
        if (links.childNodes.length) answer.appendChild(links);
        if (r) { var hear = el('button', 'quiet-button history-listen'); hear.type = 'button'; iconLabel(hear, 'volume', 'Ouvir resposta'); hear.onclick = function () { if (busy || micProcessing) { toast('Aguarde a resposta atual.'); return; } presentResponse(r.content, r); window.AguirraVoice.speak(lastReply, lastReplyId); }; answer.appendChild(hear); }
        details.appendChild(answer); card.appendChild(details); list.appendChild(card);
      }(question, response));
    }
    if (!found) list.appendChild(el('div', 'empty-state', query ? 'Nenhuma pergunta encontrada.' : 'Suas perguntas e respostas serão registradas aqui, sem criar conversas.'));
  }
  function svgEl(tag, attrs, content) { var n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); if (content !== undefined) n.textContent = content; return n; }
  function renderQuestionMap() {
    var all = A.pairs(state.messages).reverse(), query = M.normalize($('question-search').value);
    if (!mapIndex) mapIndex = G.relations(all, state.memories);
    var list = all.filter(function (p) { return (!graphTopic || mapIndex.byId['q/' + p.question.id].info.group === graphTopic) && (!query || M.normalize(p.question.content+' '+(p.answer ? p.answer.content : '')).indexOf(query)!==-1); });
    var totalPages = Math.max(1, Math.ceil(list.length / 60)); questionPage = Math.max(0, Math.min(questionPage, totalPages - 1));
    $('brain-summary').textContent = all.length+(all.length===1?' pergunta · ':' perguntas · ')+G.memoryCount(all)+(G.memoryCount(all)===1?' memória de resposta · ':' memórias de resposta · ')+state.memories.length+(state.memories.length===1?' nota pessoal':' notas pessoais');
    var pages=$('question-pages'), svg=$('brain-svg'), index=$('question-list'), i;
    wipe(pages); wipe(index);
    function action(label, name, fn) {
      var btn = el('button', 'quiet-button', label);
      btn.type = 'button'; btn.onclick = fn; btn.setAttribute('aria-label', name); btn.setAttribute('title', name);
      pages.appendChild(btn); return btn;
    }
    var visible = list.slice(questionPage * 60, (questionPage + 1) * 60);
    var visibleNotes = state.memories.filter(function (note) {
      return (!query || M.normalize(note.content).indexOf(query) !== -1) &&
        (!graphTopic || (mapIndex.byId['n/' + note.id].info.group || M.categories[note.category] || 'Anotações') === graphTopic);
    }).slice(0, 40);
    var graph = G.network(visible, visibleNotes, mapIndex);
    function resetFilter() {
      graphTopic = null; questionPage = 0; selectedQuestion = null;
      $('question-search').value = ''; renderBrain();
    }
    if (graph.nodes.length) {
      action('−', 'Diminuir zoom', function () { G.zoom(.8, svg); });
      action('+', 'Aumentar zoom', function () { G.zoom(1.25, svg); });
      action('Enquadrar', 'Enquadrar pontos do mapa', function () { G.zoom(0, svg); });
    }
    if (graphTopic) action(graphTopic + ' ×', 'Remover filtro de assunto', function () { graphTopic = null; questionPage = 0; selectedQuestion = null; renderBrain(); });
    if (totalPages > 1) {
      action('Anterior', 'Página anterior', function () { questionPage--; selectedQuestion = null; renderBrain(); }).disabled = questionPage === 0;
      pages.appendChild(el('span', '', (questionPage + 1) + ' / ' + totalPages));
      action('Próxima', 'Próxima página', function () { questionPage++; selectedQuestion = null; renderBrain(); }).disabled = questionPage + 1 >= totalPages;
    }
    var filtered = !!(query || graphTopic);
    $('map-empty').hidden = graph.nodes.length > 0;
    $('map-empty-title').textContent = filtered ? 'Nenhum ponto encontrado' : 'Seu mapa começa com uma pergunta';
    $('map-empty-action').textContent = filtered ? 'Limpar filtros' : 'Ir para a Central';
    $('map-empty-action').onclick = filtered ? resetFilter : function () { go('home'); $('home-input').focus(); };
    function select(q) {
      if (!visible.some(function (p) { return p.question.id === q.id; })) {
        graphTopic = null; $('question-search').value = '';
        for (var j = 0; j < all.length; j++) if (all[j].question.id === q.id) questionPage = Math.floor(j / 60);
      }
      selectedQuestion = q.id; renderBrain();
      var detail = $('question-detail');
      if (detail.scrollIntoView) detail.scrollIntoView({block: 'nearest'});
    }
    G.draw(svg, graph, function (node) {
      if (node.pair) select(node.pair.question);
      else if (node.note) openMemory(node.note);
      else { graphTopic = node.label; questionPage = 0; selectedQuestion = null; renderBrain(); }
    }, selectedQuestion, false);
    visible.forEach(function(p){var btn=el('button','question-index-item',p.question.content);btn.onclick=function(){select(p.question);};index.appendChild(btn);});
    if(!list.length) index.appendChild(el('p','',all.length?'Nenhuma pergunta encontrada.':'Faça uma pergunta na Central para iniciar o mapa.'));
    var detail = $('question-detail'), selected = null; wipe(detail); detail.hidden = true;
    for (i = 0; i < all.length; i++) if (all[i].question.id === selectedQuestion) selected = all[i];
    if (!selected) return;
    detail.hidden = false; detail.appendChild(el('span', 'section-label', 'PONTO DO SEU NÚCLEO')); detail.appendChild(el('h3', '', selected.question.content));
    detail.appendChild(el('p', 'question-answer', selected.answer ? window.AguirraVoice.cleanText(selected.answer.content) : 'Esta pergunta ainda não tem uma resposta salva.'));
    var sources = selected.answer && selected.answer.sources || [];
    for (i = 0; i < sources.length; i++) if (/^https:\/\//i.test(sources[i].url)) { var link = el('a', 'source-link', sources[i].title); link.href = sources[i].url; link.target = '_blank'; link.rel = 'noopener noreferrer'; detail.appendChild(link); }
    var links = mapIndex.byId['q/' + selectedQuestion].links;
    if (links.length) {
      var section = el('div', 'graph-links');
      section.appendChild(el('h4', '', 'Pontos conectados'));
      links.forEach(function (link) {
        var record = mapIndex.byId[link.id].record, question = record.question;
        var btn = el('button', '', question ? question.content : record.content);
        btn.type = 'button'; btn.appendChild(el('small', '', link.reason));
        btn.onclick = function () { if (question) select(question); else openMemory(record); };
        section.appendChild(btn);
      });
      detail.appendChild(section);
    }
    var actions = el('div', 'question-actions');
    if (selected.answer && !selected.answer.failed) { var hear = el('button', 'quiet-button', 'Ouvir resposta'); hear.type = 'button'; hear.onclick = function () { if (busy || micProcessing) return; presentResponse(selected.answer.content, selected.answer); window.AguirraVoice.speak(lastReply, lastReplyId); }; actions.appendChild(hear); }
    var refresh = el('button', 'quiet-button', 'Consultar de novo'); refresh.type = 'button'; refresh.onclick = function () { send(selected.question.content, true); }; actions.appendChild(refresh);
    var close = el('button', 'quiet-button', 'Fechar'); close.type = 'button'; close.onclick = function () { selectedQuestion = null; renderBrain(); }; actions.appendChild(close); detail.appendChild(actions);
    detail.appendChild(el('p', 'question-cache-note', A.find(selected.question.content, [selected.question].concat(selected.answer ? [selected.answer] : []), state.memories, state.settings.memory_enabled) ? 'Resposta disponível para reutilização. Você pode consultar de novo para atualizá-la.' : 'Ponto preservado no mapa. Esta resposta precisa de uma nova consulta para ser reutilizada.'));
  }
  function renderBrain() {
    renderQuestionMap();
    var cats = ['profile', 'preferences', 'goals', 'projects', 'notes'], i;
    var filters = $('memory-filters'); wipe(filters); var allCats = ['all'].concat(cats);
    for (i = 0; i < allCats.length; i++) (function (cat) { var b = el('button', 'filter-button' + (memoryFilter === cat ? ' selected' : ''), cat === 'all' ? 'Todas as notas' : M.categories[cat]); b.onclick = function () { memoryFilter = cat; renderBrain(); }; filters.appendChild(b); }(allCats[i]));
    var list = $('memory-list'); wipe(list); var items = state.memories.filter(function (m) { return memoryFilter === 'all' || m.category === memoryFilter; });
    if (!items.length) { var emptyState = el('div', 'empty-state'); emptyState.appendChild(el('strong', '', 'Nenhuma nota pessoal nesta seleção.')); emptyState.appendChild(el('span', '', 'Guarde uma preferência ou um objetivo para personalizar respostas futuras.')); list.appendChild(emptyState); }
    for (i = 0; i < items.length; i++) (function (m) { var card = el('article', 'memory-card'); card.appendChild(el('span', 'section-label', M.categories[m.category] || 'Anotações')); card.appendChild(el('p', '', m.content)); card.appendChild(el('div', 'memory-meta', (m.origin === 'declared' ? 'DECLARADO POR VOCÊ' : 'GUARDADO POR VOCÊ') + ' · ' + localDate(m.updated_at))); var actions = el('div', 'memory-actions'), edit = el('button', '', 'Editar'), remove = el('button', '', 'Esquecer'); edit.onclick = function () { openMemory(m); }; remove.onclick = function () { deleteMemory(m); }; actions.appendChild(edit); actions.appendChild(remove); card.appendChild(actions); list.appendChild(card); }(items[i]));
    var topics = $('topic-list'); wipe(topics); var subjectTotals=Object.create(null); A.pairs(state.messages).forEach(function(p){var subject=mapIndex.byId['q/' + p.question.id].info.group;if (!subject) return;subjectTotals[subject]=(subjectTotals[subject]||0)+1;}); var sorted = Object.keys(subjectTotals).map(function(name){return {name:name,count:subjectTotals[name]};}).sort(function (a, b) { return b.count - a.count; });
    if (!sorted.length) topics.appendChild(el('p', '', 'Os assuntos aparecerão conforme você conversar.'));
    for (i = 0; i < sorted.length; i++) topics.appendChild(el('span', 'topic-chip', sorted[i].name + ' · ' + sorted[i].count));
  }
  function renderSettings() {
    if (window.AguirraVoice.setScope) window.AguirraVoice.setScope(user ? 'user:' + user.id : 'guest');
    $('setting-low-power').checked = !!preferences.low_power; $('setting-voice').checked = !!preferences.voice; $('setting-memory').checked = state.settings.memory_enabled !== false;
    $('settings-storage').textContent = user ? (localApi ? 'O núcleo e o histórico ficam no seu computador. O tablet e o PC acessam a mesma memória pela rede local, sem banco pago.' : 'Sua memória está sincronizada na sua conta. O mapa e o histórico aparecem nos aparelhos em que você entrar.') : 'Seu núcleo de visitante fica no Supabase. Este navegador usa uma sessão privada para acessá-lo. Entre com Google para acessar a mesma conta em outros aparelhos.';
    $('settings-login').textContent = user ? 'Gerenciar meu acesso ↗' : (localApi ? 'Conectar ao meu computador ↗' : 'Entrar ou criar conta ↗');
    var legacy = readJSON(storageKey,empty());
    $('sync-local').hidden = !(legacy.messages.length || legacy.memories.length || (user && visitorAvailable));
    $('sync-local').textContent = 'Importar histórico anterior para este núcleo';
    $('compatibility-description').textContent = oldAndroid ? 'Android antigo detectado. Recomendamos o modo econômico. Voz e tela cheia dependem do navegador.' : 'O modo econômico funciona em qualquer aparelho. Os recursos de voz aparecem conforme a compatibilidade do navegador.';
    document.body.className = preferences.low_power ? 'low-power' : '';
    $('power-shortcut').setAttribute('aria-pressed', String(!!preferences.low_power));
    iconLabel($('power-shortcut'), 'power', preferences.low_power ? 'Modo econômico ativo' : 'Modo econômico');
    if (window.AguirraVoice) window.AguirraVoice.setServer(voiceServer); window.AguirraVoice.setEleven(elevenReady);
    populateVoices();
  }
  function openModal(id) { modalFocus = document.activeElement; $(id).hidden = false; var input = $(id).querySelector('input,textarea'); if (input) input.focus(); updateOrbState(); }
  function closeModal(id) { $(id).hidden = true; if (modalFocus && modalFocus.focus) modalFocus.focus(); updateOrbState(); }
  function openAuth() { if (busy) { toast('Aguarde a resposta antes de mudar o acesso.'); return; } $('auth-feedback').textContent = ''; $('google-auth').hidden = !!user || localApi; $('google-login').disabled = !googleLoginReady; $('google-login-status').textContent = googleLoginReady ? 'Use sua conta Google para sincronizar seu núcleo.' : 'A entrada com Google aguarda ativação. Você pode continuar sem conta.'; $('auth-title').textContent = user ? 'Seu acesso está conectado.' : (localApi ? 'Conecte ao seu computador.' : 'Entre no seu espaço.'); $('auth-form').hidden = !!user; $('toggle-auth').hidden = !!user || localApi; $('logout-button').hidden = !user; $('auth-email').hidden = localApi; $('auth-email').required = !localApi; document.querySelector('label[for="auth-email"]').hidden = localApi; document.querySelector('label[for="auth-password"]').textContent = localApi ? 'Código de acesso exibido no computador' : 'Senha'; if (localApi) { $('auth-email').value = 'local@aguirra.invalid'; authMode = 'login'; $('auth-submit').textContent = 'Conectar'; document.querySelector('#auth-modal .modal > p').textContent = 'Digite o código que aparece ao iniciar o Aguirra no computador. Nenhuma conta ou API paga é necessária.'; } openModal('auth-modal'); }
  function openMemory(m) { editingMemory = m ? m.id : null; $('memory-category').value = m ? m.category : 'preferences'; $('memory-content').value = m ? m.content : ''; $('memory-feedback').textContent = ''; $('memory-title').textContent = m ? 'Ajustar uma conexão.' : 'O que devo guardar?'; openModal('memory-modal'); }
  function excludeLocalMemory(m) { if (!m.source_message_id) return; for (var i = 0; i < state.messages.length; i++) if (state.messages[i].id === m.source_message_id) state.messages[i].exclude_context = true; }
  function deleteMemory(m) {
    if (!window.confirm('Esquecer esta memória? Ela deixará de entrar nas próximas respostas. O texto original continua no histórico até você apagá-lo.')) return;
    window.AguirraVoice.clearCache();
    request('DELETE', '/api/memory?id=' + encodeURIComponent(m.id), null, function (err) { if (err) toast(err.message); else loadData(); });
  }
  var lastReply = '', lastReplyId = null, voiceActive = false, voiceLoading = false, listening = false, orbPulse = 0;
  function updateOrbState() {
    window.AguirraWake.pause(!sessionReady || busy || voiceActive || voiceLoading || listening || micProcessing || document.hidden || !$('auth-modal').hidden || !$('memory-modal').hidden);
    var mode = listening ? 'listening' : (voiceActive ? 'speaking' : (busy || micProcessing || voiceLoading ? 'thinking' : 'idle'));
    $('orb-stage').className = 'orb-stage is-' + mode;
    $('assistant-status').textContent = { listening: 'Ouvindo', thinking: 'Preparando resposta', speaking: 'Falando', idle: 'Em espera' }[mode];
    $('stop-response').hidden = !voiceActive && !voiceLoading; startOrb();
  }
  function hideCaption() { $('orb-subtitle').hidden = true; $('orb-subtitle').textContent = ''; }
  function presentResponse(text, record) {
    lastReply = window.AguirraVoice.cleanText(text);
    var response = record || null;
    if (!response) for (var i = state.messages.length - 1; i >= 0; i--) if (state.messages[i].role === 'assistant') { response = state.messages[i]; break; }
    lastReplyId = user && response ? response.id : null;
    hideCaption(); $('voice-hint').hidden = true;
    if (!preferences.voice) { $('voice-hint').textContent = 'Resposta salva no Histórico.'; $('voice-hint').hidden = false; }
  }
  function speak(text, record) { presentResponse(text, record); if (preferences.voice) window.AguirraVoice.speak(lastReply, lastReplyId); }
  function populateVoices() { if (!window.AguirraVoice) return; var available = window.AguirraVoice.voices(), select = $('setting-voice-name'); wipe(select); var automatic = el('option', '', elevenReady ? 'ElevenLabs · voz natural' : 'ElevenLabs · aguardando configuração'); automatic.value = '__elevenlabs__'; select.appendChild(automatic); var browserVoice = el('option', '', 'Voz automática do aparelho'); browserVoice.value = ''; select.appendChild(browserVoice); for (var i = 0; i < available.length; i++) { var option = el('option', '', available[i].name + ' (' + available[i].lang + ')'); option.value = available[i].name; select.appendChild(option); } if (voiceServer) { var computer = el('option', '', 'Voz do meu computador (Windows)'); computer.value = '__computer__'; select.appendChild(computer); } select.value = preferences.voice_name || ''; }
  function setupVoice() {
    window.AguirraMicrophone.configure({
      onState: function (value) { listening = value === 'listening' || value === 'requesting'; micProcessing = value === 'transcribing'; var button = document.querySelector('[data-mic]'); button.className = 'mic-button' + (listening ? ' listening' : ''); button.setAttribute('aria-pressed', listening ? 'true' : 'false'); button.setAttribute('aria-label', listening ? 'Concluir pergunta por voz' : 'Falar com o Aguirra'); $('cancel-microphone').hidden = !listening && !micProcessing; $('microphone-status').hidden = value === 'idle'; $('microphone-status').textContent = { requesting: 'Aguardando a permissão do microfone…', listening: 'Estou ouvindo. Toque no microfone para concluir.', transcribing: 'Transformando sua fala em texto…', idle: 'Toque no microfone para falar. Toque novamente para concluir.' }[value]; $('home-submit').disabled = busy || micProcessing; $('home-input').disabled = busy || micProcessing; updateOrbState(); },
      onText: function (text) { $('home-input').value = text; }, onNotice: function (text) { $('microphone-status').textContent = text; $('microphone-status').hidden = false; },
      onResult: function (text) { $('home-input').value = text; send(text); }, transcribe: function (audio, callback) { request('POST', '/api/transcribe', { audio: audio }, callback); }
    });
    document.querySelector('[data-mic]').onclick = function () { if (busy || micProcessing) return; if (!sessionReady) { $('microphone-status').hidden = false; $('microphone-status').textContent = 'Conectando ao Aguirra. Tente novamente em um instante.'; return; } window.AguirraWake.pause(true); window.AguirraVoice.stop(); window.AguirraWake.pause(true); window.AguirraMicrophone.toggle(); };
    $('cancel-microphone').onclick = function () { window.AguirraMicrophone.cancel(); };
  }
  var orbTimer = null, orbPhase = 0, bandLevels = [];
  function drawOrb(phase) {
    var canvas = $('orb'), ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || !canvas.clientWidth || !canvas.clientHeight) return;
    var scale = preferences.low_power ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.round(canvas.clientWidth * scale), h = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);

    var spectrum = listening ? window.AguirraMicrophone.spectrum() : window.AguirraVoice.spectrum();
    var strength = voiceActive || listening ? .95 : (busy || micProcessing || voiceLoading ? .65 : .45);
    var samples = preferences.low_power ? 60 : 96, strands = preferences.low_power ? 14 : 28;
    var center = h / 2, height = Math.min(h * .44, w * .19);
    var ink = ctx.createLinearGradient(w * .04, 0, w * .96, 0);
    ink.addColorStop(0, 'rgba(125,91,186,0)');
    ink.addColorStop(.16, '#8d83ea'); ink.addColorStop(.42, '#aa97ff');
    ink.addColorStop(.58, '#d5d9ff'); ink.addColorStop(.80, '#9dc8f4');
    ink.addColorStop(1, 'rgba(125,91,186,0)');
    ctx.strokeStyle = ink;
    // A shared envelope keeps the filaments together as the frequency bands change.
    var columns = [], i, j;
    for (i = 0; i <= samples; i++) {
      var t = i / samples, envelope = Math.pow(Math.sin(t * Math.PI), 1.6);
      var bin = spectrum && spectrum.length ? spectrum[Math.floor(t * (spectrum.length - 1) * .65)] / 255 : 0;
      var level = (bandLevels[i] || 0) * .76 + bin * .24;
      bandLevels[i] = level;
      var gain = height * envelope * (.62 + strength * .26 + level * .42 + orbPulse * .10);
      var carrier = 2 * Math.PI * t;
      columns.push({
        x: w * (.035 + .93 * t),
        axis: center + gain * (.35 * Math.sin(carrier * 1.65 - phase) + .15 * Math.cos(carrier * 3.1 + phase * .5)),
        front: gain * .66 * Math.sin(carrier * 1.85 + phase * .64),
        depth: gain * .72 * Math.cos(carrier * 2.15 - phase * .7)
      });
    }
    for (j = 0; j < strands; j++) {
      var u = j / (strands - 1), depth = Math.sin(Math.PI * u);
      ctx.beginPath();
      ctx.globalAlpha = j === 0 || j === strands - 1 ? .88 : .21 + .33 * depth;
      ctx.lineWidth = scale * (j === 0 || j === strands - 1 ? 1.25 : .85);
      for (i = 0; i < columns.length; i++) {
        var column = columns[i], y = column.axis + (u * 2 - 1) * column.front + column.depth * depth;
        if (i) ctx.lineTo(column.x, y); else ctx.moveTo(column.x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    orbPulse *= .90;
  }
  function startOrb() {
    if (orbTimer) { clearTimeout(orbTimer); orbTimer = null; }
    if (activeView !== 'home' || document.hidden) return;
    drawOrb(orbPhase);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (preferences.low_power && !voiceActive && !voiceLoading && !busy && !listening && !micProcessing) return;
    orbPhase += (voiceActive || listening ? .045 : .019);
    orbTimer = setTimeout(startOrb, preferences.low_power ? 100 : 40);
  }
  function importPrevious() {
    if (importing) return;
    var legacy = readJSON(storageKey,empty()), raw;
    try { raw=localStorage.getItem(storageKey); } catch(e) { raw=null; }
    var messages=(legacy.messages || []).slice(), memories=(legacy.memories || []).slice();
    importing=true;
    function failed(err) { importing=false; toast(err.message); }
    function batch() {
      if(messages.length || memories.length) {
        request('POST','/api/import-graph',{messages:messages.splice(0,8),memories:memories.splice(0,8)},function(err){if(err) failed(err); else batch();});
        return;
      }
      if(raw) try { if(localStorage.getItem(storageKey)===raw) localStorage.removeItem(storageKey); } catch(e) {}
      if(user && visitorAvailable) {
        request('POST','/api/adopt-visitor',{},function(err){if(err){failed(err);return;} visitorAvailable=false; finish();});
      } else finish();
    }
    function finish(){importing=false;loadData(function(err){if(!err)toast('Histórico sincronizado no Supabase.');});}
    batch();
  }
  function bind() {
    var buttons = document.querySelectorAll('[data-view],[data-open]'), i;
    for (i = 0; i < buttons.length; i++) buttons[i].onclick = function () { go(this.getAttribute('data-view') || this.getAttribute('data-open')); };
    var prompts = document.querySelectorAll('[data-prompt]'); for (i = 0; i < prompts.length; i++) prompts[i].onclick = function () { send(this.getAttribute('data-prompt')); };
    $('home-form').onsubmit = function (event) { event.preventDefault(); send($('home-input').value); };
    $('stop-response').onclick = function () { window.AguirraVoice.stop(); };
    $('question-search').oninput = function () { questionPage = 0; selectedQuestion = null; renderBrain(); };
    $('history-search').oninput = renderHistory; $('add-memory').onclick = function () { openMemory(); };
    $('account-button').onclick = openAuth; $('settings-login').onclick = openAuth; $('close-auth').onclick = function () { closeModal('auth-modal'); }; $('close-memory').onclick = function () { closeModal('memory-modal'); };
    $('google-login').onclick = function () { if (!googleLoginReady) return; this.disabled = true; $('google-login-status').textContent = 'Conectando ao Google…'; request('POST', '/api/google', {}, function (err, result) { if (err) { $('google-login').disabled = false; $('google-login-status').textContent = err.message; return; } window.location.href = result.url; }); };
    $('toggle-auth').onclick = function () { authMode = authMode === 'login' ? 'register' : 'login'; $('auth-title').textContent = authMode === 'login' ? 'Entre no seu espaço.' : 'Crie seu espaço pessoal.'; $('auth-submit').textContent = authMode === 'login' ? 'Entrar' : 'Criar conta'; $('toggle-auth').textContent = authMode === 'login' ? 'Ainda não tenho conta ↗' : 'Já tenho uma conta ↗'; $('auth-feedback').textContent = ''; };
    $('auth-form').onsubmit = function (event) { event.preventDefault(); $('auth-submit').disabled = true; $('auth-feedback').textContent = 'Conectando…'; request('POST', '/api/auth', { mode: authMode, email: $('auth-email').value, password: $('auth-password').value }, function (err, data) { $('auth-submit').disabled = false; $('auth-password').value = ''; if (err) { $('auth-feedback').textContent = err.message; return; } if (!data.user) { $('auth-feedback').textContent = data.message || 'Confira seu e-mail para confirmar a conta e depois entre aqui.'; return; } user = data.user; lastDataSync = 0; state = empty(); window.AguirraVoice.stop(); window.AguirraVoice.clearCache(); hideCaption(); closeModal('auth-modal'); loadData(); setStatus('Conta conectada'); toast('Seu espaço está conectado.'); }); };
    $('logout-button').onclick = function () { request('POST', '/api/logout', {}, function (err) { if (err) { toast(err.message); return; } user = null; lastDataSync = 0; window.AguirraVoice.stop(); window.AguirraVoice.clearCache(); hideCaption(); state = empty(); closeModal('auth-modal'); render(); setStatus('Núcleo na nuvem'); loadData(); }); };
    $('memory-form').onsubmit = function (event) { event.preventDefault(); var content = $('memory-content').value.trim(); if (!content) return; if (M.sensitive(content)) { $('memory-feedback').textContent = 'Guarde preferências e objetivos. Credenciais e informações sensíveis não entram no núcleo.'; return; } var m = { category: $('memory-category').value, content: content, key: M.normalize(content).slice(0, 100), origin: 'manual' }; request('POST', '/api/memory', { id: editingMemory, category: m.category, content: m.content }, function (err) { if (err) { $('memory-feedback').textContent = err.message; return; } closeModal('memory-modal'); loadData(); toast('Memória sincronizada.'); }); };
    $('setting-low-power').onchange = function () { preferences.low_power = this.checked; savePreferences(); renderSettings(); startOrb(); }; $('power-shortcut').onclick = function () { preferences.low_power = !preferences.low_power; savePreferences(); renderSettings(); startOrb(); toast(preferences.low_power ? 'Modo econômico ativado.' : 'Animação ativada.'); };
    $('setting-voice').onchange = function () { preferences.voice = this.checked; savePreferences(); if (!this.checked) window.AguirraVoice.stop(); };
    $('setting-voice-name').onchange = function () { preferences.voice_name = this.value; window.AguirraVoice.setVoice(this.value); savePreferences(); };
    $('test-voice').onclick = function () { window.AguirraVoice.speak('Olá. Eu sou o Aguirra, seu assistente pessoal. Estou pronto para conversar com você.', null, true); };
    $('setting-memory').onchange = function () { var enabled = this.checked; window.AguirraVoice.clearCache(); request('POST', '/api/settings', { memory_enabled: enabled }, function (err) { if (err) { $('setting-memory').checked = state.settings.memory_enabled !== false; toast(err.message); } else state.settings.memory_enabled = enabled; }); };
    $('stop-voice').onclick = function () { window.AguirraVoice.stop(); };
    $('sync-local').onclick = importPrevious;
    $('export-data').onclick = function () { var data = JSON.stringify({ format: 'aguirra-export-v1', exported_at: new Date().toISOString(), data: state }, null, 2), url; try { var blob = new Blob([data], { type: 'application/json' }); url = (window.URL || window.webkitURL).createObjectURL(blob); var a = el('a', '', 'Baixar dados'); a.href = url; a.download = 'aguirra-meus-dados.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { (window.URL || window.webkitURL).revokeObjectURL(url); }, 20000); } catch (e) { var exportWindow = window.open('', '_blank'); if (exportWindow) { exportWindow.document.body.appendChild(exportWindow.document.createElement('pre')).textContent = data; } else toast('Seu navegador bloqueou a exportação. Tente pelo computador.'); } };
    $('clear-data').onclick = function () { if (busy) { toast('Aguarde a resposta antes de apagar os dados.'); return; } if (!window.confirm('Apagar todo o histórico, assuntos e memórias' + ' do seu núcleo no Supabase' + '? Essa ação não pode ser desfeita.')) return; window.AguirraVoice.clearCache(); request('DELETE', '/api/data', null, function (err) { if (err) toast(err.message); else { loadData(); toast('Histórico e núcleo apagados da sua conta.'); } }); };
    $('fullscreen-button').onclick = function () { var root = document.documentElement, enter = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen; var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen; if (document.fullscreenElement || document.webkitFullscreenElement) { if (exit) exit.call(document); } else if (enter) { var p = enter.call(root); if (p && p.catch) p.catch(function () { toast('O navegador não permitiu a tela cheia.'); }); } else toast('Este navegador não oferece tela cheia.'); };
    document.addEventListener('visibilitychange', function () { if (document.hidden) window.AguirraMicrophone.cancel(); else if (sessionReady && !busy && Date.now() - lastDataSync > 60000) loadData(); updateOrbState(); });
    document.addEventListener('keydown', function (event) { if (event.keyCode === 27) { closeModal('auth-modal'); closeModal('memory-modal'); } var modal = !$('auth-modal').hidden ? $('auth-modal') : (!$('memory-modal').hidden ? $('memory-modal') : null); if (event.keyCode !== 9 || !modal) return; var all = modal.querySelectorAll('button,input,textarea,select'), nodes = [], k; for (k = 0; k < all.length; k++) if (!all[k].hidden && all[k].offsetWidth > 0) nodes.push(all[k]); if (!nodes.length) return; if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); } });
  }
  function setStatus(text) { wipe($('connection-status')); $('connection-status').appendChild(el('i')); $('connection-status').appendChild(document.createTextNode(text)); }

  window.AguirraVoice.configure({ voice: preferences.voice_name,
    onStatus: function (text) { $('voice-status').textContent = text; },
    onNotice: function (text) { $('voice-status').textContent = text; $('voice-hint').textContent = text + (lastReply ? ' A resposta está no Histórico.' : ''); $('voice-hint').hidden = false; },
    onState: function (value) { voiceActive = value === 'speaking'; voiceLoading = value === 'loading'; updateOrbState(); if (!voiceActive) hideCaption(); },
    onCaption: function (text) { if (voiceActive) { $('orb-subtitle').textContent = text; $('orb-subtitle').hidden = false; } }, onPulse: function () { orbPulse = 1; }
  });
  var mapResize;
  if (window.addEventListener) window.addEventListener('resize', function () {
    startOrb();
    if (activeView === 'brain') {
      clearTimeout(mapResize);
      mapResize = setTimeout(function () { if (activeView === 'brain') renderQuestionMap(); }, 130);
    }
  });
  window.AguirraWake.configure({
    onCommand: function (text) { send(text); },
    onStatus: function (text, enabled) {
      $('wake-button').textContent = enabled ? 'Desativar escuta' : 'Ativar por voz';
      $('wake-button').setAttribute('aria-pressed', String(enabled));
      $('wake-status').textContent = text;
      $('wake-status').hidden = text === 'Ativar por voz';
    }
  });
  $('wake-button').onclick = function () {
    if (!sessionReady || busy || voiceActive || voiceLoading || listening || micProcessing) { toast('Aguarde o assistente ficar disponível.'); return; }
    window.AguirraVoice.prime(); window.AguirraWake.toggle();
  };
  bind(); setupVoice(); tick(); setInterval(tick, 15000); render(); startOrb();
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = populateVoices;
  if (/[?&]auth=google-failed(?:&|$)/.test(window.location.search)) { toast('Não foi possível concluir a entrada com Google. Tente novamente.'); if (window.history && window.history.replaceState) window.history.replaceState(null, '', '/'); }
  $('voice-status').textContent = 'Escolha ElevenLabs para a voz natural ou uma voz do aparelho como alternativa.';
  request('GET', '/api/session', null, function (err, data) { if (err) { setStatus('Sem conexão'); $('server-capabilities').textContent = 'Reconecte para acessar seu núcleo no Supabase.'; return; } visitorAvailable = !!data.visitor_available; user = data.user || null; localApi = !!data.local; voiceServer = !!data.tts_server; elevenReady = !!data.elevenlabs_ready; window.AguirraMicrophone.setServer(!!data.transcription_ready); $('elevenlabs-status').textContent = elevenReady ? 'ElevenLabs disponível. A geração só é liberada no plano Free, sem excedentes.' : 'ElevenLabs aguarda a chave no servidor. Até lá, a voz do aparelho é usada como alternativa.'; googleLoginReady = !!data.google_login; setStatus(user ? (localApi ? 'Computador conectado' : 'Conta conectada') : 'Núcleo na nuvem'); $('server-capabilities').textContent = 'Perguntas sem conta. ' + (data.google_ready ? 'Conversa com Gemini gratuito. Fontes públicas por Wikipedia e notícias RSS. A pesquisa integrada do Google está desativada.' : (localApi ? 'IA local com Ollama. ' : 'Conversa gratuita ainda indisponível. ') + 'Manchetes disponíveis por RSS; isso não é uma pesquisa completa na web.'); loadData(function(error){sessionReady=!error; updateOrbState(); if(!error && !user && (readJSON(storageKey,empty()).messages.length || readJSON(storageKey,empty()).memories.length)) importPrevious();}); });
}());
