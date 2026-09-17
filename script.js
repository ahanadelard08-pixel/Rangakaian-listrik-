const board=document.getElementById('board'),svg=document.getElementById('wires');let C=[],W=[],J=[],sel=null,tool='select',start=null,drag=null,running=false,nid=1;const D={battery:['🔋','Baterai','V',12],resistor:['▱','Resistor','Ω',6],lamp:['💡','Lampu','Ω',6],switch:['⏻','Saklar','',1]};document.querySelectorAll('.add[data-type]').forEach(b=>b.onclick=()=>add(b.dataset.type));function add(t){let d=D[t],c={id:nid++,type:t,name:t==='battery'?d[1]:d[1]+' '+(C.filter(x=>x.type===t).length+1),value:d[3],x:70+(C.length%5)*145,y:100+Math.floor(C.length/5)*125,on:true,rot:0};C.push(c);sel=c.id;render();editor();calc()}document.getElementById('addJ').onclick=()=>{J.push({id:'j'+nid++,x:300+J.length*120,y:350});render();toast('Titik percabangan dibuat')};function setTool(t){tool=t;start=null;document.querySelectorAll('.tools button').forEach(b=>b.classList.remove('active'));document.getElementById(t).classList.add('active');render()}document.getElementById('select').onclick=()=>setTool('select');document.getElementById('connect').onclick=()=>setTool('connect');document.getElementById('cut').onclick=()=>setTool('cut');document.getElementById('delete').onclick=()=>setTool('delete');document.getElementById('rotate').onclick=()=>{let c=C.find(x=>x.id===sel);if(c){c.rot=(c.rot+180)%360;render();editor();toast('Komponen diputar 180°')}else toast('Pilih komponen terlebih dahulu')};function pt(k){let [a,s]=String(k).split(':');let c=C.find(x=>String(x.id)===a);if(c){let r=c.rot===180;return{x:c.x+(s==='L'?(r?120:0):(r?0:120)),y:c.y+44}}let j=J.find(x=>x.id===a);return j?{x:j.x,y:j.y}:null}function addW(a,b){if(a&&b&&a!==b&&!W.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))W.push({id:Date.now()+Math.random(),a,b})}function render(){document.querySelectorAll('.component,.junction').forEach(e=>e.remove());C.forEach(c=>{let e=document.createElement('div');e.className='component '+(sel===c.id?'selected ':'')+(c.type==='lamp'&&running&&current(c.id)>0?'lampOn':'');e.style.left=c.x+'px';e.style.top=c.y+'px';e.style.transform='rotate('+c.rot+'deg)';e.innerHTML='<div class="terminal left" data-k="'+c.id+':L"></div><div class="terminal right" data-k="'+c.id+':R"></div><div class="title">'+esc(c.name)+'</div><div class="visual">'+D[c.type][0]+'</div><div class="value">'+(c.type==='switch'?(c.on?'ON':'OFF'):c.value+' '+D[c.type][2])+'</div>';e.querySelectorAll('.terminal').forEach(t=>t.onclick=term);e.onpointerdown=v=>{if(tool!=='select'||v.target.classList.contains('terminal'))return;sel=c.id;editor();let r=board.getBoundingClientRect();drag={o:c,dx:v.clientX-r.left-c.x,dy:v.clientY-r.top-c.y};v.preventDefault()};e.onclick=v=>{if(v.target.classList.contains('terminal'))return;if(tool==='delete')delC(c.id);else if(tool==='select'){sel=c.id;editor();render()}};e.ondblclick=()=>{if(c.type==='switch'){c.on=!c.on;render();calc()}};board.appendChild(e)});J.forEach(j=>{let e=document.createElement('div');e.className='junction';e.style.left=j.x+'px';e.style.top=j.y+'px';e.onpointerdown=v=>{if(tool!=='select')return;let r=board.getBoundingClientRect();drag={o:j,dx:v.clientX-r.left-j.x,dy:v.clientY-r.top-j.y};v.preventDefault()};e.onclick=v=>{v.stopPropagation();if(tool==='delete')delJ(j.id);else if(tool==='connect'){let k=j.id+':J';if(!start){start=k;toast('Titik pertama dipilih')}else{addW(start,k);start=null;render();calc()}}};board.appendChild(e)});draw();document.getElementById('hint').style.display=C.length?'none':'block'}function term(e){e.stopPropagation();if(tool!=='connect')return;let k=e.currentTarget.dataset.k;if(!start){start=k;toast('Terminal pertama dipilih')}else{addW(start,k);start=null;render();calc()}}function draw(){svg.innerHTML='';W.forEach(w=>{let a=pt(w.a),b=pt(w.b);if(!a||!b)return;let p=document.createElementNS('http://www.w3.org/2000/svg','path'),m=(a.x+b.x)/2;p.setAttribute('d',`M${a.x} ${a.y} C${m} ${a.y},${m} ${b.y},${b.x} ${b.y}`);p.classList.add('wire');if(running)p.classList.add('power');p.onclick=e=>{e.stopPropagation();if(tool==='cut'){W=W.filter(x=>x.id!==w.id);render();calc();toast('Kabel diputus')}};svg.appendChild(p)})}board.onpointermove=e=>{if(!drag)return;let r=board.getBoundingClientRect();drag.o.x=Math.max(8,Math.min(board.clientWidth-(drag.o.type?125:8),e.clientX-r.left-drag.dx));drag.o.y=Math.max(8,Math.min(board.clientHeight-(drag.o.type?92:8),e.clientY-r.top-drag.dy));render()};onpointerup=()=>drag=null;function delC(id){C=C.filter(c=>c.id!==id);W=W.filter(w=>!String(w.a).startsWith(id+':')&&!String(w.b).startsWith(id+':'));sel=null;render();editor();calc()}function delJ(id){J=J.filter(j=>j.id!==id);W=W.filter(w=>!String(w.a).startsWith(id+':')&&!String(w.b).startsWith(id+':'));render();calc()}document.getElementById('clear').onclick=()=>{if(confirm('Hapus semua?')){C=[];W=[];J=[];sel=null;render();editor();calc()}};document.getElementById('reset').onclick=()=>{C=[];W=[];J=[];sel=null;running=false;render();editor();calc()};document.getElementById('run').onclick=()=>{running=true;calc()};document.getElementById('stop').onclick=()=>{running=false;calc()};document.getElementById('battery').oninput=()=>{let b=C.find(c=>c.type==='battery');if(b){b.value=+document.getElementById('battery').value||12;calc()}};function editor(){let c=C.find(x=>x.id===sel),e=document.getElementById('editor');if(!c){e.textContent='Pilih komponen di papan.';return}e.innerHTML='<div style="font-size:38px;text-align:center">'+D[c.type][0]+'</div><b>'+esc(c.name)+'</b><label>Nama<input id="en" value="'+esc(c.name)+'"></label><label>Nilai ('+D[c.type][2]+')<input id="ev" type="number" value="'+c.value+'"></label><button id="apply">Terapkan</button><button id="turn">Putar 180°</button><button id="remove">Hapus</button>';document.getElementById('apply').onclick=()=>{c.name=en.value||c.name;c.value=+ev.value||c.value;if(c.type==='battery')document.getElementById('battery').value=c.value;render();editor();calc()};document.getElementById('turn').onclick=()=>{c.rot=(c.rot+180)%360;render();editor()};document.getElementById('remove').onclick=()=>delC(c.id)}
function terminalKey(c, side){ return c.id+':'+side; }

