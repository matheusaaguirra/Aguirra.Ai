(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AguirraAnswers = factory();
}(this, function () {
  'use strict';
  var VERSION = 1, TTL = 7 * 86400000;
  function normalize(s) { return String(s || '').toLowerCase().replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòõôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/\s+/g, ' ').trim(); }
  function signature(question) {
    var s = normalize(question).replace(/[?!.,;:]+$/g, '').replace(/^aguirra[, ]+/, '').replace(/^(?:por favor[, ]+|(?:voce )?pode(?:ria)? (?:me )?)/, '').replace(/[, ]+por favor$/, '');
    if (s.length < 3 || s.length > 600 || /\b(versao|versoes|novo|nova|semana|mes|ano|hoje|hj|agora|amanha|ontem|atual|atualmente|ultim[oa]s?|noticias?|manchetes?|acontecendo|clima|tempo|precos?|cotacao|cambio|dolar|valor|custo|custa|custam|vale|valem|taxa|salario|placar|presidente|governador|eleicoes|resultado|ao vivo|proxima|proximo|recente|data|horas?|minutos?|segundos?|eu|meu|minha|meus|minhas|mim|nosso|nossa|isso|isto|essa|esse|esses|essas|aquilo|anterior|senha|password|token|chave|cpf|cartao|saude|medicamento|dose|investir|investimento|juridic[oa]|lei|leis|voce)\b/.test(s)) return null;
    if (/\b(?:sk-|sb_secret_|AIza)[a-zA-Z0-9_-]+/.test(question) || /\b\d{11,}\b/.test(s)) return null;
    var kind = 'exact', topic = s, match;
    if ((match = /^(?:o que (?:e|seria|sao|significa)|qual (?:e )?(?:a )?definicao d[eo]|(?:me )?expli(?:que|car)(?: o que (?:e|sao))?|(?:me )?explica(?: o que (?:e|sao))?|defina)\s+(.+)$/.exec(s))) { kind = 'definition'; topic = match[1]; }
    else if ((match = /^(?:para que (?:serve|servem)|qual (?:e )?(?:a )?(?:funcao|utilidade|finalidade) d[eo])\s+(.+)$/.exec(s))) { kind = 'purpose'; topic = match[1]; }
    else if (!/^(?:como|por que|porque|qual|quais|quanto|quem|quando|onde|o que|para que|descreva|compare)\b/.test(s)) return null;
    topic = topic.replace(/\bmemoria (?:de acesso aleatorio|ram)\b/g, 'ram').replace(/\binteligencia artificial\b/g, 'ia').replace(/\bcpu\b/g, 'processador');
    // Keep all topic qualifiers, numbers, negation and order. Similar means a safe rephrasing, not a loose keyword match.
    if (kind !== 'exact') topic = topic.replace(/^(?:o|a|os|as|um|uma) /, '');
    return kind + ':' + topic;
  }
  function words(question) {
    var text = normalize(question).replace(/\bmemoria (?:ram|de acesso aleatorio)\b/g, 'ram').replace(/\binteligencia artificial\b/g,'ia');
    var stop = /^(o|a|as|os|um|uma|de|da|do|das|dos|em|no|na|nos|nas|e|ou|por|que|qual|quais|quem|como|quando|onde|para|sobre|me|se|voce|vc|eu|meu|minha|tem|ser|sao|pode|favor|aguirra|explique|explicar|explica|significa|definicao|gostaria|saber|funciona|serve|fazer|isso)$/;
    var unique = [];
    (text.match(/[a-z0-9]+/g) || []).forEach(function (word) {
      if (word.length > 1 && !stop.test(word) && unique.indexOf(word) < 0) unique.push(word);
    });
    return unique;
  }
  function related(question, messages, memories, enabled) {
    if (enabled === false || !signature(question)) return [];
    var terms = words(question), context = contextKey(memories, enabled), now = Date.now(), seen = {};
    return pairs(messages).map(function (p) {
      var a = p.answer, m = a && a.cache_meta;
      if (!m || a.failed || a.exclude_context || p.question.exclude_context || m.version !== VERSION || m.context !== context || !(m.expires_at > now && m.generated_at <= now && m.expires_at-m.generated_at <= TTL)) return null;
      var other = words(p.question.content), common = terms.filter(function (w) { return other.indexOf(w) >= 0; }).length;
      if (!common || common / Math.max(terms.length, other.length, 1) < 0.5) return null;
      return {id:p.question.id, question:p.question.content, answer:a.content.slice(0,1000), score:common / (terms.length + other.length - common)};
    }).filter(Boolean).sort(function (a,b) { return b.score-a.score; }).filter(function (p) {
      if (seen[p.answer]) return false;
      seen[p.answer] = true; return true;
    }).slice(0,3);
  }
  function contextKey(memories, enabled) {
    var items = (enabled === false ? [] : memories || []).map(function (m) { return JSON.stringify([m.category, m.content]); }).sort();
    var raw = JSON.stringify([VERSION, enabled !== false, items]), a = 2166136261, b = 5381;
    for (var i = 0; i < raw.length; i++) { a ^= raw.charCodeAt(i); a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24); b = ((b << 5) + b) ^ raw.charCodeAt(i); }
    return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16) + ':' + raw.length;
  }
  function makeMeta(question, reply, mode, memories, enabled, now) {
    var key = signature(question); now = now || Date.now();
    if (!key || enabled === false || ['google_ai', 'public_sources', 'local'].indexOf(mode) < 0 || !reply || /(?:nao (?:sei|consigo|tenho)|cota gratuita|indisponivel|tente novamente)/.test(normalize(reply))) return null;
    return { version: VERSION, key: key, context: contextKey(memories, enabled), expires_at: now + TTL, generated_at: now };
  }
  function pairs(messages) {
    var byId = {}, result = [], list = messages || [];
    for (var i = 0; i < list.length; i++) byId[list[i].id] = list[i];
    for (i = 0; i < list.length; i++) {
      var q = list[i]; if (q.role !== 'user') continue;
      var a = q.reply_id ? byId[q.reply_id] : null;
      if (!a) for (var j = i + 1; j < list.length; j++) { if (list[j].thread_id !== q.thread_id) continue; if (list[j].role === 'user') break; if (list[j].role === 'assistant') { a = list[j]; break; } }
      result.push({ question: q, answer: a });
    }
    return result;
  }
  function find(question, messages, memories, enabled, now) {
    var key = signature(question); if (!key || enabled === false) return null;
    var list = pairs(messages), context = contextKey(memories, enabled); now = now || Date.now();
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i], a = p.answer, meta = a && a.cache_meta;
      if (!a || a.role !== 'assistant' || a.failed || a.exclude_context || p.question.failed || p.question.exclude_context || signature(p.question.content) !== key || !meta || meta.version !== VERSION || meta.key !== key || meta.context !== context || typeof meta.expires_at !== 'number' || typeof meta.generated_at !== 'number' || !isFinite(meta.expires_at) || !isFinite(meta.generated_at) || meta.expires_at <= now || meta.generated_at > now || meta.expires_at - meta.generated_at > TTL || !a.content) continue;
      return { question: p.question, answer: a, exact: normalize(question) === normalize(p.question.content) };
    }
    return null;
  }
  return { words: words, related: related, signature: signature, contextKey: contextKey, makeMeta: makeMeta, pairs: pairs, find: find, ttl: TTL };
}));
