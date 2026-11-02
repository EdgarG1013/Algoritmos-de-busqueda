// ---------- RNG con semilla ----------
let rnd = Math.random;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ri = (a,b)=>a+Math.floor(rnd()*(b-a+1));

// ---------- Grafo ----------
// G = {names, pos:{A:{x,y}}, adj:{A:{B:3}}, edges:[[a,b,c]] (se deriva de adj), h:{}, hs:{}, hAuto}
// hAuto = true mientras las h sean las aleatorias (al cambiar la meta se regeneran);
// en cuanto el usuario edita una h, se respetan sus valores.
let G = null;
const $ = id=>document.getElementById(id);
const NOMBRE_OK = /^[A-Za-zÑñ0-9]{1,3}$/;
const r3 = x=>Math.round(x*1000)/1000;              // evita 0.1+0.2=0.30000000000000004
const num = x=>x===Infinity?'∞':x;
const pj = p=>p.join(G.names.some(v=>v.length>1)?',':'');   // camino compacto (con comas si hay nombres largos)
const clampPos = p=>({x:Math.round(Math.max(30,Math.min(670,p.x))),y:Math.round(Math.max(35,Math.min(435,p.y)))});

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
  let ne=0;
  const add=(a,b)=>{ if(a===b||adj[a][b]!==undefined) return;
    const c=ri(1,15); adj[a][b]=c; adj[b][a]=c; ne++; };
  const d=(a,b)=>Math.hypot(pos[a].x-pos[b].x,pos[a].y-pos[b].y);
  // árbol de expansión: cada nodo se une al más cercano ya conectado (grafo conexo)
  for(let i=1;i<n;i++){
    const prev=names.slice(0,i).sort((a,b)=>d(names[i],a)-d(names[i],b));
    add(names[i],prev[0]);
  }
  // aristas extra entre nodos cercanos
  const extra=Math.round(n*0.6);
  for(let k=0;k<extra*4 && ne<n-1+extra;k++){
    const a=names[ri(0,n-1)];
    const near=names.filter(b=>b!==a).sort((x,y)=>d(a,x)-d(a,y)).slice(0,3);
    add(a,near[ri(0,near.length-1)]);
  }
  G={names,pos,adj,h:{},hAuto:true}; sel=null;
  llenarSelects(names[0],names[n-1]);
  hAleatoria(); actualizar();
}

function dijkstra(src){
  const dist={}; G.names.forEach(v=>dist[v]=Infinity);
  if(!G.adj[src]) return dist;
  dist[src]=0;
  const vis=new Set();
  while(vis.size<G.names.length){
    let u=null; for(const v of G.names) if(!vis.has(v)&&(u===null||dist[v]<dist[u])) u=v;
    if(dist[u]===Infinity) break; vis.add(u);
    for(const [w,c] of Object.entries(G.adj[u])) if(dist[u]+c<dist[w]) dist[w]=r3(dist[u]+c);
  }
  return dist;
}
function hAleatoria(){
  const meta=$('sM').value, hs=dijkstra(meta);
  // h = fracción aleatoria (50%–100%) del costo real => nunca sobreestima => admisible
  for(const v of G.names) G.h[v]= v===meta||hs[v]===Infinity ? 0 : Math.floor(hs[v]*(0.5+rnd()*0.5));
  G.hAuto=true;
}

function llenarSelects(ini=$('sI').value, meta=$('sM').value){
  const ns=G.names, o=ns.map(v=>`<option>${v}</option>`).join('');
  $('sI').innerHTML=o; $('sM').innerHTML=o;
  $('sI').value = ns.includes(ini) ? ini : (ns[0]??'');
  $('sM').value = ns.includes(meta) ? meta : (ns.at(-1)??'');
}

// Recalcula todo lo derivado del grafo y vuelve a correr la búsqueda.
// `origen` = widget que el usuario está escribiendo (no se redibuja para no perder el foco).
function actualizar(origen){
  G.names.sort();
  G.edges=[];
  for(const a of G.names) for(const [b,c] of Object.entries(G.adj[a])) if(a<b) G.edges.push([a,b,c]);
  G.edges.sort((x,y)=>x[0]===y[0] ? (x[1]<y[1]?-1:1) : (x[0]<y[0]?-1:1));
  G.names.forEach(v=>{ if(G.h[v]===undefined) G.h[v]=0; });
  llenarSelects();
  G.hs=dijkstra($('sM').value);                 // costo real h*(n)
  if(origen!=='hTab') tablaH(); else marcarH();
  if(origen!=='eTab') tablaE();
  if(origen!=='sel') panelSel();
  guardar();
  correr();
}

