/* Simulasi Rangkaian Listrik - versi revisi
   Solver DC menggunakan Modified Nodal Analysis untuk jaringan resistor/lampu
   dengan satu baterai. Kabel adalah objek individual dan dapat diputus. */
const canvas=document.getElementById('canvas'), wireLayer=document.getElementById('wireLayer');
const editor=document.getElementById('componentEditor'), results=document.getElementById('results');
let comps=[], wires=[], junctions=[], selectedId=null, selectedWireId=null, tool='select', firstTerminal=null, running=false, nextId=1, drag=null;
const DEF={battery:{name:'Baterai',value:12,unit:'V',icon:'🔋'},resistor:{name:'Resistor',value:6,unit:'Ω',icon:'▰'},lamp:{name:'Lampu',value:6,unit:'Ω',icon:'💡'},switch:{name:'Saklar',value:1,unit:'',icon:'⏻'},voltmeter:{name:'Voltmeter',value:0,unit:'V',icon:'V'},ammeter:{name:'Amperemeter',value:0,unit:'A',icon:'A'}};

document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addComponent(b.dataset.add)));
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');calculate()}));
document.getElementById('wirePalette').onclick=()=>setTool('connect');
document.getElementById('junctionPalette').onclick=addJunction;
document.getElementById('selectTool').onclick=()=>setTool('select');
document.getElementById('connectTool').onclick=()=>setTool('connect');
document.getElementById('cutTool').onclick=()=>setTool('cut');
document.getElementById('deleteTool').onclick=()=>setTool('delete');
document.getElementById('clearBtn').onclick=clearAll;
document.getElementById('resetBtn').onclick=clearAll;
document.getElementById('runBtn').onclick=()=>{running=true;calculate()};
document.getElementById('stopBtn').onclick=()=>{running=false;calculate()};
document.getElementById('saveBtn').onclick=()=>{localStorage.setItem('rangkaianListrikRevisi',JSON.stringify({comps,wires,junctions}));toast('Rangkaian tersimpan di browser.')};
document.getElementById('batteryVoltage').oninput=()=>{const b=comps.find(c=>c.type==='battery');if(b){b.value=Math.max(0.1,Number(document.getElementById('batteryVoltage').value)||12);render();calculate()}};

