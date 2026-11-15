(function (root) {
  'use strict';
  var tokenKey = 'aguirra.desktop.token';
  var endpoint = 'http://127.0.0.1:3847';
  var rules = [
    { action: 'whatsapp', pattern: /\b(?:whatsapp|zap|wpp)\b/ },
    { action: 'calculator', pattern: /\b(?:calculadora|calc)\b/ },
    { action: 'notepad', pattern: /\b(?:bloco de notas|notepad)\b/ },
    { action: 'explorer', pattern: /\b(?:explorador|arquivos|explorer|pastas)\b/ },
    { action: 'youtube', pattern: /\b(?:youtube)\b/ },
    { action: 'spotify', pattern: /\b(?:spotify)\b/ },
    { action: 'discord', pattern: /\b(?:discord)\b/ },
    { action: 'vscode', pattern: /\b(?:vs ?code|visual studio code)\b/ },
    { action: 'settings', pattern: /\b(?:configuracoes do windows|configuracoes|ajustes do pc)\b/ },
    { action: 'browser', pattern: /\b(?:navegador|chrome|browser)\b/ }
  ];

  function normalize(text) {
    var s = String(text || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function matchCommand(text) {
    var clean = normalize(text);
    if (!clean) return null;
    if (/^(?:o que e|oque e|quem|como|por que|porque|quando|onde|qual)\b/.test(clean)) return null;
    if (!/\b(?:abrir|abre|abra|iniciar|inicia|rodar|roda|executar|executa|acessar|acessa)\b/.test(clean)) return null;
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].pattern.test(clean)) return rules[i].action;
    }
    return null;
  }

  function getToken() {
    try { return root.localStorage ? (root.localStorage.getItem(tokenKey) || '') : ''; }
    catch (e) { return ''; }
  }

  function setToken(value) {
    var clean = String(value || '').trim();
    try {
      if (!root.localStorage) return;
      if (clean) root.localStorage.setItem(tokenKey, clean);
      else root.localStorage.removeItem(tokenKey);
    } catch (e) {}
  }

  function call(method, path, body, callback) {
    var token = getToken();
    if (!root.XMLHttpRequest) { callback({ message: 'Navegador sem suporte a conexão local.' }); return; }
    var xhr = new root.XMLHttpRequest(), finished = false;
    function done(err, data) { if (finished) return; finished = true; callback(err, data); }
    xhr.open(method, endpoint + path, true);
    xhr.timeout = 4000;
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('X-Aguirra-Token', token);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; }
      if (xhr.status >= 200 && xhr.status < 300) done(null, data);
      else done({ status: xhr.status, message: data.error || 'O Aguirra Desktop não respondeu.' }, data);
    };
    xhr.onerror = function () { done({ message: 'Aguirra Desktop não está rodando neste PC.' }); };
    xhr.ontimeout = function () { done({ message: 'Tempo esgotado ao conectar ao Aguirra Desktop.' }); };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function ping(callback) {
    call('GET', '/health', null, function (err, data) {
      if (err) { callback(err, null); return; }
      callback(null, data);
    });
  }

  function execute(action, callback) {
    if (!getToken()) { callback({ status: 401, message: 'Configure o Código do PC em Configurações para abrir programas.' }); return; }
    call('POST', '/execute', { action: action }, callback);
  }

  root.AguirraDesktop = {
    matchCommand: matchCommand,
    getToken: getToken,
    setToken: setToken,
    ping: ping,
    execute: execute
  };
}(this));
