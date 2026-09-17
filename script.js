const BOARD=document.getElementById('board');
const WORKSPACE=document.getElementById('workspace');
const SVG=document.getElementById('wireLayer');
const W=1100, H=680, CW=120, CH=88;

let components=[];
let wires=[];
let junctions=[];
let selected=null;
let selectedJunction=null;
let selectedWire=null;
let tool='select';
let startTerminal=null;
let drag=null;
let nextId=1;
let running=false;

const defaults={
  battery:{icon:'🔋',name:'Baterai',value:12,unit:'V'},
  resistor:{icon:'▱',name:'Resistor',value:6,unit:'Ω'},
  lamp:{icon:'💡',name:'Lampu',value:6,unit:'Ω'},
  switch:{icon:'⏻',name:'Saklar',value:1,unit:'',state:true}
};

// ---------- PALETTE: komponen ditambahkan dengan DRAG, bukan klik ----------
document.querySelectorAll('.item[data-type]').forEach(item=>{
  item.addEventListener('dragstart',e=>{
    e.dataTransfer.setData('text/component-type',item.dataset.type);
    e.dataTransfer.effectAllowed='copy';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend',()=>item.classList.remove('dragging'));
});
WORKSPACE.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});
WORKSPACE.addEventListener('drop',e=>{
  e.preventDefault();
  const type=e.dataTransfer.getData('text/component-type');
  const p=workspacePoint(e.clientX,e.clientY);
  if(type==='junction'){addJunction(p.x,p.y);return;}
  if(!defaults[type])return;
  addComponent(type,p.x-CW/2,p.y-CH/2);
});

// ---------- TOOL ----------
document.getElementById('selectTool').addEventListener('click',()=>setTool('select'));
document.getElementById('connectTool').addEventListener('click',()=>setTool('connect'));
document.getElementById('cutTool').addEventListener('click',()=>setTool('cut'));
document.getElementById('deleteTool').addEventListener('click',()=>setTool('delete'));

document.getElementById('clearBtn').addEventListener('click',resetAll);
document.getElementById('resetBtn').addEventListener('click',resetAll);
document.getElementById('runBtn').addEventListener('click',()=>{running=true;calculate()});
document.getElementById('stopBtn').addEventListener('click',()=>{running=false;calculate()});

document.getElementById('batteryInput').addEventListener('input',e=>{
  const b=components.find(c=>c.type==='battery');
  if(!b)return;
  b.value=clamp(Number(e.target.value)||12,1,24);
  render();updateEditor();calculate();
});

document.getElementById('saveBtn').addEventListener('click',()=>{
  localStorage.setItem('mediaRangkaianV10',JSON.stringify({components,wires,junctions}));
  message('Rangkaian berhasil disimpan di browser.');
});

function setTool(t){
  tool=t;
  startTerminal=null;
  selectedWire=null;
  document.querySelectorAll('.bottom-tools button').forEach(b=>b.classList.remove('active'));
  const map={select:'selectTool',connect:'connectTool',cut:'cutTool',delete:'deleteTool'};
  document.getElementById(map[t]).classList.add('active');
  render();
}

