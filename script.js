const B=document.getElementById("board"),WSP=document.getElementById("workspace"),SVG=document.getElementById("wireLayer");
let components=[],wires=[],junctions=[],selected=null,selectedJunction=null,selectedWire=null,tool="select",startTerminal=null,drag=null,nextId=1,running=false;

const defaults={
 battery:{icon:"🔋",name:"Baterai",value:12,unit:"V"},
 resistor:{icon:"▱",name:"Resistor",value:6,unit:"Ω"},
 lamp:{icon:"💡",name:"Lampu",value:6,unit:"Ω"},
 switch:{icon:"⏻",name:"Saklar",value:1,unit:"",state:true},
 voltmeter:{icon:"Ⓥ",name:"Voltmeter",value:0,unit:"V"},
 ammeter:{icon:"Ⓐ",name:"Amperemeter",value:0,unit:"A"}
};

document.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>addComponent(b.dataset.type));
document.getElementById("wireModeBtn").onclick=()=>setTool("connect");
document.getElementById("junctionBtn").onclick=addJunction;
document.querySelector(".bottom-tools").addEventListener("click", e=>{
  const btn=e.target.closest("button");
  if(!btn) return;
  if(btn.id==="selectTool") setTool("select");
  else if(btn.id==="connectTool") setTool("connect");
  else if(btn.id==="cutTool") setTool("cut");
  else if(btn.id==="deleteTool") setTool("delete");
  else if(btn.id==="rotateTool") rotateSelected();
});
document.getElementById("clearBtn").onclick=clearAll;
document.getElementById("resetBtn").onclick=clearAll;
document.getElementById("runBtn").onclick=()=>{running=true;calculate()};
document.getElementById("stopBtn").onclick=()=>{running=false;calculate()};
document.getElementById("batteryInput").oninput=()=>{
  const b=components.find(c=>c.type==="battery");
  if(b){b.value=Number(document.getElementById("batteryInput").value)||12;calculate()}
};
document.getElementById("saveBtn").onclick=()=>{
  localStorage.setItem("mediaRangkaianV3",JSON.stringify({components,wires,junctions}));
  message("Rangkaian tersimpan di browser.");
};

