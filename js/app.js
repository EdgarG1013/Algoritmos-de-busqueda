// ---------- RNG con semilla ----------
let rnd = Math.random;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ri = (a,b)=>a+Math.floor(rnd()*(b-a+1));

// ---------- Grafo ----------
let G = null; // {names, pos, adj:{A:{B:3}}, edges:[[a,b,c]], h:{}, hs:{}}
const $ = id=>document.getElementById(id);

function generar(){
  const s = $('seed').value;
  rnd = s==='' ? Math.random : mulberry(+s);
  const n = Math.max(5,Math.min(14,+$('nN').value||9));
  const names = [...'ABCDEFGHIJKLMN'].slice(0,n);
  const pos = {};
  for(const v of names){
    let p, tries=0;
    do{ p={x:ri(50,650),y:ri(45,430)}; tries++; }
    while(tries<500 && Object.values(pos).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<110));
    pos[v]=p;
  }
  const adj={}; names.forEach(v=>adj[v]={});
  const edges=[];
  const add=(a,b)=>{ if(a===b||adj[a][b]!==undefined) return;
    const c=ri(1,15); adj[a][b]=c; adj[b][a]=c; edges.push([a,b,c]); };
  const d=(a,b)=>Math.hypot(pos[a].x-pos[b].x,pos[a].y-pos[b].y);
  // árbol de expansión: cada nodo se une al más cercano ya conectado (grafo conexo)
  for(let i=1;i<n;i++){
    const prev=names.slice(0,i).sort((a,b)=>d(names[i],a)-d(names[i],b));
    add(names[i],prev[0]);
  }
  // aristas extra entre nodos cercanos
  const extra=Math.round(n*0.6);
  for(let k=0;k<extra*4 && edges.length<n-1+extra;k++){
    const a=names[ri(0,n-1)];
    const near=names.filter(b=>b!==a).sort((x,y)=>d(a,x)-d(a,y)).slice(0,3);
    add(a,near[ri(0,near.length-1)]);
  }
  edges.sort((x,y)=>(x[0]+x[1]).localeCompare(y[0]+y[1]));
  G={names,pos,adj,edges};
  ['sI','sM'].forEach(id=>$(id).innerHTML=names.map(v=>`<option>${v}</option>`).join(''));
  $('sI').value=names[0]; $('sM').value=names[n-1];
  calcHeur(); correr();
}

function dijkstra(src){
  const dist={}; G.names.forEach(v=>dist[v]=Infinity); dist[src]=0;
  const vis=new Set();
  while(vis.size<G.names.length){
    let u=null; for(const v of G.names) if(!vis.has(v)&&(u===null||dist[v]<dist[u])) u=v;
    if(dist[u]===Infinity) break; vis.add(u);
    for(const [w,c] of Object.entries(G.adj[u])) if(dist[u]+c<dist[w]) dist[w]=dist[u]+c;
  }
  return dist;
}
function calcHeur(){
  const meta=$('sM').value;
  G.hs=dijkstra(meta);                     // costo real h*(n)
  G.h={};
  for(const v of G.names){
    // h = fracción aleatoria (50%–100%) del costo real => nunca sobreestima => admisible
    G.h[v]= v===meta ? 0 : Math.floor(G.hs[v]*(0.5+rnd()*0.5));
  }
  const ns=G.names;
  $('hTab').innerHTML=`<tr><th>Nodo</th>${ns.map(v=>`<th>${v}</th>`).join('')}</tr>
    <tr><td><b>h(n)</b></td>${ns.map(v=>`<td><b>${G.h[v]}</b></td>`).join('')}</tr>
    <tr><td style="color:var(--mut)">h*(n) real</td>${ns.map(v=>`<td style="color:var(--mut)">${G.hs[v]}</td>`).join('')}</tr>`;
  $('eTab').innerHTML=G.edges.map(([a,b,c])=>`${a} — ${b} : ${c}`).join('<br>');
}

// ---------- Algoritmos: generan una lista de "pasos" (snapshots) ----------
// Convención: test de meta al EXPANDIR el nodo; vecinos en orden alfabético.
// Nodo de búsqueda: {n, path:[...], g}
function fmt(x,alg){
  const p=x.path.join('');
  if(alg==='ucs') return `${x.n}(${p}) g=${x.g}`;
  if(alg==='greedy') return `${x.n}(${p}) h=${G.h[x.n]}`;
  if(alg==='astar') return `${x.n}(${p}) f=${x.g}+${G.h[x.n]}=${x.g+G.h[x.n]}`;
  return `${x.n}(${p})`;
}