function makeCircuitGraph(){
 const parent=new Map();
 const find=x=>{
   if(!parent.has(x)) parent.set(x,x);
   let p=parent.get(x);
   if(p!==x){p=find(p);parent.set(x,p)}
   return p;
 };
 const union=(a,b)=>{
   const ra=find(a), rb=find(b);
   if(ra!==rb) parent.set(ra,rb);
 };

 // Every component terminal and junction is a graph node.
 C.forEach(c=>{find(terminalKey(c,'L'));find(terminalKey(c,'R'))});
 J.forEach(j=>find(j.id+':J'));

 // A wire joins two terminals/nodes.
 W.forEach(w=>union(w.a,w.b));

 const nodeOf=k=>find(k);

 // Build component edges between contracted wire nodes.
 const edges=[];
 C.forEach(c=>{
   if(c.type==='switch' && !c.on) return; // open switch
   const a=nodeOf(terminalKey(c,'L')), b=nodeOf(terminalKey(c,'R'));
   if(a!==b) edges.push({id:c.id,a,b,c});
 });
 return {nodeOf,edges};
}

function hasPath(adj, from, to, blockedId){
 const q=[from], seen=new Set([from]);
 while(q.length){
   const n=q.shift();
   if(n===to) return true;
   for(const e of (adj.get(n)||[])){
     if(e.id===blockedId) continue;
     if(!seen.has(e.to)){seen.add(e.to);q.push(e.to)}
   }
 }
 return false;
}