// ---------- Tablas editables ----------
function tablaH(){
  const ns=G.names;
  if(!ns.length){ $('hTab').innerHTML='<tr><td class="mut">Grafo vacío</td></tr>'; $('hMsg').innerHTML=''; return; }
  $('hTab').innerHTML=`<tr><th>Nodo</th>${ns.map(v=>`<th>${v}</th>`).join('')}</tr>
    <tr><td><b>h(n)</b></td>${ns.map(v=>`<td><input class="hin" type="number" min="0" step="any" data-h="${v}" value="${G.h[v]}"></td>`).join('')}</tr>
    <tr><td style="color:var(--mut)">h*(n) real</td>${ns.map(v=>`<td style="color:var(--mut)">${num(G.hs[v])}</td>`).join('')}</tr>`;
  marcarH();
}
function marcarH(){
  $('hTab').querySelectorAll('[data-h]').forEach(i=>{
    const v=i.dataset.h, bad=G.h[v]>G.hs[v];
    i.classList.toggle('bad',bad);
    i.title = bad ? `No admisible: h(${v})=${G.h[v]} > h*(${v})=${G.hs[v]}` : '';
  });
  const noAdm=G.names.filter(v=>G.h[v]>G.hs[v]);
  const noCons=G.edges.filter(([a,b,c])=>G.h[a]>c+G.h[b]||G.h[b]>c+G.h[a]).map(([a,b])=>`${a}–${b}`);
  const meta=$('sM').value;
  let m = noAdm.length ? `<div class="warn">⚠ No admisible en: ${noAdm.join(', ')} (h &gt; h*)</div>`
                       : `<div class="ok">✔ Todas las h son admisibles.</div>`;
  if(noCons.length) m+=`<div class="warn">⚠ No consistente en: ${noCons.join(', ')} (h(n) &gt; c(n,n') + h(n')). Con lista cerrada A* podría no dar la ruta óptima.</div>`;
  if(meta&&G.h[meta]!==0) m+=`<div class="warn">⚠ h(${meta}) debería ser 0 por ser la meta.</div>`;
  $('hMsg').innerHTML=m;
}
$('hTab').addEventListener('input',e=>{
  const v=e.target.dataset.h; if(!v) return;
  const x=parseFloat(e.target.value);
  if(isNaN(x)||x<0){ e.target.classList.add('bad'); return; }
  G.h[v]=x; G.hAuto=false; actualizar('hTab');
});

function tablaE(){
  const op=G.names.map(v=>`<option>${v}</option>`).join('');
  const prev=[$('eA')?.value,$('eB')?.value,$('eC')?.value];
  $('eTab').innerHTML=(G.edges.length
      ? `<div class="elist">${G.edges.map(([a,b,c])=>`<div class="erow"><span>${a} — ${b}</span>
          <input type="number" min="0" step="any" value="${c}" data-a="${a}" data-b="${b}">
          <button class="mini x" data-del="${a}" data-del2="${b}" title="Borrar arista">✕</button></div>`).join('')}</div>`
      : '<div class="mut">Sin aristas.</div>')
    +`<div class="eadd">Nueva arista: <select id="eA">${op}</select> — <select id="eB">${op}</select>
      costo <input id="eC" type="number" min="0" step="any" value="1"> <button id="eAdd" class="mini">＋ Agregar</button>
      <span id="eMsg" class="err"></span></div>`;
  if(G.names.includes(prev[0])) $('eA').value=prev[0];
  if(G.names.includes(prev[1])) $('eB').value=prev[1]; else if(G.names[1]) $('eB').value=G.names[1];
  if(prev[2]) $('eC').value=prev[2];
}
$('eTab').addEventListener('input',e=>{
  const {a,b}=e.target.dataset; if(!a) return;
  const c=parseFloat(e.target.value);
  if(isNaN(c)||c<0){ e.target.classList.add('bad'); return; }
  e.target.classList.remove('bad');
  G.adj[a][b]=G.adj[b][a]=c; actualizar('eTab');
});
$('eTab').addEventListener('click',e=>{
  const t=e.target;
  if(t.dataset.del){ borrarArista(t.dataset.del,t.dataset.del2); return; }
  if(t.id==='eAdd'){
    const a=$('eA').value, b=$('eB').value, c=parseFloat($('eC').value);
    if(!a||!b) return $('eMsg').textContent='Primero crea nodos.';
    if(a===b) return $('eMsg').textContent='Elige dos nodos distintos.';
    if(isNaN(c)||c<0) return $('eMsg').textContent='Costo inválido (debe ser ≥ 0).';
    G.adj[a][b]=G.adj[b][a]=c; actualizar();
  }
});