function buscar(alg,ini,meta){
  const steps=[]; let exp=0, cre=1;
  const isStack = alg==='dfs'||alg==='dfsG';
  const graphMode = alg!=='bfs'&&alg!=='dfs';   // usan abierta/cerrada
  const prio = {ucs:x=>x.g, greedy:x=>G.h[x.n], astar:x=>x.g+G.h[x.n]}[alg];
  let fr=[{id:0,n:ini,path:[ini],g:0}];
  const T=[{id:0,n:ini,p:-1,g:0}], expIds=[], disc=[], repl=[]; let curId=null;
  const closed=[];
  const snap=(msg,cur,extra={})=>steps.push({msg,cur,fr:fr.map(x=>({...x,path:[...x.path]})),
    closed:[...closed],exp,cre,expanded:[...expandedSet],
    tn:T.length,expIds:[...expIds],frIds:fr.map(x=>x.id),curId,disc:[...disc],repl:[...repl],...extra});
  const expandedSet=[];
  snap(`Inicio: se crea el nodo inicial ${ini} y se ${isStack?'apila':'agrega a la frontera'}.`,null);
  while(fr.length){
    let x;
    if(prio){ // la abierta se escribe en orden de inserción; se saca la de menor valor (empate: alfabético)
      let bi=0; fr.forEach((y,i)=>{ if(prio(y)<prio(fr[bi])||(prio(y)===prio(fr[bi])&&y.n<fr[bi].n)) bi=i; });
      x=fr.splice(bi,1)[0];
    } else x = isStack ? fr.pop() : fr.shift();
    curId=x.id;
    if(graphMode && closed.includes(x.n)) { disc.push(x.id); snap(`${x.n} ya está en CERRADA, se descarta.`,x.n); continue; }
    if(x.n===meta){
      if(graphMode) closed.push(x.n);
      snap(`Se extrae ${fmt(x,alg)} → ¡es la META! Fin.`,x.n,{sol:x});
      steps.T=T; return steps;
    }
    exp++; expandedSet.push(x.n); expIds.push(x.id);
    if(graphMode) closed.push(x.n);
    let hijos=Object.keys(G.adj[x.n]).sort();
    const desc=[];
    const nuevos=[];
    for(const v of hijos){
      if(x.path.includes(v)){ desc.push(`${v} (ciclo)`); continue; }
      if(graphMode && closed.includes(v)){ desc.push(`${v} (cerrada)`); continue; }
      const g=x.g+G.adj[x.n][v];
      if(graphMode){
        const i=fr.findIndex(y=>y.n===v);
        if(i>=0){
          if(prio && g<fr[i].g){ repl.push(fr[i].id); fr.splice(i,1); }       // mejor camino: reemplaza
          else { desc.push(`${v} (ya en abierta)`); continue; }
        }
      }
      const id=T.length; T.push({id,n:v,p:x.id,g});
      nuevos.push({id,n:v,path:[...x.path,v],g}); cre++;
    }
    if(isStack) for(let i=nuevos.length-1;i>=0;i--) fr.push(nuevos[i]);  // A queda arriba
    else fr.push(...nuevos);
    snap(`Se expande ${fmt(x,alg)}. Hijos creados: ${nuevos.map(y=>y.n).join(', ')||'ninguno'}`+
         (desc.length?`. Omitidos: ${desc.join(', ')}`:'')+'.',x.n);
  }
  curId=null; snap('Frontera vacía: no hay solución.',null,{fail:true});
  steps.T=T; return steps;
}