function circuitState(){
 const batteryC=C.find(c=>c.type==='battery');
 const graph=makeCircuitGraph();
 if(!batteryC) return {closed:false, active:new Set(), reason:'Tambahkan baterai.'};

 const bp=graph.nodeOf(terminalKey(batteryC,'L'));
 const bn=graph.nodeOf(terminalKey(batteryC,'R'));

 // Battery polarity follows its two terminals. For topology, either terminal
 // can serve as source side; a complete circuit requires a path between them
 // through the rest of the network.
 const adj=new Map();
 const add=(a,b,e)=>{
   if(!adj.has(a)) adj.set(a,[]);
   adj.get(a).push({to:b,id:e.id,edge:e});
 };
 graph.edges.forEach(e=>{add(e.a,e.b,e);add(e.b,e.a,e)});

 const closed=hasPath(adj,bp,bn,null);
 const active=new Set();

 if(closed){
   // An element is energized when it lies on at least one closed path
   // from battery positive node to battery negative node.
   graph.edges.forEach(e=>{
     if(e.c.type!=='lamp' && e.c.type!=='resistor') return;
     const left=hasPath(adj,bp,e.a,e.id);
     const right=hasPath(adj,e.b,bn,e.id);
     const cross=hasPath(adj,bp,e.b,e.id) && hasPath(adj,e.a,bn,e.id);
     if((left && right) || cross) active.add(e.c.id);
   });
 }
 return {closed,active,battery:batteryC,edges:graph.edges,adj,bp,bn};
}

function solve(){
 const state=circuitState();
 const rs=C.filter(c=>c.type==='resistor'||c.type==='lamp');
 if(!state.battery) return null;
 if(!rs.length) return {reason:'Tambahkan resistor/lampu.',state};

 // Equivalent resistance is provided for common educational cases.
 // Topology/lighting is determined by the actual wire graph above.
 let rt=0;
 if(state.closed){
   // For a simple parallel network, use reciprocal sum.
   // For a simple series network, use sum.
   // For mixed/irregular networks, report a conservative approximate value
   // while the ON/OFF behavior remains topology-correct.
   const activeRs=rs.filter(c=>state.active.has(c.id));
   if(activeRs.length===rs.length && activeRs.length>0){
     const nodeSets=activeRs.map(c=>({
       c,
       a:state.adj,
     }));
     // If every resistor is connected across the same two contracted nodes,
     // it is a parallel group.
     const g=makeCircuitGraph();
     const pairs=activeRs.map(c=>{
       const a=g.nodeOf(terminalKey(c,'L')), b=g.nodeOf(terminalKey(c,'R'));
       return a<b?a+'|'+b:b+'|'+a;
     });
     if(new Set(pairs).size===1) rt=1/activeRs.reduce((sum,c)=>sum+1/Math.max(.001,c.value),0);
     else rt=activeRs.reduce((sum,c)=>sum+Math.max(.001,c.value),0);
   } else if(state.closed){
     const activeRs=rs.filter(c=>state.active.has(c.id));
     if(activeRs.length) rt=activeRs.reduce((sum,c)=>sum+c.value,0);
   }
 }
 const total=state.closed && rt>0 ? state.battery.value/rt : 0;
 return {b:state.battery,rt,total,state};
}

function current(id){
 const s=solve(); if(!s || !s.state || !s.state.closed) return 0;
 const c=C.find(x=>x.id===id);
 if(!c || !s.state.active.has(id)) return 0;
 return s.b.value/Math.max(.001,c.value);
}

function powerWire(w){
 const s=circuitState();
 return s.closed;
}

function calc(){
 const s=solve();
 const out=document.getElementById('result');
 if(!s){out.textContent='Tambahkan baterai dan komponen.';render();return}
 if(s.state && !s.state.closed){
   out.innerHTML='<div><b>Rangkaian terbuka</b></div><div>Arus Total: <b>0 A</b></div><div>Putusnya kabel membuat jalur arus terhenti pada bagian rangkaian yang bersangkutan.</div>';
   render();return;
 }
 out.innerHTML='<div>Tegangan: <b>'+s.b.value.toFixed(2)+' V</b></div>'+
 '<div>Hambatan Total (Rₜ): <b>'+s.rt.toFixed(2)+' Ω</b></div>'+
 '<div>Arus Total: <b>'+s.total.toFixed(3)+' A</b></div><hr>'+
 C.filter(c=>c.type==='resistor'||c.type==='lamp').map(c=>
 '<div>'+esc(c.name)+': '+current(c.id).toFixed(3)+' A'+
 (s.state.active.has(c.id)?' • aktif':' • tidak dialiri')+'</div>').join('');
 render();
}

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}function toast(t){let x=document.getElementById('toast');x.textContent=t;x.style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>x.style.display='none',1500)}render();editor();calc();