function workspacePoint(clientX,clientY){
  const r=WORKSPACE.getBoundingClientRect();
  return {x:clientX-r.left,y:clientY-r.top};
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function terminalKey(id,side){return String(id)+':'+side}
function nextComponentName(type){
  const n=components.filter(c=>c.type===type).length+1;
  return defaults[type].name+(type==='battery'?'':` ${n}`);
}

function addComponent(type,x=80,y=80){
  const d=defaults[type];
  const c={
    id:nextId++,type,name:nextComponentName(type),value:d.value,unit:d.unit,
    state:d.state===undefined?true:d.state,rot:0,
    x:clamp(x,8,W-CW-8),y:clamp(y,8,H-CH-8)
  };
  components.push(c);
  selected=c.id;selectedJunction=null;
  updateBatteryInput();
  render();updateEditor();calculate();
  message(`${c.name} ditambahkan.`);
}

function addJunction(x=150,y=150){
  const j={id:'j'+nextId++,x:clamp(x,8,W-8),y:clamp(y,8,H-8)};
  junctions.push(j);selectedJunction=j.id;selected=null;setTool('select');
  render();message('Titik percabangan dibuat.');
}

function getPoint(key){
  if(!key)return null;
  const [id,side]=String(key).split(':');
  const c=components.find(x=>String(x.id)===id);
  if(c){
    const a=(c.rot||0)*Math.PI/180;
    const cx=c.x+CW/2,cy=c.y+CH/2;
    const lx=side==='L'?-CW/2:CW/2;
    return {x:cx+lx*Math.cos(a),y:cy+lx*Math.sin(a)};
  }
  const j=junctions.find(x=>x.id===id);
  return j?{x:j.x,y:j.y}:null;
}

function connect(a,b){
  if(!a||!b||a===b)return false;
  if(wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))return false;
  wires.push({id:'w'+nextId++,a,b});
  return true;
}

function onTerminal(e){
  e.stopPropagation();
  if(tool!=='connect')return;
  const k=e.currentTarget.dataset.key;
  if(!startTerminal){startTerminal=k;render();message('Terminal pertama dipilih. Pilih terminal kedua.');return}
  if(startTerminal===k){startTerminal=null;render();return}
  if(connect(startTerminal,k))message('Kabel tersambung.');else message('Kabel tersebut sudah tersambung.');
  startTerminal=null;render();calculate();
}

function onJunctionConnect(j){
  const k=j.id+':J';
  if(!startTerminal){startTerminal=k;render();message('Titik pertama dipilih. Pilih terminal/titik kedua.');return}
  if(connect(startTerminal,k))message('Kabel tersambung.');
  startTerminal=null;render();calculate();
}

// ---------- RENDER ----------
function render(){
  document.querySelectorAll('.component,.junction').forEach(e=>e.remove());

  components.forEach(c=>{
    const e=document.createElement('div');
    const lampOn=c.type==='lamp'&&running&&componentCurrent(c.id)>1e-5;
    e.className='component'+(selected===c.id?' selected':'')+(lampOn?' lampOn':'')+(c.type==='switch'&&c.state?' switchOn':'');
    e.dataset.id=c.id;
    e.style.left=c.x+'px';e.style.top=c.y+'px';e.style.transform=`rotate(${c.rot||0}deg)`;
    e.innerHTML=`
      <div class="terminal left" data-key="${terminalKey(c.id,'L')}"></div>
      <div class="terminal right" data-key="${terminalKey(c.id,'R')}"></div>
      <div class="title">${escapeHtml(c.name)}</div>
      <div class="visual">${defaults[c.type].icon}</div>
      <div class="value">${c.type==='switch'?(c.state?'ON':'OFF'):`${Number(c.value).toFixed(c.type==='battery'?1:0)} ${c.unit}`}</div>`;

    e.querySelectorAll('.terminal').forEach(t=>t.addEventListener('click',onTerminal));
    e.addEventListener('pointerdown',ev=>startComponentDrag(ev,c));
    e.addEventListener('dblclick',ev=>{
      ev.stopPropagation();
      if(c.type==='switch'){c.state=!c.state;render();updateEditor();calculate();}
    });
    e.addEventListener('click',ev=>{
      if(ev.target.classList.contains('terminal'))return;
      if(tool==='delete')deleteComponent(c.id);
      else if(tool==='select'){selected=c.id;selectedJunction=null;updateEditor();render();}
    });
    WORKSPACE.appendChild(e);
  });

  junctions.forEach(j=>{
    const e=document.createElement('div');
    e.className='junction'+(selectedJunction===j.id?' selected':'');
    e.style.left=j.x+'px';e.style.top=j.y+'px';e.dataset.jid=j.id;
    e.addEventListener('pointerdown',ev=>startJunctionDrag(ev,j));
    e.addEventListener('click',ev=>{
      ev.stopPropagation();
      if(tool==='delete')deleteJunction(j.id);
      else if(tool==='connect')onJunctionConnect(j);
      else{selectedJunction=j.id;selected=null;updateEditor();render();}
    });
    WORKSPACE.appendChild(e);
  });

  drawWires();
  document.getElementById('empty').style.display=components.length?'none':'block';
}