// ---------- Dibujo ----------
function dibujar(st){
  const svg=$('svg'); const {pos,edges,h}=G; const meta=$('sM').value, ini=$('sI').value;
  const sol=st&&st.sol? st.sol.path:[];
  const onSol=(a,b)=>{for(let i=0;i<sol.length-1;i++) if((sol[i]===a&&sol[i+1]===b)||(sol[i]===b&&sol[i+1]===a)) return true; return false;};
  const frSet=new Set(st?st.fr.map(x=>x.n):[]);
  const expSet=new Set(st?st.expanded:[]);
  let s='';
  for(const [a,b,c] of edges){
    const A=pos[a],B=pos[b],ok=onSol(a,b);
    s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${ok?'#16a34a':'#9aa3b2'}" stroke-width="${ok?5:2}"/>`;
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    s+=`<rect x="${mx-11}" y="${my-10}" width="22" height="18" rx="4" fill="#fff" stroke="#d9dde3"/>
        <text x="${mx}" y="${my+4}" font-size="12" text-anchor="middle" fill="#374151">${c}</text>`;
  }
  for(const v of G.names){
    const p=pos[v];
    let fill='#fff';
    if(expSet.has(v)) fill='#d1d5db';
    if(frSet.has(v)) fill='#bfdbfe';
    if(sol.includes(v)) fill='#bbf7d0';
    if(st&&st.cur===v) fill='#fcd34d';
    s+=`<circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${v===meta?'#dc2626':'#1d2330'}" stroke-width="${v===meta?4:2}"/>`;
    if(v===meta) s+=`<circle cx="${p.x}" cy="${p.y}" r="27" fill="none" stroke="#dc2626" stroke-width="1.5"/>`;
    s+=`<text x="${p.x}" y="${p.y+6}" font-size="18" font-weight="bold" text-anchor="middle">${v}</text>
        <text x="${p.x}" y="${p.y+42}" font-size="11" text-anchor="middle" fill="#7c3aed">h=${h[v]}</text>`;
    if(v===ini) s+=`<text x="${p.x}" y="${p.y-30}" font-size="11" text-anchor="middle" fill="#16a34a" font-weight="bold">INICIO</text>`;
  }
  svg.innerHTML=s;
}