// ---------- Editor del grafo ----------
let edit=false, sel=null, drag=null;   // sel: {t:'n',v} | {t:'e',a,b}

function aviso(t){ $('edMsg').textContent=t; clearTimeout(aviso.t); aviso.t=setTimeout(()=>$('edMsg').textContent='',4000); }
function seleccionar(s){ sel=s; panelSel(); dibujar(steps[k]); }

function panelSel(){
  const box=$('edSel');
  if(sel&&sel.t==='n'&&!G.names.includes(sel.v)) sel=null;
  if(sel&&sel.t==='e'&&G.adj[sel.a]?.[sel.b]===undefined) sel=null;
  if(!sel){ box.innerHTML='<span class="mut">Nada seleccionado.</span>'; return; }
  if(sel.t==='n'){
    const v=sel.v;
    box.innerHTML=`<b>Nodo ${v}</b>
      <label>Nombre <input id="selName" value="${v}" maxlength="3"></label>
      <label>h(n) <input id="selH" type="number" min="0" step="any" value="${G.h[v]}"></label>
      <button id="selIni" class="mini">🟢 Inicio</button><button id="selMeta" class="mini">🎯 Meta</button>
      <button id="selDel" class="mini danger">🗑 Borrar nodo</button>
      <span class="mut">Clic en otro nodo para unirlos.</span>`;
    $('selName').onchange=e=>{
      const nu=e.target.value.trim();
      if(!renombrar(v,nu)){ e.target.classList.add('bad');
        aviso(G.names.includes(nu)?`Ya existe un nodo "${nu}".`:'Nombre inválido: de 1 a 3 letras o dígitos.'); }
    };
    $('selH').oninput=e=>{
      const x=parseFloat(e.target.value);
      if(isNaN(x)||x<0){ e.target.classList.add('bad'); return; }
      e.target.classList.remove('bad'); G.h[v]=x; G.hAuto=false; actualizar('sel');
    };
    $('selIni').onclick=()=>{ $('sI').value=v; $('sI').onchange(); };
    $('selMeta').onclick=()=>{ $('sM').value=v; $('sM').onchange(); };
  } else {
    const {a,b}=sel;
    box.innerHTML=`<b>Arista ${a} — ${b}</b>
      <label>Costo <input id="selC" type="number" min="0" step="any" value="${G.adj[a][b]}"></label>
      <button id="selDel" class="mini danger">🗑 Borrar arista</button>`;
    $('selC').oninput=e=>{
      const c=parseFloat(e.target.value);
      if(isNaN(c)||c<0){ e.target.classList.add('bad'); return; }
      e.target.classList.remove('bad'); G.adj[a][b]=G.adj[b][a]=c; actualizar('sel');
    };
  }
  $('selDel').onclick=borrarSel;
}

