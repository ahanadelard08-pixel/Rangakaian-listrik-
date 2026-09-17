const board=document.getElementById('board');
let workspace=document.getElementById('workspace');
if(!workspace){
 workspace=document.createElement('div');
 workspace.id='workspace';
 const oldSvg=document.getElementById('wires');
 board.insertBefore(workspace,oldSvg);
 workspace.appendChild(oldSvg);
}
const svg=document.getElementById('wires');
const WORK_W=1800, WORK_H=1100;let C=[],W=[],J=[],sel=null,tool='select',start=null,drag=null,running=false,nid=1;const D={battery:['🔋','Baterai','V',12],resistor:['▱','Resistor','Ω',6],lamp:['💡','Lampu','Ω',6],switch:['⏻','Saklar','',1]};document.querySelectorAll('.add[data-type]').forEach(b=>b.onclick=()=>add(b.dataset.type));function add(t){let d=D[t],c={id:nid++,type:t,name:t==='battery'?d[1]:d[1]+' '+(C.filter(x=>x.type===t).length+1),value:d[3],x:80+(C.length%7)*220,y:90+Math.floor(C.length/7)*150,on:true,rot:0};C.push(c);sel=c.id;render();editor();calc()}document.getElementById('addJ').onclick=()=>{J.push({id:'j'+nid++,x:300+J.length*120,y:350});render();toast('Titik percabangan dibuat')};function setTool(t){tool=t;start=null;document.querySelectorAll('.tools button').forEach(b=>b.classList.remove('active'));document.getElementById(t).classList.add('active');render()}document.getElementById('select').onclick=()=>setTool('select');document.getElementById('connect').onclick=()=>setTool('connect');document.getElementById('cut').onclick=()=>setTool('cut');document.getElementById('delete').onclick=()=>setTool('delete');document.getElementById('rotate').onclick=()=>{let c=C.find(x=>x.id===sel);if(c){c.rot=(c.rot+180)%360;render();editor();toast('Komponen diputar 180°')}else toast('Pilih komponen terlebih dahulu')};function pt(k){
 const [a,side]=String(k).split(':');
 const c=C.find(x=>String(x.id)===a);
 if(c){
   const ang=(c.rot||0)*Math.PI/180;
   const cx=c.x+60, cy=c.y+44;
   const localX=(side==='L'?-60:60);
   return {x:cx+localX*Math.cos(ang),y:cy+localX*Math.sin(ang)};
 }
 const j=J.find(x=>x.id===a);
 return j?{x:j.x,y:j.y}:null;
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
 '<div><b>'+esc(c.name)+'</b> — Tegangan: <b>'+((s.state.active.has(c.id)?current(c.id)*c.value:0)).toFixed(2)+' V</b> | Arus: <b>'+current(c.id).toFixed(3)+' A</b>'+
 (s.state.active.has(c.id)?' • aktif':' • mati')+'</div>').join('');
 render();
}

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}function toast(t){let x=document.getElementById('toast');x.textContent=t;x.style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>x.style.display='none',1500)}render();editor();calc();

// V9: geser canvas rangkaian dengan tombol tengah mouse atau Space + drag.
board.addEventListener('pointerdown',function(e){
 if(e.target.closest('.component,.junction,.terminal,button,input')) return;
 if(e.button===1 || spaceDown){
   pan={x:e.clientX,y:e.clientY,sx:board.scrollLeft,sy:board.scrollTop};
   board.classList.add('panning'); e.preventDefault();
 }
});
window.addEventListener('pointermove',function(e){
 if(!pan)return;
 board.scrollLeft=pan.sx-(e.clientX-pan.x);
 board.scrollTop=pan.sy-(e.clientY-pan.y);
});
window.addEventListener('pointerup',function(){
 if(pan){pan=null;board.classList.remove('panning')}
});
window.addEventListener('keydown',function(e){if(e.code==='Space')spaceDown=true});
window.addEventListener('keyup',function(e){if(e.code==='Space')spaceDown=false});