function addComponent(type){
  const d=defaults[type], n=components.filter(c=>c.type===type).length+1;
  const c={id:nextId++,type,name:type==="battery"?d.name:d.name+" "+n,value:d.value,unit:d.unit,state:d.state??true,rot:0,
           x:70+(components.length%7)*220,y:90+Math.floor(components.length/7)*150};
  components.push(c);selected=c.id;selectedJunction=null;
  const loadedBattery=components.find(c=>c.type==="battery");if(loadedBattery)document.getElementById("batteryInput").value=loadedBattery.value;
render();updateEditor();calculate();
}
function addJunction(){
  const cols=7, gapX=230, gapY=130;
  const j={id:"j"+nextId++,x:90+(junctions.length%cols)*gapX,y:150+Math.floor(junctions.length/cols)*gapY};
  junctions.push(j);selectedJunction=j.id;selected=null;setTool("select");render();message("Titik percabangan dibuat. Bisa digeser."); 
}
function setTool(t){tool=t;startTerminal=null;selectedWire=null;render()}
function terminalKey(id,side){return id+":"+side}
function getPoint(key){
  const [id,side]=key.split(":");
  const c=components.find(x=>String(x.id)===id);
  if(c){
    const a=(c.rot||0)*Math.PI/180;
    const cx=c.x+60, cy=c.y+44;
    const lx=side==="L"?-60:60;
    return {x:cx+lx*Math.cos(a),y:cy+lx*Math.sin(a)};
  }
  const j=junctions.find(x=>x.id===id);
  if(j)return{x:j.x,y:j.y};
  return null;
}
function connect(a,b){
  if(!a||!b||a===b)return;
  if(!wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a)))
    wires.push({id:"w"+Date.now()+Math.random(),a,b});
}
function onTerminal(e){
  e.stopPropagation();
  if(tool!=="connect")return;
  const k=e.currentTarget.dataset.key;
  if(!startTerminal){startTerminal=k;render();message("Terminal pertama dipilih. Pilih terminal kedua.");return}
  connect(startTerminal,k);startTerminal=null;render();calculate();
}
function render(){
  document.querySelectorAll(".component,.junction").forEach(e=>e.remove());
  components.forEach(c=>{
    const e=document.createElement("div");
    const lampOn=c.type==="lamp"&&running&&componentCurrent(c.id)>0.0001;
    e.className="component"+(selected===c.id?" selected ":" ")+(lampOn?" lampOn ":" ")+(c.type==="switch"&&c.state?" switchOn":"");
    e.dataset.id=c.id;e.style.left=c.x+"px";e.style.top=c.y+"px";e.style.transform="rotate("+(c.rot||0)+"deg)";
    e.innerHTML=`<div class="terminal left" data-key="${terminalKey(c.id,"L")}"></div>
      <div class="terminal right" data-key="${terminalKey(c.id,"R")}"></div>
      <div class="title">${escapeHtml(c.name)}</div>
      <div class="visual">${c.icon||defaults[c.type].icon}</div>
      <div class="value">${c.type==="switch"?(c.state?"ON":"OFF"):c.value+" "+c.unit}</div>`;
    e.querySelectorAll(".terminal").forEach(t=>t.onclick=onTerminal);
    e.onpointerdown=e2=>startComponentDrag(e2,c);
    e.ondblclick=()=>{if(c.type==="switch"){c.state=!c.state;render();updateEditor();calculate()}};
    e.onclick=e2=>{if(e2.target.classList.contains("terminal"))return;if(tool==="delete")deleteComponent(c.id);else if(tool==="select"){selected=c.id;selectedJunction=null;updateEditor();render()}};
    WSP.appendChild(e);
  });
  junctions.forEach(j=>{
    const e=document.createElement("div");
    e.className="junction"+(selectedJunction===j.id?" selected":"");
    e.style.left=j.x+"px";e.style.top=j.y+"px";e.dataset.jid=j.id;
    e.title="Titik percabangan — bisa dipindahkan";
    e.onpointerdown=e2=>startJunctionDrag(e2,j);
    e.onclick=e2=>{e2.stopPropagation();if(tool==="delete")deleteJunction(j.id);else if(tool==="connect")onJunctionConnect(j);else{selectedJunction=j.id;selected=null;render()}};
    WSP.appendChild(e);
  });
  drawWires();
  document.getElementById("empty").style.display=components.length?"none":"block";
}
function startComponentDrag(e,c){
  if(tool!=="select"||e.target.classList.contains("terminal"))return;
  selected=c.id;selectedJunction=null;updateEditor();
  const r=B.getBoundingClientRect();
  drag={kind:"component",obj:c,ox:e.clientX-r.left+B.scrollLeft-c.x,oy:e.clientY-r.top+B.scrollTop-c.y};
}
function startJunctionDrag(e,j){
  if(tool!=="select")return;
  e.stopPropagation();selectedJunction=j.id;selected=null;
  const r=B.getBoundingClientRect();
  drag={kind:"junction",obj:j,ox:e.clientX-r.left+B.scrollLeft-j.x,oy:e.clientY-r.top+B.scrollTop-j.y};
}
B.addEventListener("pointermove",e=>{
  if(!drag)return;
  const r=B.getBoundingClientRect();
  if(drag.kind==="component"){
    drag.obj.x=Math.max(5,Math.min(1800-125,e.clientX-r.left+B.scrollLeft-drag.ox));
    drag.obj.y=Math.max(5,Math.min(1100-92,e.clientY-r.top+B.scrollTop-drag.oy));
  }else{
    drag.obj.x=Math.max(5,Math.min(1800-5,e.clientX-r.left+B.scrollLeft-drag.ox));
    drag.obj.y=Math.max(5,Math.min(1100-5,e.clientY-r.top+B.scrollTop-drag.oy));
  }
  render();
});
window.addEventListener("pointerup",()=>drag=null);