function nuevoNodo(p){
  let v=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(c=>!G.names.includes(c));
  for(let i=1;!v;i++) if(!G.names.includes('N'+i)) v='N'+i;
  G.names.push(v); G.pos[v]=clampPos(p); G.adj[v]={}; G.h[v]=0;
  actualizar();
}
function crearArista(a,b){
  if(G.adj[a][b]===undefined){
    const d=Math.hypot(G.pos[a].x-G.pos[b].x,G.pos[a].y-G.pos[b].y);
    G.adj[a][b]=G.adj[b][a]=Math.max(1,Math.round(d/50));   // costo sugerido según la distancia
  }
  sel={t:'e',a,b}; actualizar();
  $('selC').focus(); $('selC').select();
}
function renombrar(a,b){
  if(b===a) return true;
  if(!NOMBRE_OK.test(b)||G.names.includes(b)) return false;
  const ini=$('sI').value, meta=$('sM').value;
  G.names=G.names.map(v=>v===a?b:v);
  G.pos[b]=G.pos[a]; delete G.pos[a];
  G.h[b]=G.h[a]; delete G.h[a];
  G.adj[b]=G.adj[a]; delete G.adj[a];
  for(const v of G.names) if(G.adj[v][a]!==undefined){ G.adj[v][b]=G.adj[v][a]; delete G.adj[v][a]; }
  llenarSelects(ini===a?b:ini, meta===a?b:meta);
  sel={t:'n',v:b}; actualizar();
  return true;
}
function borrarArista(a,b){ delete G.adj[a][b]; delete G.adj[b][a]; actualizar(); }
function borrarSel(){
  if(!sel) return;
  if(sel.t==='e') return borrarArista(sel.a,sel.b);
  const v=sel.v;
  G.names=G.names.filter(w=>w!==v);
  delete G.pos[v]; delete G.h[v]; delete G.adj[v];
  for(const w of G.names) delete G.adj[w][v];
  sel=null; actualizar();
}

// coordenadas del mouse dentro del viewBox del SVG
function svgPt(e){
  const svg=$('svg'), p=svg.createSVGPoint(); p.x=e.clientX; p.y=e.clientY;
  const q=p.matrixTransform(svg.getScreenCTM().inverse()); return {x:q.x,y:q.y};
}
$('svg').addEventListener('pointerdown',e=>{
  if(!edit) return;
  const p=svgPt(e), nEl=e.target.closest('[data-n]'), eEl=e.target.closest('[data-a]');
  if(nEl){ drag={v:nEl.dataset.n,p0:p,moved:false}; $('svg').setPointerCapture(e.pointerId); e.preventDefault(); return; }
  if(eEl) return seleccionar({t:'e',a:eEl.dataset.a,b:eEl.dataset.b});
  if(sel) return seleccionar(null);      // clic en vacío con algo seleccionado: solo deselecciona
  nuevoNodo(p);
});
$('svg').addEventListener('pointermove',e=>{
  if(!drag) return;
  const p=svgPt(e);
  if(!drag.moved && Math.hypot(p.x-drag.p0.x,p.y-drag.p0.y)<4) return;
  drag.moved=true; G.pos[drag.v]=clampPos(p); dibujar(steps[k]);
});
$('svg').addEventListener('pointerup',()=>{
  if(!drag) return;
  const {v,moved}=drag; drag=null;
  if(moved) return guardar();
  if(sel&&sel.t==='n'&&sel.v!==v) crearArista(sel.v,v);   // nodo seleccionado + clic en otro = arista
  else seleccionar(sel&&sel.t==='n'&&sel.v===v ? null : {t:'n',v});
});

$('edToggle').onclick=()=>{
  edit=!edit;
  $('edToggle').classList.toggle('on',edit);
  $('edToggle').textContent= edit ? '✔ Terminar edición' : '✏️ Editar grafo';
  $('edBar').hidden=!edit; $('svg').classList.toggle('editing',edit);
  if(!edit) sel=null;
  panelSel(); dibujar(steps[k]);
};
$('edClear').onclick=()=>{
  if(G.names.length && !confirm('¿Borrar todo el grafo actual y empezar uno vacío?')) return;
  G={names:[],pos:{},adj:{},h:{},hAuto:false}; sel=null; actualizar();
};
$('edH').onclick=()=>{ hAleatoria(); actualizar(); };
$('edH0').onclick=()=>{ G.names.forEach(v=>G.h[v]=0); G.hAuto=false; actualizar(); };