function addComponent(type){
 const d=DEF[type], count=comps.filter(c=>c.type===type).length+1;
 const c={id:nextId++,type,name:type==='battery'?d.name:d.name+' '+count,value:d.value,unit:d.unit,icon:d.icon,state:true,x:70+(comps.length%5)*145,y:90+Math.floor(comps.length/5)*125};
 comps.push(c);selectedId=c.id;if(type==='battery')document.getElementById('batteryVoltage').value=c.value;
 render();updateEditor();calculate();
}
function addJunction(){
 junctions.push({id:'j'+nextId++,x:280+(junctions.length%4)*160,y:330+Math.floor(junctions.length/4)*120});
 render();
}
function setTool(t){tool=t;firstTerminal=null;selectedWireId=null;render();toast(t==='connect'?'Klik terminal pertama lalu terminal kedua.':t==='cut'?'Klik kabel yang ingin diputus.':t==='delete'?'Klik komponen yang ingin dihapus.':'Mode pilih/pindah aktif.')}
function terminalKey(id,side){return String(id)+':'+side}
function positionOf(key){
 const [id,side]=String(key).split(':');
 const c=comps.find(x=>String(x.id)===id);
 if(c)return {x:c.x+(side==='L'?0:122),y:c.y+45};
 const j=junctions.find(x=>x.id===id);
 return j?{x:j.x,y:j.y}:null;
}
function addWire(a,b){
 if(!a||!b||a===b)return;
 if(!wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))wires.push({id:'w'+nextId++,a,b});
}
function onTerminal(e){
 e.stopPropagation();
 if(tool!=='connect')return;
 const k=e.currentTarget.dataset.key;
 if(!firstTerminal){firstTerminal=k;toast('Terminal pertama dipilih. Pilih terminal kedua.')}
 else{addWire(firstTerminal,k);firstTerminal=null;toast('Kabel dibuat.');calculate()}
 render();
}
function onWire(e){
 e.stopPropagation();
 const id=e.target.dataset.wire;
 if(tool==='cut'){wires=wires.filter(w=>w.id!==id);selectedWireId=null;calculate();return}
 selectedWireId=id;render();
}
function render(){
 document.querySelectorAll('.component,.junction').forEach(e=>e.remove());
 comps.forEach(c=>{
   const el=document.createElement('div');
   const powered=running&&c.type==='lamp'&&lampIsPowered(c.id);
   el.className='component'+(selectedId===c.id?' selected ':' ')+(powered?' lit':'')+(c.type==='switch'&&!c.state?' off':'');
   el.style.left=c.x+'px';el.style.top=c.y+'px';el.dataset.id=c.id;
   let visual=c.type==='voltmeter'||c.type==='ammeter'?`<span class="meter ${c.type==='ammeter'?'green':''}">${c.icon}</span>`:c.icon;
   el.innerHTML=`<div class="terminal L" data-key="${terminalKey(c.id,'L')}"></div><div class="terminal R" data-key="${terminalKey(c.id,'R')}"></div><div class="title">${escapeHtml(c.name)}</div><div class="visual">${visual}</div><div class="value">${c.type==='switch'?(c.state?'ON':'OFF'):(c.value+' '+c.unit)}</div>`;
   el.querySelectorAll('.terminal').forEach(t=>t.addEventListener('click',onTerminal));
   el.addEventListener('click',e=>{if(e.target.classList.contains('terminal'))return;if(tool==='delete'){deleteComponent(c.id)}else if(tool==='select'){selectedId=c.id;updateEditor();render()}});
   el.addEventListener('dblclick',()=>{if(c.type==='switch'){c.state=!c.state;calculate()}});
   el.addEventListener('pointerdown',e=>startDrag(e,c));
   canvas.appendChild(el);
 });
 junctions.forEach(j=>{
   const el=document.createElement('div');el.className='junction';el.style.left=j.x+'px';el.style.top=j.y+'px';
   el.title='Titik percabangan — seret untuk memindahkan';el.dataset.key=j.id+':J';
   el.addEventListener('pointerdown',e=>{
     e.stopPropagation();
     if(tool==='select'){
       const r=canvas.getBoundingClientRect();
       drag={junction:j,ox:e.clientX-r.left-j.x,oy:e.clientY-r.top-j.y};
       el.setPointerCapture?.(e.pointerId);
       return;
     }
   });
   el.addEventListener('click',e=>{
     e.stopPropagation();
     if(tool==='connect'){
       if(!firstTerminal)firstTerminal=j.id+':J';
       else{addWire(firstTerminal,j.id+':J');firstTerminal=null;calculate()}
       render();
     }else if(tool==='delete'){
       junctions=junctions.filter(x=>x.id!==j.id);
       wires=wires.filter(w=>w.a!==j.id+':J'&&w.b!==j.id+':J');
       render();calculate();
     }
   });
   canvas.appendChild(el);
 });
 drawWires();
 document.getElementById('hint').style.display=comps.length?'none':'block';
}
function startDrag(e,c){
 if(tool!=='select'||e.target.classList.contains('terminal'))return;
 selectedId=c.id;updateEditor();
 const r=canvas.getBoundingClientRect();
 drag={c,ox:e.clientX-r.left-c.x,oy:e.clientY-r.top-c.y};
 e.currentTarget.setPointerCapture?.(e.pointerId);
}
canvas.addEventListener('pointermove',e=>{
 if(!drag)return;
 const r=canvas.getBoundingClientRect();
 if(drag.c){
   drag.c.x=Math.max(3,Math.min(canvas.clientWidth-125,e.clientX-r.left-drag.ox));
   drag.c.y=Math.max(3,Math.min(canvas.clientHeight-93,e.clientY-r.top-drag.oy));
 }else if(drag.junction){
   drag.junction.x=Math.max(8,Math.min(canvas.clientWidth-8,e.clientX-r.left-drag.ox));
   drag.junction.y=Math.max(8,Math.min(canvas.clientHeight-8,e.clientY-r.top-drag.oy));
 }
 render();
});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('pointercancel',()=>drag=null);
function drawWires(){
 wireLayer.innerHTML='';
 wires.forEach(w=>{
   const a=positionOf(w.a),b=positionOf(w.b);if(!a||!b)return;
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');
   line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);
   line.dataset.wire=w.id;line.classList.add('wire');
   if(selectedWireId===w.id)line.classList.add('selected');
   if(running&&wireCarriesCurrent(w))line.classList.add('live');
   line.addEventListener('click',onWire);wireLayer.appendChild(line);
 });
 if(firstTerminal){const p=positionOf(firstTerminal);if(p){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',8);circle.setAttribute('fill','#ff9800');wireLayer.appendChild(circle)}}
}
function updateEditor(){
 const c=comps.find(x=>x.id===selectedId);
 if(!c){editor.innerHTML='Pilih komponen di area kerja.';return}
 editor.innerHTML=`<div class="preview">${c.type==='lamp'?'💡':c.icon}</div><h3>${escapeHtml(c.name)}</h3>
 <label>Nama<input id="editName" value="${escapeAttr(c.name)}"></label>
 ${c.type==='switch'?`<p>Status: <b>${c.state?'Hidup':'Mati'}</b></p>`:`<label>${c.type==='battery'?'Tegangan (V)':'Hambatan (Ω)'}<input id="editValue" type="number" min="0.1" step="0.1" value="${c.value}"></label>`}
 <button id="applyEdit">Terapkan</button>${c.type==='switch'?`<button id="toggleSwitch">${c.state?'Matikan':'Nyalakan'} Saklar</button>`:''}
 <button class="danger" id="deleteSelected">Hapus Komponen</button>
 ${c.type==='lamp'?`<p class="state ${running&&lampIsPowered(c.id)?'on':'off'}">${running&&lampIsPowered(c.id)?'● Lampu menyala':'● Lampu mati'}</p>`:''}`;
 document.getElementById('applyEdit').onclick=()=>{
   c.name=document.getElementById('editName').value||c.name;
   if(c.type!=='switch')c.value=Math.max(.1,Number(document.getElementById('editValue').value)||c.value);
   if(c.type==='battery')document.getElementById('batteryVoltage').value=c.value;
   render();updateEditor();calculate();
 };
 const t=document.getElementById('toggleSwitch');if(t)t.onclick=()=>{c.state=!c.state;render();updateEditor();calculate()};
 document.getElementById('deleteSelected').onclick=()=>deleteComponent(c.id);
}
function deleteComponent(id){comps=comps.filter(c=>c.id!==id);removeWiresFor(id);if(selectedId===id)selectedId=null;render();updateEditor();calculate()}
function removeWiresFor(id){wires=wires.filter(w=>!String(w.a).startsWith(id+':')&&!String(w.b).startsWith(id+':'))}
function clearAll(){if(confirm('Hapus semua komponen dan kabel?')){comps=[];wires=[];junctions=[];selectedId=null;selectedWireId=null;firstTerminal=null;running=false;render();updateEditor();calculate()}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(s){return escapeHtml(s)}

function unionFind(n){const p=Array.from({length:n},(_,i)=>i);function f(a){while(p[a]!==a){p[a]=p[p[a]];a=p[a]}return a}return {find:f,union:(a,b)=>{a=f(a);b=f(b);if(a!==b)p[b]=a}}}
function buildNodes(){
 const terms=[];comps.forEach(c=>{terms.push(terminalKey(c.id,'L'),terminalKey(c.id,'R'))});junctions.forEach(j=>terms.push(j.id+':J'));
 const idx=new Map(terms.map((x,i)=>[x,i])), uf=unionFind(terms.length);
 wires.forEach(w=>{if(idx.has(w.a)&&idx.has(w.b))uf.union(idx.get(w.a),idx.get(w.b))});
 // closed switch is a zero-ohm connection
 comps.filter(c=>c.type==='switch'&&c.state).forEach(c=>uf.union(idx.get(terminalKey(c.id,'L')),idx.get(terminalKey(c.id,'R'))));
 const roots=new Map(), nodeOf={};let k=0;
 terms.forEach(t=>{const r=uf.find(idx.get(t));if(!roots.has(r))roots.set(r,k++);nodeOf[t]=roots.get(r)});
 return {nodeOf,count:k};
}
function gaussian(A,b){
 const n=b.length;
 for(let col=0;col<n;col++){
   let pivot=col;for(let r=col+1;r<n;r++)if(Math.abs(A[r][col])>Math.abs(A[pivot][col]))pivot=r;
   if(Math.abs(A[pivot][col])<1e-10)return null;
   [A[pivot],A[col]]=[A[col],A[pivot]];[b[pivot],b[col]]=[b[col],b[pivot]];
   const div=A[col][col];for(let j=col;j<n;j++)A[col][j]/=div;b[col]/=div;
   for(let r=0;r<n;r++){if(r===col)continue;const f=A[r][col];if(Math.abs(f)<1e-12)continue;for(let j=col;j<n;j++)A[r][j]-=f*A[col][j];b[r]-=f*b[col]}
 }
 return b;
}
function solveCircuit(){
 const battery=comps.find(c=>c.type==='battery');if(!battery)return {ok:false,msg:'Tambahkan baterai.'};
 const {nodeOf,count}=buildNodes();
 const p=terminalKey(battery.id,'L'),n=terminalKey(battery.id,'R');
 const pn=nodeOf[p], nn=nodeOf[n];
 if(pn===nn)return {ok:false,msg:'Rangkaian mengalami hubung singkat. Periksa kabel.'};
 // active resistive components only; switches are already merged
 const loads=comps.filter(c=>c.type==='resistor'||c.type==='lamp');
 const N=count, M=1, size=N+M, A=Array.from({length:size},()=>Array(size).fill(0)), b=Array(size).fill(0);
 // negative battery node is ground (force its voltage = 0)
 // To avoid floating-node singularities, solve only if every relevant node connects through loads/source.
 loads.forEach(c=>{
   const a=nodeOf[terminalKey(c.id,'L')],d=nodeOf[terminalKey(c.id,'R')],R=Math.max(.01,Number(c.value)||1),g=1/R;
   A[a][a]+=g;A[d][d]+=g;A[a][d]-=g;A[d][a]-=g;
 });
 // voltage source: V(pos)-V(neg)=battery.value
 const vs=N;
 A[pn][vs]+=1;A[vs][pn]+=1;A[nn][vs]-=1;A[vs][nn]-=1;b[vs]=Number(battery.value)||12;
 // Fix negative node to 0 by replacing its row, but keep source equations.
 for(let j=0;j<size;j++){A[nn][j]=0} A[nn][nn]=1;b[nn]=0;
 const x=gaussian(A,b);if(!x)return {ok:false,msg:'Rangkaian belum membentuk jalur tertutup.'};
 const voltages=x.slice(0,N);
 const currents={};
 loads.forEach(c=>{const a=voltages[nodeOf[terminalKey(c.id,'L')]],d=voltages[nodeOf[terminalKey(c.id,'R')]];currents[c.id]=(a-d)/Math.max(.01,c.value)});
 const total=Math.abs(x[vs]);
 return {ok:true,voltages,currents,total,battery,batteryNodes:{pos:pn,neg:nn}};
}
function calculate(){
 const mode=document.querySelector('.mode.active')?.dataset.mode||'seri';
 const s=solveCircuit();
 if(!s.ok){results.innerHTML=`<b>${escapeHtml(s.msg)}</b><br><small>Hubungkan terminal positif baterai → komponen → kembali ke terminal negatif. Untuk paralel, buat dua titik percabangan yang terhubung ke jalur atas dan bawah.</small>`;render();return}
 const loads=comps.filter(c=>c.type==='resistor'||c.type==='lamp');
 // equivalent resistance from source voltage / total current
 const V=Math.abs(Number(s.battery.value)||12), I=s.total, Rt=I>1e-9?V/I:Infinity;
 let html=`<div>Tegangan (V) <b class="rightval">: ${V.toFixed(2)} V</b></div><div>Hambatan Total (R<sub>T</sub>) <b class="rightval">: ${Number.isFinite(Rt)?Rt.toFixed(2):'∞'} Ω</b></div><div>Arus Total (I) <b class="rightval">: ${I.toFixed(3)} A</b></div>`;
 if(loads.length){html+='<hr><b>Arus tiap komponen</b>';loads.forEach(c=>{html+=`<div>${escapeHtml(c.name)} (${c.value} Ω) <b class="rightval">: ${Math.abs(s.currents[c.id]||0).toFixed(3)} A</b></div>`})}
 results.innerHTML=html;render();
}
function lampIsPowered(id){const s=solveCircuit();return !!(s.ok&&Math.abs(s.currents[id]||0)>1e-6)}
function wireCarriesCurrent(w){
 // Highlight every wire that belongs to the battery-connected component when running.
 // Exact current direction is not required for visualization.
 if(!running)return false;const s=solveCircuit();if(!s.ok)return false;
 const {nodeOf}=buildNodes();return nodeOf[w.a]!==undefined&&nodeOf[w.b]!==undefined;
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.display='none',1700)}

const saved=localStorage.getItem('rangkaianListrikRevisi');
if(saved){try{const o=JSON.parse(saved);comps=o.comps||[];wires=o.wires||[];junctions=o.junctions||[];nextId=1+Math.max(0,...comps.map(c=>Number(c.id)||0));}catch(e){}}
render();updateEditor();calculate();