function onJunctionConnect(j){
  const k=j.id+":J";
  if(!startTerminal){startTerminal=k;render();message("Titik percabangan dipilih. Pilih terminal/titik lain.");}
  else{connect(startTerminal,k);startTerminal=null;render();calculate()}
}
function drawWires(){
  SVG.innerHTML="";
  wires.forEach(w=>{
    const a=getPoint(w.a),b=getPoint(w.b);if(!a||!b)return;
    const line=document.createElementNS("http://www.w3.org/2000/svg","path");
    const mx=(a.x+b.x)/2;
    line.setAttribute("d",`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`);
    line.dataset.id=w.id;line.classList.add("wire");
    if(selectedWire===w.id)line.classList.add("selected");
    if(running&&wireCarriesCurrent(w))line.classList.add("power");
    line.onclick=e=>{
      e.stopPropagation();
      if(tool==="cut"){wires=wires.filter(x=>x.id!==w.id);selectedWire=null;render();calculate();return}
      selectedWire=w.id;render();message("Kabel dipilih. Gunakan mode Putus Kabel untuk memutusnya.");
    };
    SVG.appendChild(line);
  });
  if(startTerminal){
    const p=getPoint(startTerminal);
    if(p){
      const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",p.x);c.setAttribute("cy",p.y);c.setAttribute("r",8);c.setAttribute("fill","#ff9800");SVG.appendChild(c);
    }
  }
}
function deleteComponent(id){
  components=components.filter(c=>c.id!==id);
  wires=wires.filter(w=>!w.a.startsWith(id+":")&&!w.b.startsWith(id+":"));
  if(selected===id)selected=null;const loadedBattery=components.find(c=>c.type==="battery");if(loadedBattery)document.getElementById("batteryInput").value=loadedBattery.value;
render();updateEditor();calculate();
}
function deleteJunction(id){
  junctions=junctions.filter(j=>j.id!==id);
  wires=wires.filter(w=>!w.a.startsWith(id+":")&&!w.b.startsWith(id+":"));
  selectedJunction=null;render();calculate();
}
function clearAll(){if(confirm("Hapus semua komponen, titik percabangan, dan kabel?")){components=[];wires=[];junctions=[];selected=null;selectedJunction=null;render();updateEditor();calculate()}}
function updateEditor(){
  const c=components.find(x=>x.id===selected),none=document.getElementById("nonePanel"),ed=document.getElementById("editor");
  if(!c){none.hidden=false;ed.hidden=true;return}
  none.hidden=true;ed.hidden=false;
  const cur=(c.type==="lamp"||c.type==="resistor")?componentCurrent(c.id):0;
  const volt=(c.type==="lamp"||c.type==="resistor")?componentVoltage(c.id):0;
  ed.innerHTML=`<div class="bigIcon">${defaults[c.type].icon}</div>
  <b>${escapeHtml(c.name)}</b>
  <label>Nama<input id="editName" value="${escapeHtml(c.name)}"></label>
  <label>${c.type==="battery"?"Tegangan (V)":"Nilai ("+c.unit+")"}<input id="editValue" type="number" value="${c.value}" ${c.type==="switch"?"disabled":""}></label>
  <label>Sudut Putar (°)<input id="editAngle" type="number" min="0" max="360" step="1" value="${c.rot||0}"></label>
  ${c.type==="switch"?`<button id="toggleSwitch">${c.state?"Matikan":"Nyalakan"} Saklar</button>`:""}
  <button id="applyEdit">Terapkan</button><button id="turn90">Putar 90°</button><button id="removeEdit" class="danger">Hapus Komponen</button>
  ${(c.type==="lamp"||c.type==="resistor")?`<p>Tegangan: <b>${volt.toFixed(2)} V</b><br>Arus: <b>${cur.toFixed(3)} A</b></p>`:""}
  ${c.type==="lamp"?`<p>${running&&cur>0.0001?"💡 Lampu menyala":"○ Lampu mati"}</p>`:""}`;
  document.getElementById("applyEdit").onclick=()=>{
    c.name=document.getElementById("editName").value||c.name;
    if(c.type!=="switch")c.value=Math.max(0.1,Number(document.getElementById("editValue").value)||c.value);
    c.rot=Math.max(0,Math.min(360,Number(document.getElementById("editAngle").value)||0));
    if(c.type==="battery")document.getElementById("batteryInput").value=c.value;
    const loadedBattery=components.find(c=>c.type==="battery");if(loadedBattery)document.getElementById("batteryInput").value=loadedBattery.value;
render();updateEditor();calculate();
  };
  document.getElementById("turn90").onclick=()=>{
    c.rot=((c.rot||0)+90)%360;
    const loadedBattery=components.find(c=>c.type==="battery");if(loadedBattery)document.getElementById("batteryInput").value=loadedBattery.value;
render();updateEditor();calculate();
    message("Komponen diputar "+c.rot+"°.");
  };
  document.getElementById("removeEdit").onclick=()=>deleteComponent(c.id);
  const sw=document.getElementById("toggleSwitch");
  if(sw)sw.onclick=()=>{c.state=!c.state;render();updateEditor();calculate()};
}