// ---------- Guardar / exportar / importar ----------
function exportar(){
  return {nodos:G.names.map(v=>({n:v,x:G.pos[v].x,y:G.pos[v].y,h:G.h[v]})), aristas:G.edges,
          inicio:$('sI').value, meta:$('sM').value, hAuto:G.hAuto};
}
function cargar(o){
  if(!o||!Array.isArray(o.nodos)||!Array.isArray(o.aristas)) throw Error('formato inválido');
  const names=[],pos={},h={},adj={};
  for(const d of o.nodos){
    const v=String(d.n);
    if(!NOMBRE_OK.test(v)||names.includes(v)) throw Error(`nombre de nodo inválido: ${v}`);
    names.push(v); pos[v]=clampPos({x:+d.x||350,y:+d.y||240}); h[v]=Math.max(0,+d.h||0); adj[v]={};
  }
  for(const [a,b,c] of o.aristas){
    if(!adj[a]||!adj[b]||a===b||!(+c>=0)) throw Error(`arista inválida: ${a}-${b}`);
    adj[a][b]=adj[b][a]=+c;
  }
  G={names,pos,adj,h,hAuto:!!o.hAuto}; sel=null;
  llenarSelects(o.inicio,o.meta);
  actualizar();
}
function guardar(){ try{ localStorage.setItem('grafoIA',JSON.stringify(exportar())); }catch{} }
$('edExp').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportar(),null,1)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='grafo.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('edImp').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{ cargar(JSON.parse(await f.text())); aviso(`Grafo "${f.name}" importado.`); }
  catch(err){ aviso('No se pudo importar: '+err.message); }
};

