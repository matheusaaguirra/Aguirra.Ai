(function (root) {
  'use strict';
  var A = root.AguirraAnswers, M = root.AguirraMemory;
  var hues = ['#bb98fa','#6dcbbb','#ecc379','#92b6ed','#e39ec0','#b4cc89'];
  function title(text, n) { return text.length > n ? text.slice(0,n-1) + '…' : text; }
  function subject(q) {
    var s = M.normalize(q);
    if (/\b(ram|rom|cpu|gpu|hardware|processador|computador|memoria ram)\b/.test(s)) return 'Hardware';
    if (M.identityAnswer(q) || M.intent(q) === 'greeting') return 'Aguirra';
    if (M.intent(q) === 'clock') return 'Data e hora';
    var topics = M.topics(q);
    if (topics.length) return topics[0];
    var words = A.words(q);
    if (!words.length) return 'Outras perguntas';
    return words[0].charAt(0).toUpperCase()+words[0].slice(1);
  }
  function memoryKey(pair) {
    var a = pair.answer;
    return a && !a.failed && a.content ? 'm/'+(A.signature(pair.question.content) || M.normalize(pair.question.content))+'/'+a.content : null;
  }
  function memoryCount(pairs) {
    var known = Object.create(null), count=0;
    pairs.forEach(function (p) { var key=memoryKey(p); if(key && !known[key]) { known[key]=true; count++; } });
    return count;
  }
  function network(pairs, notes) {
    var nodes=[], edges=[], hubs=Object.create(null), byId=Object.create(null), groups=[];
    function add(id,type,label,group,pair) {
      if (byId[id]) return byId[id];
      var n={id:id,type:type,label:label,group:group,pair:pair};
      byId[id]=n; nodes.push(n); return n;
    }
    function hub(name) {
      if (!hubs[name]) { hubs[name]=add('t/'+name,'topic',name,name,null); groups.push(name); }
      return hubs[name];
    }
    function edge(a,b,type) { if (a && b && a!==b) edges.push({a:a,b:b,type:type}); }
    pairs.forEach(function (pair) {
      var q=pair.question, group=subject(q.content), h=hub(group), point=add('q/'+q.id,'question',q.content,group,pair);
      var key=memoryKey(pair);
      if (key) {
        var fresh=!byId[key], mem=add(key,'answer',title(pair.answer.content,42),group,pair);
        edge(point,mem,'answer'); if(fresh) edge(mem,h,'topic');
      } else edge(point,h,'topic');
    });
    pairs.forEach(function (pair) {
      var meta=pair.answer && pair.answer.cache_meta;
      if(meta) {
        edge(byId['q/'+pair.question.id],byId['q/'+meta.reused_from],'reuse');
        (meta.related_to || []).forEach(function(id){edge(byId['q/'+pair.question.id],byId['q/'+id],'context');});
      }
    });
    notes.forEach(function (note) {
      var h=hub(M.categories[note.category] || 'Anotações'), n=add('n/'+note.id,'note',note.content,h.group,null);
      n.note=note; edge(n,byId['q/'+note.source_message_id] || h,'topic');
    });
    groups.sort();
    groups.forEach(function (name,k) {
      var angle=k*2*Math.PI/groups.length-Math.PI/2, h=hubs[name];
      var spread=groups.length===1 ? 0 : 1;
      h.x=500+315*spread*Math.cos(angle); h.y=325+190*spread*Math.sin(angle);
      h.color=hues[k%hues.length]; h.radius=13;
      var satellites=nodes.filter(function(n){return n.group===name && n!==h;});
      satellites.forEach(function(n,i){
        var angle=i*2.39996+k*.67, radius=(groups.length===1 ? 60 : 29)+Math.sqrt(i+1)*(groups.length===1 ? 33 : 21);
        n.x=h.x+Math.cos(angle)*radius; n.y=h.y+Math.sin(angle)*radius*.78;
        n.radius=n.type==='answer'?7:4.7; n.color=n.type==='answer'?'#edbf86':n.type==='note'?'#80cfbe':'#bc9bdf';
      });
    });
    // Resolve collisions once per render. There is no continuous simulation on the tablet.
    for(var pass=0;pass<14;pass++) {
      nodes.forEach(function(a,i) {
        for(var j=0;j<i;j++){
          var b=nodes[j],dx=a.x-b.x||0.1,dy=a.y-b.y||0.1,dist=Math.sqrt(dx*dx+dy*dy),gap=a.radius+b.radius+19-dist;
          if(gap>0){var x=dx/dist*gap*.5,y=dy/dist*gap*.5;a.x+=x;a.y+=y;b.x-=x;b.y-=y;}
        }
        a.x=Math.min(955,Math.max(45,a.x)); a.y=Math.min(600,Math.max(36,a.y));
      });
    }
    return {nodes:nodes,edges:edges};
  }
  function svg(tag, attrs, text){
    var el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.keys(attrs).forEach(function(k){el.setAttribute(k,attrs[k]);});
    if(text!==undefined) el.textContent=text; return el;
  }
  var view={zoom:1,x:500,y:325,width:1000,homeX:500,homeY:325};
  function bounds(nodes) {
    if(!nodes.length) return {x:500,y:325,width:1000};
    var xs=nodes.map(function(n){return n.x;}), ys=nodes.map(function(n){return n.y;});
    var left=Math.min.apply(null,xs)-65, right=Math.max.apply(null,xs)+150;
    var top=Math.min.apply(null,ys)-50, bottom=Math.max.apply(null,ys)+50;
    return {x:(left+right)/2,y:(top+bottom)/2,width:Math.max(405,right-left,(bottom-top)/.65)};
  }
  function frame(el){var w=view.width/view.zoom,h=.65*w;el.setAttribute('viewBox',[view.x-w/2,view.y-h/2,w,h].join(' '));}
  function zoom(value,el){ if(value===0) {view.zoom=1;view.x=view.homeX;view.y=view.homeY;} else view.zoom=Math.max(.7,Math.min(4,view.zoom*value));frame(el); }
  function draw(el,graph,select,selected,mini) {
    while(el.firstChild) el.removeChild(el.firstChild);
    var fit=bounds(graph.nodes);
    if(mini) el.setAttribute('viewBox',[fit.x-fit.width/2,fit.y-fit.width*.325,fit.width,fit.width*.65].join(' '));
    else {
      if(view.homeX!==fit.x || view.homeY!==fit.y || view.width!==fit.width) {
        view.x=view.homeX=fit.x;view.y=view.homeY=fit.y;view.width=fit.width;view.zoom=1;
      }
      frame(el);
      if(!graph.nodes.length) el.appendChild(svg('text',{x:500,y:325,'text-anchor':'middle',fill:'#bbaaca','font-size':17},'Sua primeira pergunta inicia o mapa.'));
    }
    graph.edges.forEach(function(e){el.appendChild(svg('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,stroke:e.type==='reuse'?'#c5a1e8':e.type==='context'?'#73a99e':'#625774','stroke-dasharray':e.type==='context'?'3 3':'none','stroke-opacity':e.type==='reuse'?0.85:0.58,'stroke-width':mini?4:e.type==='reuse'?2:1.2}));});
    var boxes=[];
    graph.nodes.slice().sort(function(a,b){return Number(b.type==='topic')-Number(a.type==='topic');}).forEach(function(n){
      var chosen=selected && n.pair && n.pair.question.id===selected;
      var g=svg('g',mini?{}:{tabindex:0,role:'button','aria-label':({topic:'Assunto',answer:'Memória de resposta',note:'Nota',question:'Pergunta'})[n.type]+': '+n.label});
      g.appendChild(svg('circle',{cx:n.x,cy:n.y,r:n.radius*(mini?1.65:1),fill:n.color,stroke:chosen?'#fff':'#261d32','stroke-width':chosen?2:1}));
      if(!mini) {
        g.appendChild(svg('circle',{cx:n.x,cy:n.y,r:15,fill:'transparent'})); g.appendChild(svg('title',{},n.label));
        var label=title(n.label,n.type==='topic'?24:27), x=n.x>800?n.x-10:n.x+10, right=n.x>800;
        var width=label.length*6.2, box={l:right?x-width:x,r:right?x:x+width,t:n.y-16,b:n.y};
        var collides=boxes.some(function(b){return box.r>b.l && box.l<b.r && box.b>b.t && box.t<b.b;});
        if(n.type==='topic'||chosen||(!collides && n.type!=='answer')) {
          g.appendChild(svg('text',{x:x,y:n.y-6,'text-anchor':right?'end':'start',fill:n.type==='topic'?n.color:'#d2c6df','font-size':n.type==='topic'?15:11,'font-family':'Arial'},label)); boxes.push(box);
        }
        g.onclick=function(){select(n);};g.onkeydown=function(e){if(e.keyCode===13 || e.keyCode===32){e.preventDefault();select(n);}};
      }
      el.appendChild(g);
    });
    if(mini) return;
    var start;
    function begin(e) {if(e.target!==el && e.target.tagName!=='line') return; var p=e.touches?e.touches[0]:e;start={x:p.clientX,y:p.clientY,cx:view.x,cy:view.y};}
    function move(e) {if(!start)return;var p=e.touches?e.touches[0]:e,scale=view.width/view.zoom/el.getBoundingClientRect().width;view.x=start.cx-(p.clientX-start.x)*scale;view.y=start.cy-(p.clientY-start.y)*scale;frame(el);if(e.cancelable)e.preventDefault();}
    function end(){start=null;}
    el.onmousedown=el.ontouchstart=begin;el.onmousemove=el.ontouchmove=move;el.onmouseup=el.onmouseleave=el.ontouchend=el.ontouchcancel=end;
  }
  root.AguirraGraph={network:network,draw:draw,zoom:zoom,subject:subject,memoryCount:memoryCount};
}(this));