function buildNodes(){
  const parent={};
  const find=x=>{parent[x]??=x;return parent[x]===x?x:(parent[x]=find(parent[x]))};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
  const all=[];
  components.forEach(c=>{all.push(c.id+":L",c.id+":R")});
  junctions.forEach(j=>all.push(j.id+":J"));
  all.forEach(x=>parent[x]=x);
  wires.forEach(w=>union(w.a,w.b));
  const node={};all.forEach(x=>node[x]=find(x));
  return node;
}
function activeComponents(){return components.filter(c=>c.type==="resistor"||c.type==="lamp"||c.type==="switch")}
function solveCircuit(){
  const battery=components.find(c=>c.type==="battery");
  if(!battery)return {ok:false,reason:"Tambahkan baterai."};
  const node=buildNodes();
  const p=node[battery.id+":R"], n=node[battery.id+":L"];
  if(p===undefined||n===undefined||p===n)return {ok:false,reason:"Terminal baterai belum terhubung dengan benar."};
  const conductive=(c)=>c.type!=="switch"||c.state;
  const graph={};
  Object.keys(node).forEach(k=>{graph[node[k]]??=new Set()});
  components.filter(conductive).forEach(c=>{
    if(c.type==="battery"||c.type==="voltmeter"||c.type==="ammeter")return;
    const a=node[c.id+":L"],b=node[c.id+":R"];if(a!==undefined&&b!==undefined){graph[a].add(b);graph[b].add(a)}
  });
  // voltage-source terminals must be connected through a conducting load path
  const q=[p],seen=new Set(q);
  while(q.length){const x=q.shift();for(const y of graph[x]||[]){if(!seen.has(y)){seen.add(y);q.push(y)}}}
  if(!seen.has(n))return {ok:false,reason:"Rangkaian belum tertutup. Hubungkan jalur dari (+) baterai kembali ke (−)."};
  const nodes=[...new Set(Object.values(node))].filter(x=>x!==n&&x!==p);
  const index=new Map(nodes.map((x,i)=>[x,i]));
  const N=nodes.length,A=Array.from({length:N},()=>Array(N).fill(0)),z=Array(N).fill(0);
  function addG(a,b,g){
    if(a!==n&&a!==p){A[index.get(a)][index.get(a)]+=g;if(b===p)z[index.get(a)]+=g*battery.value;else if(b!==n)A[index.get(a)][index.get(b)]-=g}
    if(b!==n&&b!==p){A[index.get(b)][index.get(b)]+=g;if(a===p)z[index.get(b)]+=g*battery.value;else if(a!==n)A[index.get(b)][index.get(a)]-=g}
  }
  const conductors=[];
  components.forEach(c=>{
    if(c.type==="resistor"||c.type==="lamp"||(c.type==="switch"&&c.state)){
      const a=node[c.id+":L"],b=node[c.id+":R"];
      const r=c.type==="switch"?1e-6:Math.max(.1,c.value);
      addG(a,b,1/r);conductors.push({c,a,b,r});
    }
  });
  function gauss(M,y){
    const m=M.map((row,i)=>row.slice().concat(y[i]));
    for(let col=0;col<m.length;col++){
      let piv=col;for(let r=col+1;r<m.length;r++)if(Math.abs(m[r][col])>Math.abs(m[piv][col]))piv=r;
      if(Math.abs(m[piv][col])<1e-10)return null;
      [m[col],m[piv]]=[m[piv],m[col]];
      for(let r=col+1;r<m.length;r++){const f=m[r][col]/m[col][col];for(let j=col;j<=m.length;j++)m[r][j]-=f*m[col][j]}
    }
    const x=Array(m.length).fill(0);
    for(let i=m.length-1;i>=0;i--){let s=m[i][m.length];for(let j=i+1;j<m.length;j++)s-=m[i][j]*x[j];x[i]=s/m[i][i]}
    return x;
  }
  const V=Array(N).fill(0);if(N){const sol=gauss(A,z);if(!sol)return {ok:false,reason:"Rangkaian memiliki simpul mengambang atau hubungan yang belum valid."};nodes.forEach((x,i)=>V[i]=sol[i])}
  const voltage=k=>k===p?battery.value:(k===n?0:(index.has(k)?V[index.get(k)]:0));
  const currents={};conductors.forEach(o=>{currents[o.c.id]=(voltage(o.a)-voltage(o.b))/o.r});
  let total=0;conductors.filter(o=>o.c.type!=="switch").forEach(o=>{if(o.a===p)total+=Math.abs(currents[o.c.id]);});
  // Better total current: sum current leaving positive battery node
  total=conductors.reduce((s,o)=>s+(o.a===p?currents[o.c.id]:o.b===p?-currents[o.c.id]:0),0);
  return {ok:true,battery,nodes,node,voltage,currents,total};
}
function componentCurrent(id){const s=solveCircuit();return s.ok?Math.abs(s.currents[id]||0):0}
function componentVoltage(id){const s=solveCircuit();if(!s.ok)return 0;const c=components.find(x=>x.id===id);if(!c)return 0;const node=s.node;const a=node[c.id+":L"],b=node[c.id+":R"];return Math.abs(s.voltage(a)-s.voltage(b))}
function wireCarriesCurrent(w){
  const s=solveCircuit();if(!s.ok)return false;
  const connectedIds=new Set([w.a.split(":")[0],w.b.split(":")[0]]);
  return [...connectedIds].some(id=>Math.abs(s.currents[id]||0)>0.0001);
}
function calculate(){
  const s=solveCircuit(),box=document.getElementById("results");
  if(!s.ok){box.innerHTML="<div>"+escapeHtml(s.reason)+"</div>";render();return}
  const loads=components.filter(c=>c.type==="resistor"||c.type==="lamp");
  const totalR=s.battery.value/Math.max(1e-12,Math.abs(s.total));
  const branch=loads.map(c=>`<div><b>${escapeHtml(c.name)}</b> — Tegangan: <b>${componentVoltage(c.id).toFixed(2)} V</b> | Arus: <b>${componentCurrent(c.id).toFixed(3)} A</b>${c.type==="lamp"?(componentCurrent(c.id)>0.0001?" • 💡 Menyala":" • ○ Mati"):""}</div>`).join("");
  box.innerHTML=`<div>Tegangan sumber: <b>${s.battery.value.toFixed(2)} V</b></div>
  <div>Hambatan Total (R<sub>T</sub>): <b>${totalR.toFixed(2)} Ω</b></div>
  <div>Arus Total (I): <b>${Math.abs(s.total).toFixed(3)} A</b></div>
  <hr><b>Tegangan & arus tiap komponen</b>${branch||"<div>Belum ada resistor/lampu.</div>"}`;
  render();
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function message(t){const m=document.getElementById("message");m.textContent=t;m.style.display="block";clearTimeout(window.mt);window.mt=setTimeout(()=>m.style.display="none",1800)}
const saved=localStorage.getItem("mediaRangkaianV3");
if(saved){try{const d=JSON.parse(saved);components=d.components||[];wires=d.wires||[];junctions=d.junctions||[];nextId=Math.max(1,...components.map(c=>Number(c.id)||0))+1}catch(e){}}
const loadedBattery=components.find(c=>c.type==="battery");if(loadedBattery)document.getElementById("batteryInput").value=loadedBattery.value;
render();updateEditor();calculate();