// ---------- Algoritmos: generan una lista de "pasos" (snapshots) ----------
// Convención: test de meta al EXPANDIR el nodo; vecinos en orden alfabético.
// Nodo de búsqueda: {n, path:[...], g}
function fmt(x,alg){
  const p=pj(x.path);
  if(alg==='ucs') return `${x.n}(${p}) g=${x.g}`;
  if(alg==='greedy') return `${x.n}(${p}) h=${G.h[x.n]}`;
  if(alg==='astar') return `${x.n}(${p}) f=${x.g}+${G.h[x.n]}=${r3(x.g+G.h[x.n])}`;
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
      // la meta NO entra a la lista cerrada: la búsqueda termina al sacarla, nunca se expande
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
      const g=r3(x.g+G.adj[x.n][v]);
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
    const on=sel&&sel.t==='e'&&((sel.a===a&&sel.b===b)||(sel.a===b&&sel.b===a));
    s+=`<g data-a="${a}" data-b="${b}">`;
    if(edit) s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="transparent" stroke-width="16"/>`;
    s+=`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${on?'#f59e0b':ok?'#16a34a':'#9aa3b2'}" stroke-width="${on||ok?5:2}"/>`;
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2, lw=8+String(c).length*7;
    s+=`<rect x="${mx-lw/2}" y="${my-10}" width="${lw}" height="18" rx="4" fill="#fff" stroke="${on?'#f59e0b':'#d9dde3'}"/>
        <text x="${mx}" y="${my+4}" font-size="12" text-anchor="middle" fill="#374151">${c}</text></g>`;
  }
  for(const v of G.names){
    const p=pos[v];
    let fill='#fff';
    if(expSet.has(v)) fill='#d1d5db';
    if(frSet.has(v)) fill='#bfdbfe';
    if(sol.includes(v)) fill='#bbf7d0';
    if(st&&st.cur===v) fill='#fcd34d';
    const fs=v.length>2?12:v.length>1?15:18;
    s+=`<g data-n="${v}">`;
    if(sel&&sel.t==='n'&&sel.v===v) s+=`<circle cx="${p.x}" cy="${p.y}" r="32" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" stroke-dasharray="5 4"/>`;
    s+=`<circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${v===meta?'#dc2626':'#1d2330'}" stroke-width="${v===meta?4:2}"/>`;
    if(v===meta) s+=`<circle cx="${p.x}" cy="${p.y}" r="27" fill="none" stroke="#dc2626" stroke-width="1.5"/>`;
    s+=`<text x="${p.x}" y="${p.y+fs/3}" font-size="${fs}" font-weight="bold" text-anchor="middle">${v}</text>
        <text x="${p.x}" y="${p.y+42}" font-size="11" text-anchor="middle" fill="#7c3aed">h=${h[v]}</text>`;
    if(v===ini) s+=`<text x="${p.x}" y="${p.y-30}" font-size="11" text-anchor="middle" fill="#16a34a" font-weight="bold">INICIO</text>`;
    s+='</g>';
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
  const svg=$('tree');
  if(!TP){ svg.innerHTML=''; svg.setAttribute('viewBox','0 0 10 10'); return; }
  const T=steps.T, DX=62, DY=78, M=35;
  const W=TP.w*DX+M*2-DX+20, H=(TP.h-1)*DY+M*2+30;
  const X=id=>M+10+TP.pos[id].x*DX, Y=id=>M+TP.pos[id].d*DY;
  const solIds=new Set(); if(st.sol){ let i=st.sol.id; while(i>=0){ solIds.add(i); i=T[i].p; } }
  const fr=new Set(st.frIds), bad=new Set([...st.disc,...st.repl]);
  let s='';
  for(let i=1;i<st.tn;i++){
    const t=T[i], ok=solIds.has(i)&&solIds.has(t.p);
    s+=`<line x1="${X(t.p)}" y1="${Y(t.p)}" x2="${X(i)}" y2="${Y(i)}" stroke="${ok?'#16a34a':'#9aa3b2'}" stroke-width="${ok?4:1.5}"/>`;
    s+=`<text x="${(X(t.p)+X(i))/2+4}" y="${(Y(t.p)+Y(i))/2}" font-size="10" fill="#6b7280">${r3(t.g-T[t.p].g)}</text>`;
  }
  for(let i=0;i<st.tn;i++){
    const t=T[i]; let fill='#fff';
    const ord=st.expIds.indexOf(i);
    if(ord>=0) fill='#d1d5db';
    if(fr.has(i)) fill='#bfdbfe';
    if(bad.has(i)) fill='#fecaca';
    if(solIds.has(i)) fill='#bbf7d0';
    if(st.curId===i) fill='#fcd34d';
    const lab = alg==='ucs'?`g=${t.g}` : alg==='greedy'?`h=${G.h[t.n]}` : alg==='astar'?`${t.g}+${G.h[t.n]}=${r3(t.g+G.h[t.n])}` : '';
    const fs=t.n.length>2?10:t.n.length>1?12:14;
    s+=`<circle cx="${X(i)}" cy="${Y(i)}" r="16" fill="${fill}" stroke="${t.n===$('sM').value?'#dc2626':'#1d2330'}" stroke-width="2"/>
        <text x="${X(i)}" y="${Y(i)+fs/3}" font-size="${fs}" font-weight="bold" text-anchor="middle">${t.n}</text>`;
    if(lab) s+=`<text x="${X(i)}" y="${Y(i)+30}" font-size="10" text-anchor="middle" fill="#7c3aed">${lab}</text>`;
    if(ord>=0) s+=`<text x="${X(i)+17}" y="${Y(i)-12}" font-size="10" fill="#b45309" font-weight="bold">#${ord+1}</text>`;
    if(bad.has(i)) s+=`<text x="${X(i)}" y="${Y(i)+5}" font-size="26" text-anchor="middle" fill="#dc2626" opacity=".6">✕</text>`;
  }
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
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
  const val={ucs:x=>x.g,greedy:x=>G.h[x.n],astar:x=>r3(x.g+G.h[x.n])}[alg];
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
  if(G.names.length){ steps=buscar(alg,$('sI').value,$('sM').value); TP=layoutArbol(steps.T); }
  else {
    steps=[{msg:'Grafo vacío: con ✏️ Editar grafo haz clic en el lienzo para crear nodos.',cur:null,fr:[],closed:[],
            exp:0,cre:0,expanded:[],tn:0,expIds:[],frIds:[],curId:null,disc:[],repl:[]}];
    steps.T=[]; TP=null;
  }
  k=0;
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
$('sI').onchange=()=>{ guardar(); correr(); };
$('sM').onchange=()=>{ if(G.hAuto) hAleatoria(); actualizar(); };
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if(e.key==='ArrowRight') $('bNext').click();
  if(e.key==='ArrowLeft') $('bPrev').click();
  if(e.key===' '){e.preventDefault();play();}
  if(edit&&sel&&(e.key==='Delete'||e.key==='Backspace')){ e.preventDefault(); borrarSel(); }
  if(edit&&e.key==='Escape') seleccionar(null);
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

// al abrir se recupera el último grafo (guardado automáticamente en este navegador)
let restaurado=false;
try{ const s=localStorage.getItem('grafoIA'); if(s){ cargar(JSON.parse(s)); restaurado=true; } }catch{}
if(!restaurado) generar();