function startComponentDrag(e,c){
  if(e.button!==0)return;
  if(e.target.classList.contains('terminal'))return;

  // Dalam mode delete, klik saja menghapus; tidak mulai drag.
  if(tool==='delete')return;
  if(tool==='connect')return;
  if(tool!=='select')return;

  e.preventDefault();e.stopPropagation();
  selected=c.id;selectedJunction=null;updateEditor();
  const p=workspacePoint(e.clientX,e.clientY);
  drag={kind:'component',obj:c,ox:p.x-c.x,oy:p.y-c.y,pointerId:e.pointerId};
  e.currentTarget.setPointerCapture?.(e.pointerId);
}

function startJunctionDrag(e,j){
  if(tool!=='select')return;
  e.preventDefault();e.stopPropagation();
  selectedJunction=j.id;selected=null;updateEditor();
  const p=workspacePoint(e.clientX,e.clientY);
  drag={kind:'junction',obj:j,ox:p.x-j.x,oy:p.y-j.y,pointerId:e.pointerId};
  e.currentTarget.setPointerCapture?.(e.pointerId);
}

WORKSPACE.addEventListener('pointermove',e=>{
  if(!drag)return;
  const p=workspacePoint(e.clientX,e.clientY);
  if(drag.kind==='component'){
    drag.obj.x=clamp(p.x-drag.ox,8,W-CW-8);
    drag.obj.y=clamp(p.y-drag.oy,8,H-CH-8);
  }else{
    drag.obj.x=clamp(p.x-drag.ox,8,W-8);
    drag.obj.y=clamp(p.y-drag.oy,8,H-8);
  }
  render();
});
window.addEventListener('pointerup',()=>{drag=null});

function drawWires(){
  SVG.innerHTML='';
  wires.forEach(w=>{
    const a=getPoint(w.a),b=getPoint(w.b);if(!a||!b)return;
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');
    const mx=(a.x+b.x)/2;
    line.setAttribute('d',`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`);
    line.dataset.id=w.id;line.classList.add('wire');
    if(selectedWire===w.id)line.classList.add('selected');
    if(running&&wireCarriesCurrent(w))line.classList.add('power');
    line.addEventListener('click',e=>{
      e.stopPropagation();
      if(tool==='cut'){
        wires=wires.filter(x=>x.id!==w.id);selectedWire=null;render();calculate();message('Kabel diputus.');return;
      }
      selectedWire=w.id;render();message('Kabel dipilih. Gunakan Putus Kabel untuk memutus.');
    });
    SVG.appendChild(line);
  });
  if(startTerminal){
    const p=getPoint(startTerminal);
    if(p){
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r',8);c.setAttribute('fill','#ff9800');c.setAttribute('pointer-events','none');SVG.appendChild(c);
    }
  }
}

// ---------- DELETE / RESET ----------
function deleteComponent(id){
  components=components.filter(c=>c.id!==id);
  wires=wires.filter(w=>!String(w.a).startsWith(id+':')&&!String(w.b).startsWith(id+':'));
  if(selected===id)selected=null;
  if(startTerminal&&String(startTerminal).startsWith(id+':'))startTerminal=null;
  updateBatteryInput();render();updateEditor();calculate();message('Komponen dihapus.');
}
function deleteJunction(id){
  junctions=junctions.filter(j=>j.id!==id);
  wires=wires.filter(w=>!String(w.a).startsWith(id+':')&&!String(w.b).startsWith(id+':'));
  if(selectedJunction===id)selectedJunction=null;
  if(startTerminal===id+':J')startTerminal=null;
  render();updateEditor();calculate();message('Titik percabangan dihapus.');
}
function resetAll(){
  running=false;startTerminal=null;drag=null;selected=null;selectedJunction=null;selectedWire=null;tool='select';
  components=[];wires=[];junctions=[];nextId=1;
  localStorage.removeItem('mediaRangkaianV10');
  document.getElementById('batteryInput').value=12;
  document.querySelectorAll('.bottom-tools button').forEach(b=>b.classList.remove('active'));
  document.getElementById('selectTool').classList.add('active');
  render();updateEditor();calculate();message('Kanvas berhasil di-reset.');
}

