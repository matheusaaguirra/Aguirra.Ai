(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AguirraMemory = factory();
}(this, function () {
  'use strict';
  var categories = { profile: 'Sobre você', preferences: 'Preferências', goals: 'Objetivos', projects: 'Projetos', notes: 'Anotações' };
  function normalize(s) { return String(s || '').toLowerCase().replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòõôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c'); }
  function sensitive(s) { return /\b(senha|password|token|api.?key|segredo|cpf|rg|cartao|diagnostico|doenca|medicamento|sexual|religiao|orientacao|saude|endereco)\b/.test(normalize(s)) || /\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/.test(s) || /\b\d{13,19}\b/.test(s) || /\b(?:sk-|sb_secret_)[a-zA-Z0-9_-]{12,}/.test(s); }
  function redact(s) { return String(s).replace(/\b(senha|password|token|api[_ -]?key)\s*(?:e|é|:|=)\s*[^\s,;]+/gi, '$1: [oculto]').replace(/\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/g, '[documento oculto]').replace(/\b(?:sk-|sb_secret_)[a-zA-Z0-9_-]{12,}/g, '[credencial oculta]'); }
  function extract(text) {
    if (sensitive(text) || /\?|\b(se eu|imagine|suponha|exemplo|hipotetic|ele disse|ela disse)\b/i.test(text)) return [];
    var patterns = [
      { re: /^(?:meu nome (?:é|e)|me chamo)\s+(.{2,90})[.!]?$/i, category: 'profile', key: 'name', prefix: 'Nome: ' },
      { re: /^(?:eu )?prefiro\s+(.{3,300})[.!]?$/i, category: 'preferences', key: null, prefix: 'Prefere ' },
      { re: /^(?:meu objetivo (?:é|e)|minha meta (?:é|e))\s+(.{3,300})[.!]?$/i, category: 'goals', key: null, prefix: 'Objetivo: ' },
      { re: /^(?:estou desenvolvendo|meu projeto (?:é|e))\s+(.{3,300})[.!]?$/i, category: 'projects', key: null, prefix: 'Projeto: ' },
      { re: /^(?:lembre(?:-se)? (?:de )?que|guarde(?: que)?|memorize(?: que)?)\s+(.{3,400})[.!]?$/i, category: 'notes', key: null, prefix: '' }
    ];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i], match = String(text).trim().match(p.re);
      if (match) { var value = p.prefix + match[1].replace(/[.!]+$/, '').trim(); return [{ category: p.category, key: p.key || normalize(value).slice(0, 100), content: value, origin: 'declared' }]; }
    }
    return [];
  }
  function topics(text) {
    var s = normalize(text), result = [];
    var rules = [['Tecnologia', /\b(ia|inteligencia artificial|tecnologia|computador|android|tablet)\b/], ['Desenvolvimento', /\b(codigo|programacao|angular|typescript|javascript|python|software|github|api)\b/], ['Notícias', /\b(noticia|noticias|acontecendo|acontecimentos|brasil|estados unidos|mundo)\b/], ['Projetos', /\b(projeto|wealthos|zyntracare|aguirra|saas)\b/], ['Estudos', /\b(estudar|estudo|aula|faculdade|aprender|ingles|italiano)\b/], ['Finanças', /\b(financas|dinheiro|investimento|investir|gastos|salario)\b/], ['Automóveis', /\b(carro|carros|formula 1|drift|automovel)\b/]];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(s)) result.push(rules[i][0]);
    return result;
  }
  function relevant(items, query, limit) {
    var words = normalize(query).split(/\W+/).filter(function (w) { return w.length > 3; });
    return items.map(function (m) { var s = normalize(m.content), score = (m.category === 'preferences' || m.category === 'profile') ? 2 : 0; for (var i = 0; i < words.length; i++) if (s.indexOf(words[i]) !== -1) score += 3; return { item: m, score: score }; }).filter(function (m) { return m.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, limit || 8).map(function (m) { return m.item; });
  }
  function intent(message) {
  var s = normalize(message).replace(/[?!.,;:]+$/g, '').trim();
  if (/^(?:que horas sao(?: agora)?|que dia e hoje|qual (?:e )?a data(?: de hoje)?|data de hoje|hora atual|qual (?:e )?o dia de hoje)$/.test(s)) return 'clock';
  if (/^(?:o que (?:voce )?(?:lembra|sabe) (?:de|sobre) mim|(?:mostre|mostrar|liste|listar)(?: as)? minhas memorias|minhas memorias|o que (?:voce )?lembra|o que (?:voce )?guardou (?:de|sobre) mim)$/.test(s)) return 'memory';
  if (/^(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu)(?: aguirra)?$/.test(s)) return 'greeting';
  if (/\b(?:noticias|noticia|manchetes|manchete)\b/.test(s) || /\b(?:o que|oque) (?:esta |ta |anda )?acontecendo\b/.test(s) || /^o que acontece (?:no|na|nos|nas|em)\b/.test(s)) return 'news';
  return 'question';
  }
  return { intent: intent, categories: categories, normalize: normalize, sensitive: sensitive, redact: redact, extract: extract, topics: topics, relevant: relevant };
}));