// ---------- Árbol de búsqueda ----------
let TP=null, treeFit=true; // posiciones del árbol completo (estables entre pasos)
function layoutArbol(T){
  const ch=T.map(()=>[]); T.forEach(t=>{ if(t.p>=0) ch[t.p].push(t.id); });
  const pos={}; let leaf=0, maxD=0;
  (function rec(id,d){
    maxD=Math.max(maxD,d);
    if(!ch[id].length){ pos[id]={x:leaf++,d}; return; }
    ch[id].forEach(c=>rec(c,d+1));
    pos[id]={x:(pos[ch[id][0]].x+pos[ch[id].at(-1)].x)/2,d};
  })(0,0);
  return {pos,w:Math.max(leaf,1),h:maxD+1};
}
function dibujarArbol(st,alg){
  const T=steps.T, DX=62, DY=78, M=35;
  const W=TP.w*DX+M*2-DX+20, H=(TP.h-1)*DY+M*2+30;
  const X=id=>M+10+TP.pos[id].x*DX, Y=id=>M+TP.pos[id].d*DY;
  const solIds=new Set(); if(st.sol){ let i=st.sol.id; while(i>=0){ solIds.add(i); i=T[i].p; } }
  const fr=new Set(st.frIds), bad=new Set([...st.disc,...st.repl]);
  let s='';
  for(let i=1;i<st.tn;i++){
    const t=T[i], ok=solIds.has(i)&&solIds.has(t.p);
    s+=`<line x1="${X(t.p)}" y1="${Y(t.p)}" x2="${X(i)}" y2="${Y(i)}" stroke="${ok?'#16a34a':'#9aa3b2'}" stroke-width="${ok?4:1.5}"/>`;
    s+=`<text x="${(X(t.p)+X(i))/2+4}" y="${(Y(t.p)+Y(i))/2}" font-size="10" fill="#6b7280">${t.g-T[t.p].g}</text>`;
  }
  for(let i=0;i<st.tn;i++){
    const t=T[i]; let fill='#fff';
    const ord=st.expIds.indexOf(i);
    if(ord>=0) fill='#d1d5db';
    if(fr.has(i)) fill='#bfdbfe';
    if(bad.has(i)) fill='#fecaca';
    if(solIds.has(i)) fill='#bbf7d0';
    if(st.curId===i) fill='#fcd34d';
    const lab = alg==='ucs'?`g=${t.g}` : alg==='greedy'?`h=${G.h[t.n]}` : alg==='astar'?`${t.g}+${G.h[t.n]}=${t.g+G.h[t.n]}` : '';
    s+=`<circle cx="${X(i)}" cy="${Y(i)}" r="16" fill="${fill}" stroke="${t.n===$('sM').value?'#dc2626':'#1d2330'}" stroke-width="2"/>
        <text x="${X(i)}" y="${Y(i)+5}" font-size="14" font-weight="bold" text-anchor="middle">${t.n}</text>`;
    if(lab) s+=`<text x="${X(i)}" y="${Y(i)+30}" font-size="10" text-anchor="middle" fill="#7c3aed">${lab}</text>`;
    if(ord>=0) s+=`<text x="${X(i)+17}" y="${Y(i)-12}" font-size="10" fill="#b45309" font-weight="bold">#${ord+1}</text>`;
    if(bad.has(i)) s+=`<text x="${X(i)}" y="${Y(i)+5}" font-size="26" text-anchor="middle" fill="#dc2626" opacity=".6">✕</text>`;
  }
  const svg=$('tree'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // "ajustar": el árbol se encoge para caber en la pantalla (sin agrandarse más de su tamaño real)
  if(treeFit){ svg.removeAttribute('width'); svg.removeAttribute('height'); svg.style.maxWidth=W+'px'; }
  else { svg.setAttribute('width',W); svg.setAttribute('height',H); svg.style.maxWidth='none'; }
  svg.classList.toggle('fit',treeFit); svg.innerHTML=s;
}

// ---------- Notación del profe ----------
// Cada fila = estado completo de la pila/cola/abierta. El elemento que se saca en el
// siguiente paso aparece tachado; la meta al salir se encierra en un círculo.
function cuaderno(alg){
  const isStack=alg==='dfs'||alg==='dfsG', isQueue=alg==='bfs'||alg==='bfsG';
  const val={ucs:x=>x.g,greedy:x=>G.h[x.n],astar:x=>x.g+G.h[x.n]}[alg];
  let rows='', fila=0;
  for(let i=0;i<=k;i++){
    const st=steps[i]; if(st.sol||st.fail) continue;
    const nx=steps[i+1] && i+1<=k ? steps[i+1] : null;
    let fr=[...st.fr]; if(isStack) fr.reverse();          // pila: tope a la izquierda
    const cells=fr.map(x=>{
      const txt = val ? `(${x.n},${val(x)})` : x.n;
      const cls = nx&&nx.curId===x.id ? (nx.sol?'goal':'tach') : '';
      return `<span class="${val?'t':'c'} ${cls}">${txt}</span>`;
    }).join('');
    // cola: escalera (lo que queda conserva su columna); pila: alineada a la derecha
    const pad = isQueue ? `padding-left:${fila*0.85}em` : '';
    rows+=`<div class="row ${i===k?'now':''}" style="${pad}">${cells||'&nbsp;'}</div>`;
    fila++;
  }
  const st=steps[k];
  const titulo = alg==='bfs'?'Cola' : alg==='dfs'?'Pila' : alg==='bfsG'?'Lista abierta (cola)' :
                 alg==='dfsG'?'Lista abierta (pila)' : 'Lista abierta';
  let h=`<div class="nb"><div class="nbcols ${alg==='bfs'||alg==='dfs'?'one':''}">
    <div class="nbcol"><div class="nbh">${titulo}</div><div class="rows ${isStack?'stack':''}">${rows}</div></div>`;
  if(alg!=='bfs'&&alg!=='dfs')
    h+=`<div class="nbcol"><div class="nbh">Lista cerrada</div><div class="clist">${st.closed.join(', ')}</div></div>`;
  h+=`</div>`;
  if(st.sol){
    const nom={bfs:'Anchura',dfs:'Profundidad',bfsG:'Anchura con listas',dfsG:'Profundidad con listas',
               ucs:'Costo uniforme',greedy:'Avaro',astar:'A*'}[alg];
    h+=`<div class="nbbox">expandidos: ${st.exp}<br>creados: ${st.cre}</div>
        <div class="nbans">R// ${nom}: ${st.sol.path.join(' → ')} : ${st.sol.g}</div>`;
  }
  return h+`</div>`;
}

// ---------- Reproductor ----------
let steps=[], k=0, timer=null;
const NOMBRES={bfs:'Anchura — COLA (FIFO)',dfs:'Profundidad — PILA (LIFO)',bfsG:'Anchura — Cola + Abierta/Cerrada',
  dfsG:'Profundidad — Pila + Abierta/Cerrada',ucs:'Costo uniforme — Abierta (orden g) / Cerrada',
  greedy:'Avaro — Abierta (orden h) / Cerrada',astar:'A* — Abierta (orden f=g+h) / Cerrada'};

function correr(){
  parar();
  const alg=$('alg').value;
  steps=buscar(alg,$('sI').value,$('sM').value); k=0; TP=layoutArbol(steps.T);
  $('algTitle').textContent=NOMBRES[alg];
  let rows=steps.map((s,i)=>`<tr data-i="${i}"><td>${i}</td><td>${s.msg}</td></tr>`).join('');
  $('hist').innerHTML=rows;
  $('hist').querySelectorAll('tr').forEach(tr=>tr.onclick=()=>{k=+tr.dataset.i;mostrar();});
  mostrar();
}

function mostrar(){
  const st=steps[k], alg=$('alg').value;
  dibujar(st);
  $('msg').textContent=st.msg;
  $('stepLbl').textContent=`Paso ${k} / ${steps.length-1}`;
  $('stE').textContent=st.exp; $('stC').textContent=st.cre; $('stP').textContent=k;
  $('dsBox').innerHTML=cuaderno(alg);
  dibujarArbol(st,alg);
  const res=$('res');
  if(st.sol){
    res.style.display='block'; res.style.background='#dcfce7';
    res.innerHTML=`✅ <b>Ruta:</b> ${st.sol.path.join(' → ')} &nbsp; | &nbsp; <b>Costo:</b> ${st.sol.g}<br>
      <b>Nodos expandidos:</b> ${st.exp} &nbsp; | &nbsp; <b>Nodos creados:</b> ${st.cre}`;
  } else if(st.fail){ res.style.display='block'; res.style.background='#fee2e2'; res.textContent='❌ No se encontró solución.'; }
  else res.style.display='none';
  $('hist').querySelectorAll('tr').forEach(tr=>tr.classList.toggle('on',+tr.dataset.i===k));
  const on=$('hist').querySelector('tr.on'); if(on) on.scrollIntoView({block:'nearest'});
}

function parar(){ clearInterval(timer); timer=null; $('bPlay').innerHTML='▶<span class="tx"> Reproducir</span>'; }
function play(){
  if(timer){parar();return;}
  if(k>=steps.length-1) k=0;
  $('bPlay').innerHTML='⏸<span class="tx"> Pausa</span>';
  const tick=()=>{ if(k<steps.length-1){k++;mostrar();} else parar(); };
  timer=setInterval(tick,+$('spd').value);
}
$('bPlay').onclick=play;
$('bNext').onclick=()=>{parar(); if(k<steps.length-1){k++;mostrar();}};
$('bPrev').onclick=()=>{parar(); if(k>0){k--;mostrar();}};
$('bFirst').onclick=()=>{parar();k=0;mostrar();};
$('bLast').onclick=()=>{parar();k=steps.length-1;mostrar();};
$('spd').oninput=()=>{ if(timer){parar();play();} };
$('gen').onclick=generar;
$('alg').onchange=correr;
$('sI').onchange=correr;
$('sM').onchange=()=>{calcHeur();correr();};
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if(e.key==='ArrowRight') $('bNext').click();
  if(e.key==='ArrowLeft') $('bPrev').click();
  if(e.key===' '){e.preventDefault();play();}
});
$('treeFit').onclick=()=>{
  treeFit=!treeFit;
  $('treeFit').textContent= treeFit ? '🔍 Tamaño real' : '↔ Ajustar a pantalla';
  dibujarArbol(steps[k],$('alg').value);
};
// por defecto se ajusta en móvil y se ve a tamaño real en pantallas grandes
if(window.innerWidth>900){ treeFit=false; $('treeFit').textContent='↔ Ajustar a pantalla'; }

// contador de estrellas del repo (si la API de GitHub no responde, solo se oculta)
fetch('https://api.github.com/repos/EdgarG1013/Algoritmos-de-b-squeda')
  .then(r=>r.ok?r.json():null)
  .then(d=>{ if(d&&typeof d.stargazers_count==='number'){ const c=$('starCnt'); c.textContent=d.stargazers_count; c.classList.add('on'); } })
  .catch(()=>{});

generar();