// ---------- EDITOR ----------
function updateBatteryInput(){
  const b=components.find(c=>c.type==='battery');
  document.getElementById('batteryInput').value=b?b.value:12;
}
function updateEditor(){
  const c=components.find(x=>x.id===selected);
  const none=document.getElementById('nonePanel');
  const ed=document.getElementById('editor');
  if(!c){none.hidden=false;ed.hidden=true;return}
  none.hidden=true;ed.hidden=false;
  const cur=(c.type==='lamp'||c.type==='resistor')?componentCurrent(c.id):0;
  const volt=(c.type==='lamp'||c.type==='resistor')?componentVoltage(c.id):0;
  ed.innerHTML=`
    <div class="bigIcon">${defaults[c.type].icon}</div>
    <b>${escapeHtml(c.name)}</b>
    <label>Nama<input id="editName" value="${escapeHtml(c.name)}"></label>
    <label>${c.type==='battery'?'Tegangan (V)':'Nilai ('+c.unit+')'}<input id="editValue" type="number" min="0.1" value="${c.value}" ${c.type==='switch'?'disabled':''}></label>
    <label>Sudut Putar (°)<input id="editAngle" type="number" min="0" max="359" step="1" value="${c.rot||0}"></label>
    ${c.type==='switch'?`<button id="toggleSwitch" type="button">${c.state?'Matikan':'Nyalakan'} Saklar</button>`:''}
    <button id="applyEdit" type="button">Terapkan</button>
    <button id="turn90" type="button">↻ Putar 90°</button>
    <button id="removeEdit" class="danger" type="button">🗑 Hapus Komponen</button>
    ${(c.type==='lamp'||c.type==='resistor')?`<p>Tegangan: <b>${volt.toFixed(2)} V</b><br>Arus: <b>${cur.toFixed(3)} A</b></p>`:''}
    ${c.type==='lamp'?`<p>${running&&cur>0.00001?'💡 Lampu menyala':'○ Lampu mati'}</p>`:''}`;

  document.getElementById('applyEdit').onclick=()=>{
    c.name=document.getElementById('editName').value.trim()||c.name;
    if(c.type!=='switch')c.value=c.type==='battery'?clamp(Number(document.getElementById('editValue').value)||12,1,24):Math.max(.1,Number(document.getElementById('editValue').value)||c.value);
    c.rot=((Number(document.getElementById('editAngle').value)||0)%360+360)%360;
    updateBatteryInput();render();updateEditor();calculate();message('Pengaturan komponen diterapkan.');
  };
  document.getElementById('turn90').onclick=()=>{
    c.rot=((c.rot||0)+90)%360;
    render();updateEditor();calculate();message(`Komponen diputar ${c.rot}°.`);
  };
  document.getElementById('removeEdit').onclick=()=>deleteComponent(c.id);
  const sw=document.getElementById('toggleSwitch');
  if(sw)sw.onclick=()=>{c.state=!c.state;render();updateEditor();calculate();};
}

