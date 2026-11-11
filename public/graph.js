(function (root) {
  'use strict';
  var A = root.AguirraAnswers, M = root.AguirraMemory;
  var colors = { question: '#b2a1ff', answer: '#95bded', topic: '#eee7ff', note: '#83d8c6' };
  var filler = /^(?:quanto|quantos|quanta|quantas|pq|porque|porq|foi|foram|fez|ficou|aconteceu|aconteceram|acontece|acontecendo|acha|acham|acharia|acho|achou|demora|demorou|tempo|feito|feita|feitos|feitas|sendo|mesmo|mesma|mais|menos|muito|muita|coisa|coisas|algum|alguma|sobre|algo|principal|principais|diga|dizer|fale|falar|faca|cite|conta|contar|seria|queria|quero|estou|estar|estao|esta|sido|teve|ter|fica|ficam|tem|tambem|vezes|vez|com|sem|num|numa|pra|pro|hj|ela|ele|eles|elas|seu|sua|era|eram|entao|qualquer|pelo|pela|meus|minhas|dele|dela|uma|dessa|desse|prefiro|prefere|gosto|quais|maior|menor|melhor|piores?|exemplos?|diferenca|diferencas|preciso|resposta|pergunta|aqui|ali|houve|pessoa|lugar)$/;
  var months = 'janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ');
  var opName = { '+': 'adição', '-': 'subtração', '*': 'multiplicação', '/': 'divisão' };
  var opSign = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  function short(text, limit) { return text.length <= limit ? text : text.slice(0, limit - 1) + '…'; }
  function describe(text) {
    var s = M.normalize(text).replace(/\bmemoria (?:ram|de acesso aleatorio)\b/g, 'ram')
      .replace(/\bcpu\b/g, 'processador').replace(/\binteligencia artificial\b/g, 'ia');
    var terms = A.words(s).filter(function (t) {
      return !filler.test(t) && !/^\d+$/.test(t) && (t.length > 2 || t === 'ia');
    }).slice(0, 18);
    var info = { group: '', terms: terms, key: '', display: '', operation: '', normalized: s.replace(/[^a-z0-9+*/×÷-]+/g, ' ').trim() };
    var date = /\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?\b/.exec(s);
    if (date && months.indexOf(date[2]) >= 0 && +date[1] >= 1 && +date[1] <= 31) {
      info.group = 'Datas e eventos'; info.display = Number(date[1]) + ' de ' + date[2];
      info.key = 'date/' + info.display; info.year = date[3] || '';
      return info;
    }
    var math = s.replace(/(\d)\s*(?:vezes|multiplicado por|x|×)\s*(?=\d)/g, '$1*')
      .replace(/\bmais\b/g, '+').replace(/\bmenos\b/g, '-').replace(/\bdividido por\b|÷/g, '/').replace(/−/g, '-');
    var expression = /(?:^|[^a-z0-9.+*/-])(-?\d+(?:[,.]\d+)?(?:\s*[+*/-]\s*\d+(?:[,.]\d+)?)+)\b/.exec(math);
    if (expression && !/\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/.test(math)) {
      var formula = expression[1].replace(/\s/g, '').replace(/,/g, '.');
      var operators = formula.replace(/^-/, '').match(/[+*/-]/g);
      info.group = 'Matemática'; info.key = 'expr/' + formula;
      info.operation = operators.length === 1 ? opName[operators[0]] : '';
      info.display = formula.replace(/[+*/-]/g, function (op, at) { return at === 0 ? '−' : ' ' + opSign[op] + ' '; });
      return info;
    }
    var identity = M.identityAnswer(text);
    if (identity) { info.group = 'Aguirra'; info.key = 'identity/' + identity; info.display = 'Identidade do Aguirra'; }
    else if (M.intent(text) === 'greeting') info.group = 'Aguirra';
    else if (M.intent(text) === 'clock') info.group = 'Data e hora';
    else if (/\b(ram|rom|gpu|hardware|processador|computador|ssd)\b/.test(s)) info.group = 'Hardware';
    else if (/\btitanic\b/.test(s)) info.group = 'Titanic';
    else if (M.intent(text) === 'news') info.group = 'Notícias';
    else {
      var topics = M.topics(text);
      if (topics.length) info.group = topics[0];
      else if (terms.length === 1 && terms[0].length >= 3) {
        // Keep the user's spelling, including accents, when the subject is unambiguous.
        var original = (String(text).match(/[A-Za-zÀ-ÿ0-9]+/g) || []).filter(function (w) { return M.normalize(w) === terms[0]; })[0] || terms[0];
        info.group = original.charAt(0).toUpperCase() + original.slice(1).toLowerCase();
      }
    }
    return info;
  }

  function memoryKey(pair) {
    var a = pair.answer;
    return a && !a.failed && a.content ? 'm/' + (A.signature(pair.question.content) || M.normalize(pair.question.content)) + '/' + a.content : null;
  }
  function memoryCount(pairs) {
    var known = Object.create(null), count = 0;
    pairs.forEach(function (p) { var key = memoryKey(p); if (key && !known[key]) { known[key] = true; count++; } });
    return count;
  }
  function match(a, b) {
    if (a.year && b.year && a.year !== b.year) return null;
    if (a.key && a.key === b.key) {
      var prefix = a.group === 'Matemática' ? 'Mesma expressão · ' : a.group === 'Datas e eventos' ? 'Mesma data · ' : '';
      return { score: 10, reason: prefix + a.display };
    }
    if (a.normalized && a.normalized === b.normalized) return { score: 9, reason: 'Mesmo texto' };
    if (a.operation && a.operation === b.operation) return { score: 3, reason: 'Mesma operação · ' + a.operation };
    if (a.key || b.key) return null;
    var shared = a.terms.filter(function (t) { return b.terms.indexOf(t) !== -1; });
    var overlap = shared.length / Math.max(1, Math.min(a.terms.length, b.terms.length));
    if (!shared.length || (shared.length === 1 && overlap < .5 && !/^(ram|titanic|aguirra|gpu|ssd)$/.test(shared[0])) || (shared.length === 1 && /^(noticias?|dia|hora|datas?|mundo|projetos?|estud[oa]s?|hoje)$/.test(shared[0]))) return null;
    return { score: 4 + overlap + Math.min(3, shared.length), reason: 'Em comum · ' + shared.slice(0, 3).join(', ') };
  }
  function relations(pairs, notes) {
    var byId = Object.create(null), edges = [], known = Object.create(null), buckets = Object.create(null), candidates = [];
    function add(id, record, text) { byId[id] = { id: id, record: record, info: describe(text), links: [], inferred: 0 }; }
    pairs.forEach(function (p) { add('q/' + p.question.id, p, p.question.content); });
    notes.forEach(function (n) { add('n/' + n.id, n, n.content); });
    function link(a, b, type, reason) {
      if (!a || !b || a === b || !byId[a] || !byId[b]) return false;
      var key = a < b ? a + '|' + b : b + '|' + a;
      if (known[key]) return false;
      known[key] = true;
      edges.push({ from: a, to: b, type: type, reason: reason });
      byId[a].links.push({ id: b, reason: reason }); byId[b].links.push({ id: a, reason: reason });
      return true;
    }
    pairs.forEach(function (p) {
      var from = 'q/' + p.question.id, meta = p.answer && p.answer.cache_meta;
      if (!meta) return;
      if (meta.reused_from) link(from, 'q/' + meta.reused_from, 'reuse', 'Resposta reutilizada');
      (meta.related_to || []).forEach(function (id) { link(from, 'q/' + id, 'context', 'Consultada na resposta'); });
    });
    notes.forEach(function (n) { if (n.source_message_id) link('n/' + n.id, 'q/' + n.source_message_id, 'source', 'Origem da nota'); });
    Object.keys(byId).sort().forEach(function (id) {
      var entry = byId[id], a = entry.info, prior = Object.create(null);
      var keys = a.terms.map(function (term) { return 'term/' + term; });
      if (a.key) keys.push(a.key);
      if (a.normalized) keys.push('text/' + a.normalized);
      if (a.operation) keys.push('op/' + a.operation);
      keys.forEach(function (k) {
        var bucket = buckets[k] || (buckets[k] = []);
        // Keep both the adjacent and the first occurrence of common terms. Rare terms retain all candidates.
        if (bucket.length) prior[bucket[0]] = true;
        for (var i = Math.max(0, bucket.length - 10); i < bucket.length; i++) prior[bucket[i]] = true;
        bucket.push(id);
      });
      Object.keys(prior).forEach(function (other) {
        var evidence = match(a, byId[other].info);
        if (evidence) candidates.push({ a: id, b: other, score: evidence.score, reason: evidence.reason });
      });
    });
    candidates.sort(function (a, b) { return b.score - a.score || a.a.localeCompare(b.a) || a.b.localeCompare(b.b); });
    candidates.forEach(function (c) {
      if (byId[c.a].inferred >= 3 || byId[c.b].inferred >= 3) return;
      if (link(c.a, c.b, 'similar', c.reason)) { byId[c.a].inferred++; byId[c.b].inferred++; }
    });
    return { byId: byId, edges: edges };
  }

  function network(pairs, notes, index) {
    index = index || relations(pairs, notes);
    var nodes = [], edges = [], byId = Object.create(null);
    function add(id, type, label, group) {
      if (byId[id]) return byId[id];
      var n = { id: id, type: type, label: label, group: group, radius: { topic: 11, question: 6.5, answer: 4.7, note: 6 }[type] };
      byId[id] = n; nodes.push(n); return n;
    }
    function edge(a, b, type) { if (a && b) edges.push({ a: a, b: b, type: type }); }
    function attach(n) { if (n.group) edge(n, add('t/' + n.group, 'topic', n.group, n.group), 'topic'); }
    pairs.forEach(function (p) {
      var id = 'q/' + p.question.id, info = index.byId[id].info;
      var q = add(id, 'question', p.question.content, info.group);
      q.pair = p; q.caption = info.group === 'Matemática' ? info.display : q.label;
      attach(q);
      var key = memoryKey(p);
      if (key) {
        var answer = add(key, 'answer', p.answer.content, q.group);
        if (!answer.pair) { answer.pair = p; answer.parent = q; }
        edge(q, answer, 'answer');
      }
    });
    notes.forEach(function (n) {
      var id = 'n/' + n.id, group = index.byId[id].info.group || M.categories[n.category] || 'Anotações';
      var node = add(id, 'note', n.content, group); node.note = n; attach(node);
    });
    index.edges.forEach(function (e) { edge(byId[e.from], byId[e.to], e.type); });
    return { nodes: nodes, edges: edges };
  }

  // Bisect the actual viewport by cluster size. Relax the nodes along their real edges once.
  function layout(graph, width, height) {
    var groups = [], buckets = Object.create(null);
    graph.nodes.forEach(function (n) {
      var key = n.group || '';
      if (!buckets[key]) { buckets[key] = []; groups.push(buckets[key]); }
      buckets[key].push(n);
    });
    groups.sort(function (a, b) { return b.length - a.length || a[0].group.localeCompare(b[0].group); });
    function place(items, x, y, w, h) {
      if (!items.length) return;
      if (items.length > 1) {
        var total = items.reduce(function (v, g) { return v + g.length; }, 0), cut = 1, weight = items[0].length;
        while (cut < items.length - 1 && weight + items[cut].length / 2 < total / 2) weight += items[cut++].length;
        var share = weight / total;
        if (w >= h) { place(items.slice(0, cut), x, y, w * share, h); place(items.slice(cut), x + w * share, y, w * (1 - share), h); }
        else { place(items.slice(0, cut), x, y, w, h * share); place(items.slice(cut), x, y + h * share, w, h * (1 - share)); }
        return;
      }
      var group = items[0], cx = x + w / 2, cy = y + h / 2;
      var points = group.filter(function (n) { return n.type !== 'topic' && n.type !== 'answer'; });
      var direction = 0;
      for (var k = 0; k < group[0].group.length; k++) direction = (direction * 31 + group[0].group.charCodeAt(k)) % 360;
      points.forEach(function (n, i) {
        var theta = 2.39996 * i + direction * Math.PI / 180, r = Math.sqrt((i + 1) / points.length);
        n.x = cx + Math.cos(theta) * w * .36 * r; n.y = cy + Math.sin(theta) * h * .36 * r;
      });
      group.forEach(function (n) {
        if (n.type === 'topic') { n.x = cx; n.y = cy; }
        if (n.parent) {
          var angle = Math.atan2(n.parent.y - cy, n.parent.x - cx);
          n.x = n.parent.x + 29 * Math.cos(angle); n.y = n.parent.y + 29 * Math.sin(angle);
        }
        n.homeX = n.x; n.homeY = n.y;
      });
    }
    place(groups, 30, 25, width - 60, height - 50);
    for (var pass = 0; pass < 12; pass++) {
      graph.nodes.forEach(function (n, i) {
        n.x += (n.homeX - n.x) * .12; n.y += (n.homeY - n.y) * .12;
        for (var j = 0; j < i; j++) {
          var b = graph.nodes[j], dx = n.x - b.x || .1, dy = n.y - b.y || .1;
          var min = n.radius + b.radius + 22;
          if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
          var distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < min) {
            var k = (min - distance) / distance * .50;
            n.x += dx * k; n.y += dy * k; b.x -= dx * k; b.y -= dy * k;
          }
        }
      });
      graph.edges.forEach(function (e) {
        if (e.type === 'answer' || e.type === 'topic') return;
        var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 87) { var k = (distance - 87) / distance * .025; e.a.x += dx * k; e.b.x -= dx * k; e.a.y += dy * k; e.b.y -= dy * k; }
      });
    }
    graph.nodes.forEach(function (n) { n.x = Math.max(20, Math.min(width - 20, n.x)); n.y = Math.max(22, Math.min(height - 22, n.y)); });
  }

  function svg(tag, attrs, text) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text !== undefined) el.textContent = text; return el;
  }
  var view = { zoom: 1, x: 0, y: 0, width: 900, height: 450, signature: '', labels: null };
  function frame(el) {
    var w = view.width / view.zoom, h = view.height / view.zoom;
    el.setAttribute('viewBox', [view.x - w / 2, view.y - h / 2, w, h].join(' '));
  }
  function zoom(value, el) {
    if (!value) { view.zoom = 1; view.x = view.width / 2; view.y = view.height / 2; }
    else view.zoom = Math.max(.7, Math.min(5, view.zoom * value));
    frame(el); if (view.labels) view.labels();
  }
  function draw(el, graph, select, selected, mini) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var width = mini ? 550 : el.clientWidth || 900, height = mini ? 320 : el.clientHeight || 430;
    var scale = Math.max(1, Math.sqrt(graph.nodes.length * 2350 / (width * height)));
    var w = width * scale, h = height * scale;
    layout(graph, w, h);
    if (mini) el.setAttribute('viewBox', [0, 0, w, h].join(' '));
    else {
      var signature = w + '/' + h + '/' + graph.nodes.filter(function (n) { return n.type !== 'answer'; }).map(function (n) { return n.id; }).join('|');
      if (signature !== view.signature) {
        view.width = w; view.height = h; view.x = w / 2; view.y = h / 2; view.zoom = 1; view.signature = signature;
      }
      frame(el);
    }
    var active = selected && 'q/' + selected, adjacent = Object.create(null), labels = [];
    graph.edges.forEach(function (e) {
      var hit = e.a.id === active || e.b.id === active, inferred = e.type === 'similar';
      if (hit) { adjacent[e.a.id] = true; adjacent[e.b.id] = true; }
      var structural = e.type === 'answer' || e.type === 'topic';
      el.appendChild(svg('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y,
        stroke: hit ? '#f4ecff' : structural ? '#6b6c88' : inferred ? '#b2a1ff' : '#83d8c6',
        'stroke-width': mini ? 3.5 : hit ? 2.3 : structural ? 1.2 : 1.8,
        'stroke-opacity': active && !hit ? .22 : structural && !hit ? .72 : .95,
        'stroke-dasharray': inferred ? '5 4' : 'none' }));
    });
    var priority = { topic: 0, question: 1, note: 2, answer: 3 };
    graph.nodes.slice().sort(function (a, b) {
      return Number(b.id === active) - Number(a.id === active) || priority[a.type] - priority[b.type] || Number(!!adjacent[b.id]) - Number(!!adjacent[a.id]);
    }).forEach(function (n) {
      var topic = n.type === 'topic', color = colors[n.type];
      var name = { topic: 'Assunto', answer: 'Memória de resposta', question: 'Pergunta', note: 'Nota' }[n.type] + ': ' + n.label;
      var g = svg('g', mini ? {} : { tabindex: 0, role: 'button', 'aria-label': name });
      g.appendChild(svg('circle', { cx: n.x, cy: n.y, r: n.radius * (mini ? 1.5 : 1),
        fill: topic ? '#30294f' : color, stroke: n.id === active ? '#ffffff' : topic ? color : '#191b2c', 'stroke-width': topic || n.id === active ? 2.5 : 1 }));
      if (topic) g.appendChild(svg('circle', { cx: n.x, cy: n.y, r: 3.3, fill: color }));
      if (!mini) {
        g.appendChild(svg('circle', { cx: n.x, cy: n.y, r: Math.max(14, n.radius + 5), fill: 'none', 'pointer-events': 'all' }));
        g.appendChild(svg('title', {}, name));
        var caption = short(n.caption || n.label, topic ? 24 : 26);
        var label = svg('text', { fill: topic ? '#f5f2ff' : '#d4d5ec', 'font-family': 'Roboto, Arial, sans-serif', 'font-weight': topic ? '600' : '400', 'pointer-events': 'none' }, caption);
        g.appendChild(label); labels.push({ n: n, label: label, caption: caption });
        g.onclick = function () { select(n); };
        g.onkeydown = function (event) { if (event.keyCode === 13 || event.keyCode === 32) { event.preventDefault(); select(n); } };
      }
      el.appendChild(g);
    });
    if (mini) return;
    view.labels = function () {
      var unit = scale / view.zoom, boxes = graph.nodes.map(function (n) {
        return { x: n.x - n.radius, y: n.y - n.radius, w: n.radius * 2, h: n.radius * 2, hard: n.type === 'topic' };
      });
      labels.forEach(function (item) {
        var n = item.n, topic = n.type === 'topic', font = (topic ? (el.clientWidth && el.clientWidth < 480 ? 13.5 : 15) : 12.5) * unit, label = item.label;
        label.setAttribute('display', 'none');
        if (n.type === 'answer' && !adjacent[n.id] && view.zoom < 1.8) return;
        var width = item.caption.length * font * .58, boxH = font * 1.3, gap = 5 * unit + n.radius;
        var options = [[n.x + gap, n.y - boxH / 2], [n.x - gap - width, n.y - boxH / 2], [n.x - width / 2, n.y - gap - boxH], [n.x - width / 2, n.y + gap], [n.x + gap, n.y - gap - boxH], [n.x - gap - width, n.y + gap]];
        if (topic) {
          [-1, 1].forEach(function (direction) {
            for (var step = 1; step <= 3; step++) {
              var y = direction < 0 ? n.y - gap - boxH - step * font * .5 : n.y + gap + step * font * .5;
              [0, .25, .5, .75, 1].forEach(function (offset) { options.push([n.x - width * offset, y]); });
            }
          });
        }
        var best = null, bestCost = Infinity;
        for (var i = 0; i < options.length; i++) {
          var x = options[i][0], y = options[i][1];
          if (x < 2 || x + width > w - 2 || y < 2 || y + boxH > h - 2) continue;
          var cost = 0;
          for (var j = 0; j < boxes.length; j++) {
            var b = boxes[j], overlapX = Math.min(x + width, b.x + b.w) - Math.max(x, b.x);
            var overlapY = Math.min(y + boxH, b.y + b.h) - Math.max(y, b.y);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (b.hard || !topic) { cost = Infinity; break; }
            cost += overlapX * overlapY;
          }
          if (cost < bestCost) { best = options[i]; bestCost = cost; }
          if (cost === 0) break;
        }
        if (best) {
          label.setAttribute('font-size', font); label.setAttribute('x', best[0]); label.setAttribute('y', best[1] + font);
          label.setAttribute('display', 'inline'); boxes.push({ x: best[0], y: best[1], w: width, h: boxH, hard: true });
        }
      });
    };
    view.labels();
    var start;
    function begin(e) {
      if (e.target !== el && e.target.tagName !== 'line') return;
      var p = e.touches ? e.touches[0] : e;
      start = { x: p.clientX, y: p.clientY, cx: view.x, cy: view.y };
    }
    function move(e) {
      if (!start) return;
      var p = e.touches ? e.touches[0] : e, ratio = w / view.zoom / width;
      view.x = start.cx - (p.clientX - start.x) * ratio; view.y = start.cy - (p.clientY - start.y) * ratio;
      frame(el); if (e.cancelable) e.preventDefault();
    }
    function end() { start = null; }
    el.onmousedown = el.ontouchstart = begin; el.onmousemove = el.ontouchmove = move;
    el.onmouseup = el.onmouseleave = el.ontouchend = el.ontouchcancel = end;
  }
  root.AguirraGraph = { network: network, draw: draw, zoom: zoom, relations: relations, describe: describe, memoryCount: memoryCount };
}(this));