// ---------- CIRCUIT SOLVER ----------
function buildNodes(){
  const parent={};
  function find(x){
    if(parent[x]===undefined)parent[x]=x;
    if(parent[x]!==x)parent[x]=find(parent[x]);
    return parent[x];
  }
  function union(a,b){const ra=find(a),rb=find(b);if(ra!==rb)parent[rb]=ra;}
  const all=[];
  components.forEach(c=>all.push(c.id+':L',c.id+':R'));
  junctions.forEach(j=>all.push(j.id+':J'));
  all.forEach(find);
  wires.forEach(w=>union(w.a,w.b));
  const node={};all.forEach(x=>node[x]=find(x));
  return node;
}

function solveCircuit(){
  const battery=components.find(c=>c.type==='battery');
  if(!battery)return {ok:false,reason:'Tambahkan baterai ke kanvas.'};
  const node=buildNodes();
  const p=node[battery.id+':R'];
  const n=node[battery.id+':L'];
  if(p===undefined||n===undefined||p===n)return {ok:false,reason:'Kedua terminal baterai tidak boleh tersambung langsung pada node yang sama.'};

  // Cek apakah ada jalur beban dari (+) ke (-). Saklar OFF membuka jalur.
  const graph={};Object.values(node).forEach(k=>{if(!graph[k])graph[k]=new Set()});
  components.forEach(c=>{
    if(c.type!=='resistor'&&c.type!=='lamp'&&c.type!=='switch')return;
    if(c.type==='switch'&&!c.state)return;
    const a=node[c.id+':L'],b=node[c.id+':R'];
    if(a!==undefined&&b!==undefined&&a!==b){graph[a].add(b);graph[b].add(a)}
  });
  const queue=[p],seen=new Set(queue);
  while(queue.length){const x=queue.shift();for(const y of graph[x]||[]){if(!seen.has(y)){seen.add(y);queue.push(y)}}}
  if(!seen.has(n))return {ok:false,reason:'Rangkaian belum tertutup. Hubungkan kembali jalur dari (+) ke (−) baterai.'};

  // Nodal analysis dengan terminal (-) baterai sebagai 0 V dan (+) sebagai Vs.
  const nodes=[...new Set(Object.values(node))].filter(k=>k!==n&&k!==p);
  const index=new Map(nodes.map((k,i)=>[k,i]));
  const N=nodes.length;
  const A=Array.from({length:N},()=>Array(N).fill(0));
  const z=Array(N).fill(0);
  const conductors=[];

  function stampResistor(a,b,R){
    const g=1/Math.max(.000001,R);
    if(a!==n&&a!==p){const ia=index.get(a);A[ia][ia]+=g;if(b===p)z[ia]+=g*battery.value;else if(b!==n)A[ia][index.get(b)]-=g;}
    if(b!==n&&b!==p){const ib=index.get(b);A[ib][ib]+=g;if(a===p)z[ib]+=g*battery.value;else if(a!==n)A[ib][index.get(a)]-=g;}
  }

  components.forEach(c=>{
    if(c.type==='resistor'||c.type==='lamp'||(c.type==='switch'&&c.state)){
      const a=node[c.id+':L'],b=node[c.id+':R'];
      if(a===undefined||b===undefined||a===b)return;
      const R=c.type==='switch'?0.000001:Math.max(.1,Number(c.value)||.1);
      stampResistor(a,b,R);
      conductors.push({c,a,b,R});
    }
  });

  function gauss(M,y){
    if(M.length===0)return [];
    const m=M.map((row,i)=>row.slice().concat(y[i]));
    for(let col=0;col<m.length;col++){
      let piv=col;
      for(let r=col+1;r<m.length;r++)if(Math.abs(m[r][col])>Math.abs(m[piv][col]))piv=r;
      if(Math.abs(m[piv][col])<1e-12)return null;
      [m[col],m[piv]]=[m[piv],m[col]];
      const div=m[col][col];
      for(let j=col;j<=m.length;j++)m[col][j]/=div;
      for(let r=0;r<m.length;r++){
        if(r===col)continue;
        const f=m[r][col];
        if(Math.abs(f)<1e-14)continue;
        for(let j=col;j<=m.length;j++)m[r][j]-=f*m[col][j];
      }
    }
    return m.map(row=>row[m.length]);
  }

  const V={};
  const sol=gauss(A,z);
  if(N&&sol===null)return {ok:false,reason:'Rangkaian belum memiliki hubungan listrik yang valid. Periksa sambungan kabel dan titik percabangan.'};
  nodes.forEach((k,i)=>V[k]=N?sol[i]:0);
  const voltageAt=k=>k===p?battery.value:(k===n?0:(V[k]??0));
  const currents={};
  conductors.forEach(o=>{currents[o.c.id]=(voltageAt(o.a)-voltageAt(o.b))/o.R;});

  let total=0;
  conductors.forEach(o=>{
    if(o.a===p)total+=currents[o.c.id];
    else if(o.b===p)total-=currents[o.c.id];
  });

  return {ok:true,battery,node,voltage:voltageAt,currents,total,conductors};
}

function componentCurrent(id){const s=solveCircuit();return s.ok?Math.abs(s.currents[id]||0):0}
function componentVoltage(id){
  const s=solveCircuit();if(!s.ok)return 0;
  const c=components.find(x=>x.id===id);if(!c)return 0;
  const a=s.node[c.id+':L'],b=s.node[c.id+':R'];
  return Math.abs(s.voltage(a)-s.voltage(b));
}
function wireCarriesCurrent(w){
  const s=solveCircuit();if(!s.ok)return false;
  const ids=[String(w.a).split(':')[0],String(w.b).split(':')[0]];
  return ids.some(id=>Math.abs(s.currents[id]||0)>1e-5);
}

function calculate(){
  const s=solveCircuit();
  const box=document.getElementById('results');
  if(!s.ok){box.innerHTML=`<div>${escapeHtml(s.reason)}</div>`;render();return;}
  const loads=components.filter(c=>c.type==='resistor'||c.type==='lamp');
  const totalI=Math.abs(s.total);
  const totalR=totalI>1e-12?s.battery.value/totalI:Infinity;
  const rows=loads.map(c=>{
    const v=componentVoltage(c.id),i=componentCurrent(c.id);
    return `<div><b>${escapeHtml(c.name)}</b> — Tegangan: <b>${v.toFixed(2)} V</b> | Arus: <b>${i.toFixed(3)} A</b>${c.type==='lamp'?(i>1e-5?' • 💡 Menyala':' • ○ Mati'):''}</div>`;
  }).join('');
  box.innerHTML=`<div>Tegangan sumber: <b>${Number(s.battery.value).toFixed(2)} V</b></div>
  <div>Hambatan Total (R<sub>T</sub>): <b>${Number.isFinite(totalR)?totalR.toFixed(2)+' Ω':'—'}</b></div>
  <div>Arus Total (I): <b>${totalI.toFixed(3)} A</b></div>
  <hr><b>Tegangan & arus tiap komponen</b>${rows||'<div>Belum ada resistor/lampu.</div>'}`;
  render();
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function message(t){const m=document.getElementById('message');m.textContent=t;m.style.display='block';clearTimeout(window.__msgTimer);window.__msgTimer=setTimeout(()=>m.style.display='none',1800)}

// Muat data lama hanya jika strukturnya valid. Reset akan membersihkannya.
try{
  const saved=localStorage.getItem('mediaRangkaianV10');
  if(saved){
    const d=JSON.parse(saved);
    components=Array.isArray(d.components)?d.components.filter(c=>defaults[c.type]).map(c=>({...c,rot:Number(c.rot)||0})):[];
    wires=Array.isArray(d.wires)?d.wires:[];
    junctions=Array.isArray(d.junctions)?d.junctions:[];
    nextId=Math.max(1,...components.map(c=>Number(c.id)||0),...junctions.map(j=>Number(String(j.id).replace('j',''))||0),...wires.map(w=>Number(String(w.id).replace('w',''))||0))+1;
  }
}catch(err){components=[];wires=[];junctions=[];nextId=1}

updateBatteryInput();
render();updateEditor();calculate();
