(function(){
  "use strict";

  const SAMPLE_GCODE = `; Programa Exemplo - G-code Studio
G21 G90 G17 G40 G49
G0 Z10.0
T1 M6 (Fresa Topo Reto 6mm)
S12000 M3
G0 X10 Y10 Z5
G1 Z-2.0 F200
G1 X80 Y10 F600
G1 X80 Y60
G2 X60 Y80 I-20 J0
G1 X10 Y80
G1 X10 Y10
G0 Z10

T2 M6 (Fresa V-Bit Acabamento)
S15000 M3
G0 X45 Y45 Z5
G1 Z-1.5 F150
G3 X45 Y45 I10 J0 F400
G0 Z10
M5 M9
G0 X0 Y0
M30
`;

  const GCODE_DICT = [
    { code: 'G00', desc: 'Movimento Rápido' },
    { code: 'G01', desc: 'Interpolação Linear' },
    { code: 'G02', desc: 'Arco Horário (CW)' },
    { code: 'G03', desc: 'Arco Anti-Horário (CCW)' },
    { code: 'G28', desc: 'Retorno Home Primário' },
    { code: 'G30', desc: 'Retorno Home Secundário' },
    { code: 'G54', desc: 'Work Offset G54' },
    { code: 'G55', desc: 'Work Offset G55' },
    { code: 'G56', desc: 'Work Offset G56' },
    { code: 'G57', desc: 'Work Offset G57' },
    { code: 'G58', desc: 'Work Offset G58' },
    { code: 'G59', desc: 'Work Offset G59' },
    { code: 'G40', desc: 'Cancelar Compensação da Ferramenta' },
    { code: 'G41', desc: 'Compensação à Esquerda' },
    { code: 'G42', desc: 'Compensação à Direita' },
    { code: 'G80', desc: 'Cancelar Ciclo Fixo' },
    { code: 'G81', desc: 'Ciclo de Furação' },
    { code: 'G82', desc: 'Furação com Dwell' },
    { code: 'G83', desc: 'Furação Peck' },
    { code: 'G17', desc: 'Plano XY' },
    { code: 'G20', desc: 'Unidades Polegadas' },
    { code: 'G21', desc: 'Unidades Milímetros' },
    { code: 'G90', desc: 'Coordenadas Absolutas' },
    { code: 'G91', desc: 'Coordenadas Incrementais' },
    { code: 'M00', desc: 'Parada de Programa' },
    { code: 'M01', desc: 'Parada Opcional' },
    { code: 'M07', desc: 'Coolant Névoa' },
    { code: 'M08', desc: 'Coolant Fluido' },
    { code: 'M09', desc: 'Coolant Desligado' },
    { code: 'M98', desc: 'Chamada de Subprograma' },
    { code: 'M99', desc: 'Retorno de Subprograma' },
    { code: 'M03', desc: 'Ligar Spindle (CW)' },
    { code: 'M05', desc: 'Desligar Spindle' },
    { code: 'M06', desc: 'Troca de Ferramenta' },
    { code: 'M30', desc: 'Fim de Programa' }
  ];

  let config = {
    limX: 500, limY: 500, limZ: 100,
    stkX: 100, stkY: 100, stkZ: 20, stkZOrigin: 'top',
    toolDiameter: 6, stockResolution: 0.5,
    rapidRate: 6000, defaultSpindle: 12000,
    safeZ: 5, optionalStopEnabled: true,
    home28:{x:0,y:0,z:80}, home30:{x:0,y:0,z:50},
    workOffsets:{
      G54:{x:0,y:0,z:0},G55:{x:0,y:0,z:0},G56:{x:0,y:0,z:0},
      G57:{x:0,y:0,z:0},G58:{x:0,y:0,z:0},G59:{x:0,y:0,z:0}
    },
    material:'aluminum', simArcTolerance:0.05, simArcMaxSteps:4096, simAdaptive:true
  };

  const state = {
    // Oculta a trajetória verde já executada no ISO 3D.
    hidePlayedPath3D: true,
    segments: [], tools: [], warnings: [], bbox: null, units: 'mm',
    viewPlane: 'XY', scale: 1, offsetX: 0, offsetY: 0,
    selectedLine: null, playIndex: 0, playing: false, playTimer: null, playSpeed: 1,
    currentFileName: 'programa.tap', zMaxFilter: Infinity,
    renderGeometry: [], limitViolations: [], stockCache: null, stockSim: null,
    fileQueue: [], fileQueueIndex: -1, sequencePlaying: false, multiFileMode: null,
    stockQuality: 'preview', stockRefineTimer: null, stockRenderCache: null,
    isDraggingCanvas: false, dragStart: {x:0, y:0}, dragMode: 'pan',
    isoAzimuth: Math.PI/4, isoElevation: Math.atan(1/Math.sqrt(2)),
    toolLibrary: {
      1:{number:1,name:'Fresa Topo 6mm',type:'endmill',diameter:6,angle:60,flutes:2,stickout:25,holderDiameter:20,holderLength:45},
      2:{number:2,name:'V-Bit 60°',type:'vbit',diameter:6,angle:60,flutes:2,stickout:20,holderDiameter:20,holderLength:45},
      3:{number:3,name:'Ball Nose 4mm',type:'ballnose',diameter:4,angle:60,flutes:2,stickout:22,holderDiameter:20,holderLength:45}
    },
    analysis: [], stats:null, breakpoints:new Set(), bookmarks:new Set(),
    measureMode:false, measurePoints:[], history:[], historyIndex:-1, historyLock:false,
    virtualTime:0, playClockLast:0, cumulativeTimes:[], totalTime:0,
    fixtures:[], snapshots:[], recentFiles:[], activeWorkOffset:'G54',
    coolant:'off', projectionMode:'ortho', perspectiveDistance:900,
    xray:false, depthMap:false, sectionAxis:'none', sectionValue:0,
    toolVisibility:{}, showRapid:true, showCut:true, holderCollision:true, machineEvents:[],
    conditionalBreak:{toolChange:false, programStop:true, depthEnabled:false, depthZ:-10},
    jobType:'cnc', jobConfidence:0, jobEvidence:[],
    printNozzleWidth:0.45, printLayerHeight:0.20,
    orbitSensitivity:0.006,
    materialLibrary:{
      aluminum:{name:'Alumínio',density:2.70,recommendedVc:250,chipLoad:0.05},
      steel:{name:'Aço carbono',density:7.85,recommendedVc:120,chipLoad:0.03},
      stainless:{name:'Inox',density:8.00,recommendedVc:80,chipLoad:0.02},
      wood:{name:'Madeira / MDF',density:0.70,recommendedVc:400,chipLoad:0.10},
      plastic:{name:'Plástico',density:1.10,recommendedVc:200,chipLoad:0.08}
    }
  };

  // DOM Refs
  const codeEl = document.getElementById('code');
  const highlightEl = document.getElementById('highlight');
  const gutterEl = document.getElementById('gutter');
  const editorScrollEl = document.getElementById('editorScroll');
  const lineHighlightEl = document.getElementById('lineHighlight');
  const playHighlightEl = document.getElementById('playHighlight');
  const scrollMapEl = document.getElementById('scrollMap');
  const acBox = document.getElementById('acBox');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const glCanvas = document.getElementById('glCanvas');
  const xyzChart = document.getElementById('xyzChart');
  const xyzCtx = xyzChart.getContext('2d');
  const xyzChartWrap = document.getElementById('xyzChartWrap');


  // ============================================================
  // CAD 2D EMBUTIDO + CAM BÁSICO (unidade interna fixa: mm)
  // ============================================================
  const cadDialog=document.getElementById('cadDialog');
  const cadSvg=document.getElementById('cadSvg'), cadViewport=document.getElementById('cadViewport');
  const cadEntitiesG=document.getElementById('cadEntities'), cadOverlay=document.getElementById('cadOverlay');
  const CADNS='http://www.w3.org/2000/svg';
  const cad={tool:'select',textPurpose:'comment',entities:[],selected:null,selectedIds:new Set(),nextId:1,zoom:1,panX:0,panY:0,grid:10,snap:true,ortho:false,drawing:null,drag:null,pan:null,marquee:null};
  let camQueue=[];
  let camEditingId=null;
  let camPreviewId=null;
  const cadHistory={items:[],index:-1,lock:false};
  const cadClone=o=>JSON.parse(JSON.stringify(o));
  function cadSelection(){const ids=cad.selectedIds.size?cad.selectedIds:(cad.selected?new Set([cad.selected]):new Set());return cad.entities.filter(e=>ids.has(e.id))}
  function cadSetSelection(ids){cad.selectedIds=new Set(ids);cad.selected=[...cad.selectedIds][0]||null}
  function cadCommitHistory(){if(cadHistory.lock)return;const value=JSON.stringify({entities:cad.entities,nextId:cad.nextId,camQueue});if(cadHistory.items[cadHistory.index]===value)return;cadHistory.items=cadHistory.items.slice(0,cadHistory.index+1);cadHistory.items.push(value);if(cadHistory.items.length>80)cadHistory.items.shift();cadHistory.index=cadHistory.items.length-1}
  function cadRestoreHistory(delta){const index=cadHistory.index+delta;if(index<0||index>=cadHistory.items.length)return;cadHistory.index=index;cadHistory.lock=true;const data=JSON.parse(cadHistory.items[index]);cad.entities=data.entities;cad.nextId=data.nextId;camQueue=Array.isArray(data.camQueue)?data.camQueue:[];cadSetSelection([]);cadHistory.lock=false;cadRender();camQueueRender()}
  cadCommitHistory();
  function cadMake(tag,a={}){const n=document.createElementNS(CADNS,tag);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v));return n}
  function cadArc(p1,p2,p3){const d=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));if(Math.abs(d)<1e-9)return null;const ux=((p1.x*p1.x+p1.y*p1.y)*(p2.y-p3.y)+(p2.x*p2.x+p2.y*p2.y)*(p3.y-p1.y)+(p3.x*p3.x+p3.y*p3.y)*(p1.y-p2.y))/d;const uy=((p1.x*p1.x+p1.y*p1.y)*(p3.x-p2.x)+(p2.x*p2.x+p2.y*p2.y)*(p1.x-p3.x)+(p3.x*p3.x+p3.y*p3.y)*(p2.x-p1.x))/d;const r=Math.hypot(p1.x-ux,p1.y-uy),norm=a=>(a%(Math.PI*2)+Math.PI*2)%(Math.PI*2);const a1=norm(Math.atan2(p1.y-uy,p1.x-ux)),a2=norm(Math.atan2(p2.y-uy,p2.x-ux)),a3=norm(Math.atan2(p3.y-uy,p3.x-ux));const ccw=((a2-a1+Math.PI*2)%(Math.PI*2))<((a3-a1+Math.PI*2)%(Math.PI*2));return{cx:ux,cy:uy,r,a1,a3,ccw}}
  function cadBBox(e){if(e.type==='line')return{x:Math.min(e.x1,e.x2),y:Math.min(e.y1,e.y2),w:Math.abs(e.x2-e.x1),h:Math.abs(e.y2-e.y1)};if(e.type==='rect')return{x:e.x,y:e.y,w:e.w,h:e.h};if(e.type==='circle')return{x:e.cx-e.r,y:e.cy-e.r,w:e.r*2,h:e.r*2};if(e.type==='text'){const h=Math.max(.1,+e.height||5),w=Math.max(h*.35,(e.text||'').length*h*.6);return{x:e.x,y:e.y,w,h}}const pts=e.type==='polyline'?e.points:e.type==='arc'?[e.p1,e.p2,e.p3]:[];if(pts.length){const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}return{x:0,y:0,w:0,h:0}}
  function cadEl(e){const c={stroke:'#e6e8eb','stroke-width':.45,fill:'none',class:'cad-entity'};let n;if(e.type==='line')n=cadMake('line',{x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2,...c});if(e.type==='rect')n=cadMake('rect',{x:e.x,y:e.y,width:e.w,height:e.h,...c});if(e.type==='circle')n=cadMake('circle',{cx:e.cx,cy:e.cy,r:e.r,...c});if(e.type==='polyline')n=cadMake('polyline',{points:e.points.map(p=>`${p.x},${p.y}`).join(' '),...c});if(e.type==='arc'){const a=cadArc(e.p1,e.p2,e.p3);if(a){const large=((a.ccw?(a.a3-a.a1+Math.PI*2):(a.a1-a.a3+Math.PI*2))%(Math.PI*2))>Math.PI?1:0;n=cadMake('path',{d:`M${e.p1.x} ${e.p1.y} A${a.r} ${a.r} 0 ${large} ${a.ccw?1:0} ${e.p3.x} ${e.p3.y}`,...c})}}if(e.type==='text'){n=cadMake('text',{x:0,y:0,transform:`translate(${e.x} ${e.y}) scale(1 -1)`,fill:'#e6e8eb',stroke:'none','font-size':Math.max(.1,+e.height||5),'font-family':'Arial, sans-serif','dominant-baseline':'text-before-edge',class:'cad-entity'});n.textContent=e.text||''}if(n){n.dataset.id=e.id;n.style.pointerEvents=e.type==='text'?'all':'stroke';if(cad.selectedIds.has(e.id)||e.id===cad.selected){if(e.type==='text')n.setAttribute('fill','#4fd1e5');else n.setAttribute('stroke','#4fd1e5')}}return n}
  function cadView(){cadViewport.setAttribute('transform',`translate(${cad.panX} ${cad.panY}) scale(${cad.zoom} ${-cad.zoom})`)}
  function cadScreen(ev){const r=cadSvg.getBoundingClientRect();return{x:(ev.clientX-r.left-cad.panX)/cad.zoom,y:-(ev.clientY-r.top-cad.panY)/cad.zoom}}
  function cadSnapP(p,anchor){let q={...p};if(cad.snap){q.x=Math.round(q.x/cad.grid)*cad.grid;q.y=Math.round(q.y/cad.grid)*cad.grid}if(cad.ortho&&anchor){if(Math.abs(q.x-anchor.x)>=Math.abs(q.y-anchor.y))q.y=anchor.y;else q.x=anchor.x}return q}
  function cadRender(){cadEntitiesG.innerHTML='';cadOverlay.innerHTML='';cad.entities.forEach(e=>{const n=cadEl(e);if(n)cadEntitiesG.appendChild(n)});const selected=cadSelection();selected.forEach(e=>{const b=cadBBox(e);cadOverlay.appendChild(cadMake('rect',{x:b.x-2/cad.zoom,y:b.y-2/cad.zoom,width:b.w+4/cad.zoom,height:b.h+4/cad.zoom,class:'cad-selection'}))});if(selected.length===1){const e=selected[0],b=cadBBox(e);document.getElementById('cadSelectionInfo').textContent=`${e.type.toUpperCase()} · X ${b.x.toFixed(3)} · Y ${b.y.toFixed(3)} · ${b.w.toFixed(3)} × ${b.h.toFixed(3)} mm`;if(e.type==='text'){document.getElementById('cadTextValue').value=e.text||'';document.getElementById('cadTextHeight').value=e.height||5;document.getElementById('cadTextPurpose').value=e.purpose==='machine'?'machine':'comment';document.getElementById('cadSelectionInfo').textContent+=` · ${e.purpose==='machine'?'USINAR':'COMENTÁRIO'}`}}else document.getElementById('cadSelectionInfo').textContent=selected.length?`${selected.length} objetos selecionados`:'Nenhum objeto.';cadUpdatePropertyFields(selected);cadPreview();camRenderPreview();cadView();cadUpdateCamSummary()}
  function cadPreview(){const st={stroke:'#4fd1e5','stroke-width':1/cad.zoom,fill:'none','stroke-dasharray':`${5/cad.zoom} ${4/cad.zoom}`};if(cad.marquee){const m=cad.marquee;cadOverlay.appendChild(cadMake('rect',{x:Math.min(m.start.x,m.end.x),y:Math.min(m.start.y,m.end.y),width:Math.abs(m.end.x-m.start.x),height:Math.abs(m.end.y-m.start.y),fill:'#4fd1e522',...st}))}const d=cad.drawing;if(!d)return;if(d.type==='line'&&d.end)cadOverlay.appendChild(cadMake('line',{x1:d.start.x,y1:d.start.y,x2:d.end.x,y2:d.end.y,...st}));if(d.type==='rect'&&d.end)cadOverlay.appendChild(cadMake('rect',{x:Math.min(d.start.x,d.end.x),y:Math.min(d.start.y,d.end.y),width:Math.abs(d.end.x-d.start.x),height:Math.abs(d.end.y-d.start.y),...st}));if(d.type==='circle'&&d.end)cadOverlay.appendChild(cadMake('circle',{cx:d.start.x,cy:d.start.y,r:Math.hypot(d.end.x-d.start.x,d.end.y-d.start.y),...st}));if(d.type==='polyline'||d.type==='arc'){const p=[...d.points];if(d.end)p.push(d.end);cadOverlay.appendChild(cadMake('polyline',{points:p.map(x=>`${x.x},${x.y}`).join(' '),...st}))}}
  function cadAdd(e){e.id='C'+String(cad.nextId++).padStart(4,'0');cad.entities.push(e);cadSetSelection([e.id]);cadRender();cadCommitHistory()}
  function cadMove(e,dx,dy){if(e.type==='line'){e.x1+=dx;e.y1+=dy;e.x2+=dx;e.y2+=dy}else if(e.type==='rect'){e.x+=dx;e.y+=dy}else if(e.type==='circle'){e.cx+=dx;e.cy+=dy}else if(e.type==='polyline')e.points.forEach(p=>{p.x+=dx;p.y+=dy});else if(e.type==='arc')[e.p1,e.p2,e.p3].forEach(p=>{p.x+=dx;p.y+=dy});else if(e.type==='text'){e.x+=dx;e.y+=dy}}
  function cadMapEntity(e,fn){if(e.type==='line'){let a=fn({x:e.x1,y:e.y1}),b=fn({x:e.x2,y:e.y2});Object.assign(e,{x1:a.x,y1:a.y,x2:b.x,y2:b.y})}else if(e.type==='polyline')e.points=e.points.map(fn);else if(e.type==='arc'){e.p1=fn(e.p1);e.p2=fn(e.p2);e.p3=fn(e.p3)}else if(e.type==='rect'){const pts=[fn({x:e.x,y:e.y}),fn({x:e.x+e.w,y:e.y}),fn({x:e.x+e.w,y:e.y+e.h}),fn({x:e.x,y:e.y+e.h})],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);e.x=Math.min(...xs);e.y=Math.min(...ys);e.w=Math.max(...xs)-e.x;e.h=Math.max(...ys)-e.y}else if(e.type==='circle'){const c=fn({x:e.cx,y:e.cy}),r=fn({x:e.cx+e.r,y:e.cy});e.cx=c.x;e.cy=c.y;e.r=Math.hypot(r.x-c.x,r.y-c.y)}else if(e.type==='text'){const p=fn({x:e.x,y:e.y});e.x=p.x;e.y=p.y}}
  function cadSelectionBBox(items=cadSelection()){if(!items.length)return null;const bs=items.map(cadBBox),x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y)),x2=Math.max(...bs.map(b=>b.x+b.w)),y2=Math.max(...bs.map(b=>b.y+b.h));return{x,y,w:x2-x,h:y2-y}}
  function cadUpdatePropertyFields(items){const b=cadSelectionBBox(items);['cadPropX','cadPropY','cadPropW','cadPropH'].forEach(id=>document.getElementById(id).disabled=!b);if(!b)return;cadPropX.value=b.x.toFixed(3);cadPropY.value=b.y.toFixed(3);cadPropW.value=b.w.toFixed(3);cadPropH.value=b.h.toFixed(3)}
  let cadClipboard=[];
  function cadDuplicateSelection(dx=cad.grid,dy=cad.grid){const items=cadSelection();if(!items.length)return;const copies=items.map(src=>{const e=cadClone(src);e.id='C'+String(cad.nextId++).padStart(4,'0');cadMove(e,dx,dy);cad.entities.push(e);return e.id});cadSetSelection(copies);cadRender();cadCommitHistory()}
  function cadSetTool(t){cad.tool=t;cad.drawing=null;document.querySelectorAll('[data-cad-tool]').forEach(b=>b.classList.toggle('active',b.dataset.cadTool===t));document.getElementById('cadTextToolBtn').classList.toggle('active',t==='text');if(t!=='text')document.getElementById('cadTextMenu').classList.remove('open');cadRender()}
  function cadFit(){const r=cadSvg.getBoundingClientRect();if(!cad.entities.length){cad.zoom=1;cad.panX=r.width/2;cad.panY=r.height/2;cadView();return}const bs=cad.entities.map(cadBBox),minX=Math.min(...bs.map(b=>b.x)),minY=Math.min(...bs.map(b=>b.y)),maxX=Math.max(...bs.map(b=>b.x+b.w)),maxY=Math.max(...bs.map(b=>b.y+b.h)),w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);cad.zoom=Math.max(.05,Math.min(30,Math.min((r.width-100)/w,(r.height-100)/h)));cad.panX=r.width/2-(minX+w/2)*cad.zoom;cad.panY=r.height/2+(minY+h/2)*cad.zoom;cadView()}
  cadSvg.addEventListener('pointerdown',ev=>{if(ev.button===1||(ev.button===0&&ev.shiftKey)){cad.pan={x:ev.clientX,y:ev.clientY,px:cad.panX,py:cad.panY};cadSvg.setPointerCapture(ev.pointerId);return}if(ev.button!==0)return;let p=cadSnapP(cadScreen(ev));if(cad.tool==='select'){const t=ev.target.closest('.cad-entity'),id=t?.dataset.id||null;if(ev.ctrlKey||ev.metaKey){if(id){cad.selectedIds.has(id)?cad.selectedIds.delete(id):cad.selectedIds.add(id);cad.selected=[...cad.selectedIds][0]||null}}else if(id)cadSetSelection([id]);if(id&&cad.selectedIds.has(id)){cad.drag={ids:[...cad.selectedIds],last:p};cadSvg.setPointerCapture(ev.pointerId)}else if(!id){cad.marquee={start:p,end:p,append:ev.ctrlKey||ev.metaKey};cadSvg.setPointerCapture(ev.pointerId)}cadRender();return}if(cad.tool==='line'){if(!cad.drawing)cad.drawing={type:'line',start:p,end:p};else{p=cadSnapP(p,cad.drawing.start);cadAdd({type:'line',x1:cad.drawing.start.x,y1:cad.drawing.start.y,x2:p.x,y2:p.y});cad.drawing=null}cadRender();return}if(cad.tool==='rect'||cad.tool==='circle'){cad.drawing={type:cad.tool,start:p,end:p,dragging:true};cadSvg.setPointerCapture(ev.pointerId);cadRender();return}if(cad.tool==='polyline'){if(!cad.drawing)cad.drawing={type:'polyline',points:[p],end:p};else cad.drawing.points.push(cadSnapP(p,cad.drawing.points.at(-1)));cadRender();return}if(cad.tool==='arc'){if(!cad.drawing)cad.drawing={type:'arc',points:[p],end:p};else{cad.drawing.points.push(p);if(cad.drawing.points.length===3){cadAdd({type:'arc',p1:cad.drawing.points[0],p2:cad.drawing.points[1],p3:cad.drawing.points[2]});cad.drawing=null}}cadRender();return}if(cad.tool==='text'){const txt=document.getElementById('cadTextValue').value.trim(),h=Math.max(.1,+document.getElementById('cadTextHeight').value||5);if(!txt){alert('Digite o texto antes de posicioná-lo.');return}cadAdd({type:'text',x:p.x,y:p.y,text:txt,height:h,purpose:cad.textPurpose});return}});
  cadSvg.addEventListener('pointermove',ev=>{let raw=cadScreen(ev);document.getElementById('cadStatus').textContent=`X ${raw.x.toFixed(3)} · Y ${raw.y.toFixed(3)} mm`;if(cad.pan){cad.panX=cad.pan.px+ev.clientX-cad.pan.x;cad.panY=cad.pan.py+ev.clientY-cad.pan.y;cadView();return}let p=cadSnapP(raw,cad.drawing?.start||cad.drawing?.points?.at(-1));if(cad.drag){const dx=p.x-cad.drag.last.x,dy=p.y-cad.drag.last.y;cad.entities.filter(x=>cad.drag.ids.includes(x.id)).forEach(e=>cadMove(e,dx,dy));cad.drag.last=p;cadRender();return}if(cad.marquee){cad.marquee.end=raw;cadRender();return}if(cad.drawing){cad.drawing.end=p;cadRender()}});
  cadSvg.addEventListener('pointerup',()=>{if(cad.pan){cad.pan=null;return}if(cad.drag){cad.drag=null;cadCommitHistory();return}if(cad.marquee){const m=cad.marquee,x1=Math.min(m.start.x,m.end.x),x2=Math.max(m.start.x,m.end.x),y1=Math.min(m.start.y,m.end.y),y2=Math.max(m.start.y,m.end.y),contain=m.end.x>=m.start.x,ids=cad.entities.filter(e=>{const b=cadBBox(e);return contain?(b.x>=x1&&b.y>=y1&&b.x+b.w<=x2&&b.y+b.h<=y2):(b.x<=x2&&b.x+b.w>=x1&&b.y<=y2&&b.y+b.h>=y1)}).map(e=>e.id);cadSetSelection(m.append?[...new Set([...cad.selectedIds,...ids])]:ids);cad.marquee=null;cadRender();return}if(cad.drawing?.dragging){const d=cad.drawing,p=d.end;if(d.type==='rect'){const w=Math.abs(p.x-d.start.x),h=Math.abs(p.y-d.start.y);if(w||h)cadAdd({type:'rect',x:Math.min(d.start.x,p.x),y:Math.min(d.start.y,p.y),w,h})}else{const r=Math.hypot(p.x-d.start.x,p.y-d.start.y);if(r)cadAdd({type:'circle',cx:d.start.x,cy:d.start.y,r})}cad.drawing=null;cadRender()}});
  cadSvg.addEventListener('dblclick',()=>{if(cad.tool==='polyline'&&cad.drawing?.points.length>=2){cadAdd({type:'polyline',points:cadClone(cad.drawing.points)});cad.drawing=null;cadRender()}});
  cadSvg.addEventListener('wheel',ev=>{ev.preventDefault();const r=cadSvg.getBoundingClientRect(),sx=ev.clientX-r.left,sy=ev.clientY-r.top,old=cad.zoom,f=ev.deltaY<0?1.12:1/1.12;cad.zoom=Math.max(.05,Math.min(30,cad.zoom*f));const wx=(sx-cad.panX)/old,wy=(sy-cad.panY)/old;cad.panX=sx-wx*cad.zoom;cad.panY=sy-wy*cad.zoom;cadView()},{passive:false});
  document.querySelectorAll('[data-cad-tool]').forEach(b=>b.addEventListener('click',()=>cadSetTool(b.dataset.cadTool)));
  const cadTextToolBtn=document.getElementById('cadTextToolBtn'),cadTextMenu=document.getElementById('cadTextMenu');
  cadTextToolBtn.addEventListener('click',ev=>{ev.stopPropagation();cadTextMenu.classList.toggle('open')});
  function chooseCadTextTool(purpose){cad.textPurpose=purpose;document.getElementById('cadTextPurpose').value=purpose;cadTextMenu.classList.remove('open');cadSetTool('text');cadTextToolBtn.title=purpose==='machine'?'Texto usinado':'Texto comentário';cadTextToolBtn.textContent=purpose==='machine'?'T⚙':'T'}
  document.getElementById('cadTextComment').addEventListener('click',ev=>{ev.stopPropagation();chooseCadTextTool('comment')});
  document.getElementById('cadTextMachine').addEventListener('click',ev=>{ev.stopPropagation();chooseCadTextTool('machine')});
  document.addEventListener('click',ev=>{if(!document.getElementById('cadTextWrap').contains(ev.target))cadTextMenu.classList.remove('open')});
  document.getElementById('cadDelete').addEventListener('click',()=>{const ids=new Set(cadSelection().map(e=>e.id));if(ids.size){cad.entities=cad.entities.filter(e=>!ids.has(e.id));camQueue=camQueue.map(op=>({...op,entityIds:camOpEntityIds(op).filter(id=>!ids.has(id))})).filter(op=>op.entityIds.length);cadSetSelection([]);cadRender();camQueueRender();cadCommitHistory()}});
  document.getElementById('cadUndo').addEventListener('click',()=>cadRestoreHistory(-1));
  document.getElementById('cadRedo').addEventListener('click',()=>cadRestoreHistory(1));
  document.getElementById('cadDuplicate').addEventListener('click',()=>cadDuplicateSelection());
  document.getElementById('cadSelectAll').addEventListener('click',()=>{cadSetSelection(cad.entities.map(e=>e.id));cadRender()});
  document.getElementById('cadPropApply').addEventListener('click',()=>{const items=cadSelection(),b=cadSelectionBBox(items);if(!b)return;const nx=+cadPropX.value,ny=+cadPropY.value,nw=Math.max(0,+cadPropW.value),nh=Math.max(0,+cadPropH.value),angle=(+cadPropRotate.value||0)*Math.PI/180,sx=b.w>1e-9?nw/b.w:1,sy=b.h>1e-9?nh/b.h:1,cx=b.x+b.w/2,cy=b.y+b.h/2;items.forEach(e=>cadMapEntity(e,p=>{let x=b.x+(p.x-b.x)*sx,y=b.y+(p.y-b.y)*sy,dx=x-(b.x+nw/2),dy=y-(b.y+nh/2);return{x:nx+nw/2+dx*Math.cos(angle)-dy*Math.sin(angle),y:ny+nh/2+dx*Math.sin(angle)+dy*Math.cos(angle)}}));cadPropRotate.value=0;cadRender();cadCommitHistory()});
  cadDialog.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;const key=e.key.toLowerCase();if(key==='z'){e.preventDefault();cadRestoreHistory(e.shiftKey?1:-1)}else if(key==='y'){e.preventDefault();cadRestoreHistory(1)}});
  cadDialog.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='a'){e.preventDefault();cadSetSelection(cad.entities.map(x=>x.id));cadRender()}else if((e.ctrlKey||e.metaKey)&&key==='c'){e.preventDefault();cadClipboard=cadSelection().map(cadClone)}else if((e.ctrlKey||e.metaKey)&&key==='v'){e.preventDefault();if(cadClipboard.length){const ids=[];cadClipboard.forEach(src=>{const q=cadClone(src);q.id='C'+String(cad.nextId++).padStart(4,'0');cadMove(q,cad.grid,cad.grid);cad.entities.push(q);ids.push(q.id)});cadSetSelection(ids);cadRender();cadCommitHistory()}}else if((e.ctrlKey||e.metaKey)&&key==='d'){e.preventDefault();cadDuplicateSelection()}else if(e.key==='Escape'){cadSetSelection([]);cadRender()}});
  document.getElementById('cadGridSize').addEventListener('change',e=>{cad.grid=Math.max(.1,+e.target.value||10);document.getElementById('cadMinorGrid').setAttribute('width',cad.grid);document.getElementById('cadMinorGrid').setAttribute('height',cad.grid);document.getElementById('cadMajorGrid').setAttribute('width',cad.grid*5);document.getElementById('cadMajorGrid').setAttribute('height',cad.grid*5)});
  document.getElementById('cadSnap').addEventListener('change',e=>cad.snap=e.target.value==='1');document.getElementById('cadOrtho').addEventListener('change',e=>cad.ortho=e.target.value==='1');
  document.getElementById('cadTextValue').addEventListener('change',e=>{const t=cad.entities.find(x=>x.id===cad.selected&&x.type==='text');if(t){t.text=e.target.value;cadRender();cadCommitHistory()}});
  document.getElementById('cadTextHeight').addEventListener('change',e=>{const t=cad.entities.find(x=>x.id===cad.selected&&x.type==='text');if(t){t.height=Math.max(.1,+e.target.value||5);cadRender();cadCommitHistory()}});
  document.getElementById('cadTextPurpose').addEventListener('change',e=>{const t=cad.entities.find(x=>x.id===cad.selected&&x.type==='text');if(t){t.purpose=e.target.value==='machine'?'machine':'comment';cadRender();cadCommitHistory()}});
  document.getElementById('cadFit').addEventListener('click',cadFit);document.getElementById('cadNew').addEventListener('click',()=>{if(!cad.entities.length||confirm('Limpar o desenho CAD atual?')){cad.entities=[];camQueue=[];cadSetSelection([]);cad.nextId=1;cadRender();camQueueRender();cadCommitHistory();cadFit()}});
  document.getElementById('btnCad2D').addEventListener('click',()=>{document.getElementById('cadSafeZ').value=config.safeZ||5;document.getElementById('cadSpindle').value=config.defaultSpindle||12000;document.getElementById('cadToolDiameter').value=config.toolDiameter||3.175;cadDialog.showModal();requestAnimationFrame(()=>{cadRender();camQueueRender();cadFit();cadUpdateCamSummary()})});document.getElementById('cadClose').addEventListener('click',()=>cadDialog.close());
  function cadDownload(name,text,type){
    const blob=new Blob([text],{type:type||'application/octet-stream'});
    const u=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=u;
    a.download=name;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),3000);
  }
  function cadSvgText(){const bs=cad.entities.map(cadBBox);let minX=0,minY=0,maxX=100,maxY=100;if(bs.length){minX=Math.min(...bs.map(b=>b.x));minY=Math.min(...bs.map(b=>b.y));maxX=Math.max(...bs.map(b=>b.x+b.w));maxY=Math.max(...bs.map(b=>b.y+b.h))}const m=10,w=maxX-minX+2*m,h=maxY-minY+2*m;let body='';cad.entities.forEach(e=>{const n=cadEl(e);if(n){n.removeAttribute('class');n.removeAttribute('data-id');body+=n.outerHTML}});return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX-m} ${-(maxY+m)} ${w} ${h}" width="${w}mm" height="${h}mm"><g transform="scale(1,-1)">${body}</g></svg>`}
  document.getElementById('cadSaveSvg').addEventListener('click',()=>cadDownload('desenho.svg',cadSvgText(),'image/svg+xml'));
  function cadDxf(){
    const o=[];
    const add=(code,value)=>{o.push(String(code),String(value));};
    const num=v=>{
      const n=Number(v);
      if(!Number.isFinite(n)) return '0';
      const s=n.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
      return s==='-0'?'0':s;
    };

    // DXF ASCII R12 (AC1009): formato simples e amplamente compatível.
    // Todas as coordenadas são gravadas em milímetros por convenção do projeto.
    let minX=0,minY=0,maxX=0,maxY=0;
    if(cad.entities.length){
      const bs=cad.entities.map(cadBBox);
      minX=Math.min(...bs.map(b=>b.x));
      minY=Math.min(...bs.map(b=>b.y));
      maxX=Math.max(...bs.map(b=>b.x+b.w));
      maxY=Math.max(...bs.map(b=>b.y+b.h));
    }

    add(0,'SECTION'); add(2,'HEADER');
    add(9,'$ACADVER'); add(1,'AC1009');
    add(9,'$MEASUREMENT'); add(70,1);
    add(9,'$EXTMIN'); add(10,num(minX)); add(20,num(minY)); add(30,'0');
    add(9,'$EXTMAX'); add(10,num(maxX)); add(20,num(maxY)); add(30,'0');
    add(0,'ENDSEC');

    add(0,'SECTION'); add(2,'TABLES');
    add(0,'TABLE'); add(2,'LTYPE'); add(70,1);
    add(0,'LTYPE'); add(2,'CONTINUOUS'); add(70,0); add(3,'Solid line'); add(72,65); add(73,0); add(40,0.0);
    add(0,'ENDTAB');
    add(0,'TABLE'); add(2,'LAYER'); add(70,1);
    add(0,'LAYER'); add(2,'0'); add(70,0); add(62,7); add(6,'CONTINUOUS');
    add(0,'ENDTAB');
    add(0,'TABLE'); add(2,'STYLE'); add(70,1);
    add(0,'STYLE'); add(2,'STANDARD'); add(70,0); add(40,0); add(41,1); add(50,0); add(71,0); add(42,2.5); add(3,'txt'); add(4,'');
    add(0,'ENDTAB');
    add(0,'ENDSEC');

    add(0,'SECTION'); add(2,'BLOCKS'); add(0,'ENDSEC');
    add(0,'SECTION'); add(2,'ENTITIES');

    const addLine=(x1,y1,x2,y2)=>{
      add(0,'LINE'); add(8,'0');
      add(10,num(x1)); add(20,num(y1)); add(30,'0');
      add(11,num(x2)); add(21,num(y2)); add(31,'0');
    };
    const addPolyline=(pts,closed=false)=>{
      if(!pts || pts.length<2) return;
      add(0,'POLYLINE'); add(8,'0'); add(66,1); add(70,closed?1:0); add(10,'0'); add(20,'0'); add(30,'0');
      pts.forEach(p=>{
        add(0,'VERTEX'); add(8,'0');
        add(10,num(p.x)); add(20,num(p.y)); add(30,'0'); add(70,0);
      });
      add(0,'SEQEND'); add(8,'0');
    };

    cad.entities.forEach(e=>{
      if(e.type==='line'){
        addLine(e.x1,e.y1,e.x2,e.y2);
      }else if(e.type==='rect'){
        addPolyline([
          {x:e.x,y:e.y},
          {x:e.x+e.w,y:e.y},
          {x:e.x+e.w,y:e.y+e.h},
          {x:e.x,y:e.y+e.h}
        ],true);
      }else if(e.type==='polyline'){
        addPolyline(e.points,false);
      }else if(e.type==='circle'){
        add(0,'CIRCLE'); add(8,'0');
        add(10,num(e.cx)); add(20,num(e.cy)); add(30,'0'); add(40,num(e.r));
      }else if(e.type==='text'){
        add(0,'TEXT'); add(8,'0');
        add(10,num(e.x)); add(20,num(e.y)); add(30,'0');
        add(40,num(Math.max(.1,+e.height||5))); add(1,String(e.text||'')); add(7,'STANDARD'); add(50,'0');
      }else if(e.type==='arc'){
        const a=cadArc(e.p1,e.p2,e.p3);
        if(a){
          let sa=a.a1*180/Math.PI,ea=a.a3*180/Math.PI;
          if(!a.ccw)[sa,ea]=[ea,sa];
          sa=(sa%360+360)%360; ea=(ea%360+360)%360;
          add(0,'ARC'); add(8,'0');
          add(10,num(a.cx)); add(20,num(a.cy)); add(30,'0'); add(40,num(a.r));
          add(50,num(sa)); add(51,num(ea));
        }
      }
    });

    add(0,'ENDSEC'); add(0,'EOF');
    return o.join('\r\n')+'\r\n';
  }
  document.getElementById('cadExportDxf').addEventListener('click',()=>{if(!cad.entities.length)return alert('Desenhe ao menos uma geometria antes de exportar.');cadDownload('desenho.dxf',cadDxf(),'application/octet-stream');});
  document.getElementById('cadOpenSvg').addEventListener('click',()=>document.getElementById('cadSvgInput').click());document.getElementById('cadSvgInput').addEventListener('change',async ev=>{const f=ev.target.files[0];if(!f)return;const doc=new DOMParser().parseFromString(await f.text(),'image/svg+xml');if(doc.querySelector('parsererror'))return alert('SVG inválido.');cad.entities=[];camQueue=[];cadSetSelection([]);cad.nextId=1;doc.querySelectorAll('line,rect,circle,polyline,polygon,text').forEach(n=>{let e;if(n.tagName==='line')e={type:'line',x1:+n.getAttribute('x1')||0,y1:+n.getAttribute('y1')||0,x2:+n.getAttribute('x2')||0,y2:+n.getAttribute('y2')||0};else if(n.tagName==='rect')e={type:'rect',x:+n.getAttribute('x')||0,y:+n.getAttribute('y')||0,w:+n.getAttribute('width')||0,h:+n.getAttribute('height')||0};else if(n.tagName==='circle')e={type:'circle',cx:+n.getAttribute('cx')||0,cy:+n.getAttribute('cy')||0,r:+n.getAttribute('r')||0};else if(n.tagName==='text'){let x=+n.getAttribute('x')||0,y=+n.getAttribute('y')||0;const tr=n.getAttribute('transform')||'',m=tr.match(/translate\(\s*([-+0-9.eE]+)[ ,]+([-+0-9.eE]+)\s*\)/);if(m){x=+m[1]||0;y=+m[2]||0}e={type:'text',x,y,text:n.textContent||'',height:parseFloat(n.getAttribute('font-size'))||5,purpose:'comment'}}else{const p=(n.getAttribute('points')||'').trim().split(/\s+/).map(v=>v.split(',').map(Number)).filter(v=>v.length===2&&v.every(Number.isFinite)).map(([x,y])=>({x,y}));if(p.length>1)e={type:'polyline',points:p}}if(e)cadAdd(e)});cadSetSelection([]);cadCommitHistory();cadRender();cadFit();ev.target.value=''});
  function cadParseDxf(text){
    const raw=text.replace(/\r/g,'').split('\n');
    const pairs=[];
    for(let i=0;i+1<raw.length;i+=2){const code=parseInt(raw[i].trim(),10);if(Number.isFinite(code))pairs.push([code,raw[i+1].trim()]);}
    const ents=[];let inEntities=false,i=0;
    const n=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:0};
    while(i<pairs.length){const [c,v]=pairs[i];
      if(c===0&&v==='SECTION'&&pairs[i+1]?.[0]===2&&pairs[i+1]?.[1]==='ENTITIES'){inEntities=true;i+=2;continue}
      if(inEntities&&c===0&&v==='ENDSEC'){break}
      if(!inEntities){i++;continue}
      if(c!==0){i++;continue}
      const type=v; i++;
      if(type==='POLYLINE'){
        const pts=[];let closed=false;
        while(i<pairs.length){
          if(pairs[i][0]===70)closed=(parseInt(pairs[i][1],10)&1)!==0;
          if(pairs[i][0]===0&&pairs[i][1]==='VERTEX'){
            i++;let x=0,y=0;
            while(i<pairs.length&&pairs[i][0]!==0){if(pairs[i][0]===10)x=n(pairs[i][1]);if(pairs[i][0]===20)y=n(pairs[i][1]);i++}
            pts.push({x,y});continue;
          }
          if(pairs[i][0]===0&&pairs[i][1]==='SEQEND'){i++;break}
          if(pairs[i][0]===0)break;i++;
        }
        if(pts.length>1){if(closed&&pts.length>=3){pts.push({...pts[0]})}ents.push({type:'polyline',points:pts});}
        continue;
      }
      const data={};
      while(i<pairs.length&&pairs[i][0]!==0){const [gc,gv]=pairs[i];(data[gc]||(data[gc]=[])).push(gv);i++}
      const g=(code,idx=0)=>data[code]?.[idx];
      if(type==='LINE')ents.push({type:'line',x1:n(g(10)),y1:n(g(20)),x2:n(g(11)),y2:n(g(21))});
      else if(type==='CIRCLE')ents.push({type:'circle',cx:n(g(10)),cy:n(g(20)),r:Math.abs(n(g(40)))});
      else if(type==='ARC'){
        const cx=n(g(10)),cy=n(g(20)),r=Math.abs(n(g(40))),a1=n(g(50))*Math.PI/180,a3=n(g(51))*Math.PI/180;
        let da=(a3-a1+Math.PI*2)%(Math.PI*2),am=a1+da/2;
        ents.push({type:'arc',p1:{x:cx+r*Math.cos(a1),y:cy+r*Math.sin(a1)},p2:{x:cx+r*Math.cos(am),y:cy+r*Math.sin(am)},p3:{x:cx+r*Math.cos(a3),y:cy+r*Math.sin(a3)}});
      }else if(type==='TEXT')ents.push({type:'text',x:n(g(10)),y:n(g(20)),height:Math.max(.1,Math.abs(n(g(40)))||5),text:g(1)||'',purpose:'comment'});
      else if(type==='LWPOLYLINE'){
        const xs=data[10]||[],ys=data[20]||[],pts=xs.map((x,j)=>({x:n(x),y:n(ys[j])}));const closed=(parseInt(g(70)||'0',10)&1)!==0;if(closed&&pts.length)pts.push({...pts[0]});if(pts.length>1)ents.push({type:'polyline',points:pts});
      }
    }
    return ents;
  }
  document.getElementById('cadOpenDxf').addEventListener('click',()=>document.getElementById('cadDxfInput').click());
  document.getElementById('cadDxfInput').addEventListener('change',async ev=>{const f=ev.target.files[0];if(!f)return;try{const ents=cadParseDxf(await f.text());if(!ents.length){alert('Nenhuma entidade compatível encontrada no DXF.');return}cad.entities=[];camQueue=[];cadSetSelection([]);cad.nextId=1;ents.forEach(e=>cadAdd(e));cadSetSelection([]);cadCommitHistory();cadRender();cadFit()}catch(err){console.error(err);alert('Não foi possível importar este DXF.')}finally{ev.target.value=''}});

  function cadDepths(finalDepth,step){if(finalDepth===0)return[0];const sign=Math.sign(finalDepth),a=Math.abs(finalDepth),st=Math.max(.001,Math.abs(step)),arr=[];for(let z=st;z<a-1e-9;z+=st)arr.push(sign*z);arr.push(finalDepth);return arr}
  const CAD_FONT5X7={
    'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],'C':['01111','10000','10000','10000','10000','10000','01111'],'D':['11110','10001','10001','10001','10001','10001','11110'],'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],'G':['01111','10000','10000','10111','10001','10001','01111'],'H':['10001','10001','10001','11111','10001','10001','10001'],'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00010','00010','00010','10010','10010','01100'],'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],'W':['10001','10001','10001','10101','10101','10101','01010'],'X':['10001','10001','01010','00100','01010','10001','10001'],'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
    '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
    '-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'/':['00001','00010','00010','00100','01000','01000','10000'],' ':['00000','00000','00000','00000','00000','00000','00000']
  };
  function cadTextSegments(e){
    const h=Math.max(.1,+e.height||5),cell=h/7,step=cell*6,segments=[];let ox=e.x;
    for(const ch0 of String(e.text||'').toUpperCase()){
      const rows=CAD_FONT5X7[ch0]||CAD_FONT5X7[' '];
      rows.forEach((row,ry)=>{let x=0;while(x<5){if(row[x]!=='1'){x++;continue}let x2=x;while(x2+1<5&&row[x2+1]==='1')x2++;const y=e.y+h-(ry+.5)*cell;segments.push([{x:ox+x*cell,y},{x:ox+(x2+1)*cell,y}]);x=x2+1;}});ox+=step;
    }
    return segments;
  }

  function cadIsClosedPolyline(e){if(e?.type!=='polyline'||e.points.length<3)return false;const a=e.points[0],b=e.points[e.points.length-1];return Math.hypot(a.x-b.x,a.y-b.y)<1e-6}
  function cadPolyArea(pts){let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=(pts[j].x*pts[i].y-pts[i].x*pts[j].y);return a/2}
  function cadLineIntersection(a,b,c,d){const A1=b.y-a.y,B1=a.x-b.x,C1=A1*a.x+B1*a.y,A2=d.y-c.y,B2=c.x-d.x,C2=A2*c.x+B2*c.y,det=A1*B2-A2*B1;if(Math.abs(det)<1e-9)return null;return{x:(B2*C1-B1*C2)/det,y:(A1*C2-A2*C1)/det}}
  function cadOffsetPolygon(points,offset){let pts=points.slice();if(pts.length>2&&Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-7)pts=pts.slice(0,-1);if(pts.length<3)return null;const ccw=cadPolyArea(pts)>0, lines=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;if(ccw){nx=-nx;ny=-ny}lines.push([{x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset}])}const out=[];for(let i=0;i<lines.length;i++){const prev=lines[(i-1+lines.length)%lines.length],cur=lines[i],p=cadLineIntersection(prev[0],prev[1],cur[0],cur[1]);out.push(p||cur[0])}out.push({...out[0]});return out}
  function cadPointInPoly(p,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-20)+a.x))c=!c}return c}
  function cadPocketScanlines(poly,spacing){let pts=poly.slice();if(Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-7)pts=pts.slice(0,-1);const ys=pts.map(p=>p.y),minY=Math.min(...ys),maxY=Math.max(...ys),rows=[];let flip=false;for(let y=minY;y<=maxY+1e-9;y+=spacing){const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[j],b=pts[i];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y))}xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2){let a={x:xs[k],y},b={x:xs[k+1],y};rows.push(flip?[b,a]:[a,b]);flip=!flip}}return rows}
  function cadRotateEntity90(e){const b=cadBBox(e),cx=b.x+b.w/2,cy=b.y+b.h/2,rot=p=>({x:cx-(p.y-cy),y:cy+(p.x-cx)});if(e.type==='line'){let a=rot({x:e.x1,y:e.y1}),b=rot({x:e.x2,y:e.y2});Object.assign(e,{x1:a.x,y1:a.y,x2:b.x,y2:b.y})}else if(e.type==='polyline')e.points=e.points.map(rot);else if(e.type==='arc'){e.p1=rot(e.p1);e.p2=rot(e.p2);e.p3=rot(e.p3)}else if(e.type==='rect'){const pts=[rot({x:e.x,y:e.y}),rot({x:e.x+e.w,y:e.y}),rot({x:e.x+e.w,y:e.y+e.h}),rot({x:e.x,y:e.y+e.h})];const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);e.x=Math.min(...xs);e.y=Math.min(...ys);e.w=Math.max(...xs)-e.x;e.h=Math.max(...ys)-e.y}else if(e.type==='text'){const p=rot({x:e.x,y:e.y});e.x=p.x;e.y=p.y}}
  function cadMirrorEntityX(e){const b=cadBBox(e),cx=b.x+b.w/2,m=p=>({x:2*cx-p.x,y:p.y});if(e.type==='line'){let a=m({x:e.x1,y:e.y1}),b=m({x:e.x2,y:e.y2});Object.assign(e,{x1:a.x,y1:a.y,x2:b.x,y2:b.y})}else if(e.type==='polyline')e.points=e.points.map(m).reverse();else if(e.type==='arc'){e.p1=m(e.p1);e.p2=m(e.p2);e.p3=m(e.p3)}else if(e.type==='text')e.x=2*cx-e.x}
  function cadOffsetSelected(){const e=cad.entities.find(x=>x.id===cad.selected);if(!e)return alert('Selecione uma geometria.');const d=+document.getElementById('cadOffsetValue').value||0;if(Math.abs(d)<1e-9)return;if(e.type==='circle'){cadAdd({type:'circle',cx:e.cx,cy:e.cy,r:Math.max(.001,e.r+d)});return}if(e.type==='rect'){cadAdd({type:'rect',x:e.x-d,y:e.y-d,w:Math.max(.001,e.w+2*d),h:Math.max(.001,e.h+2*d)});return}if(e.type==='polyline'&&cadIsClosedPolyline(e)){const p=cadOffsetPolygon(e.points,d);if(p)cadAdd({type:'polyline',points:p});return}alert('Offset disponível para círculo, retângulo e polilinha fechada.')}
  function cadJoinGeometry(){const tol=Math.max(.001,cad.grid*.05),lines=cad.entities.filter(e=>e.type==='line'||e.type==='polyline');if(lines.length<2)return alert('São necessárias ao menos duas linhas/polilinhas.');const chains=lines.map(e=>e.type==='line'?[{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}]:e.points.map(p=>({...p}))),used=new Set(),result=[];for(let i=0;i<chains.length;i++){if(used.has(i))continue;let c=chains[i].slice();used.add(i);let changed=true;while(changed){changed=false;for(let j=0;j<chains.length;j++){if(used.has(j))continue;let q=chains[j],a=c[0],b=c.at(-1),q0=q[0],q1=q.at(-1),near=(u,v)=>Math.hypot(u.x-v.x,u.y-v.y)<=tol;if(near(b,q0)){c.push(...q.slice(1));used.add(j);changed=true;break}if(near(b,q1)){c.push(...q.slice(0,-1).reverse());used.add(j);changed=true;break}if(near(a,q1)){c.unshift(...q.slice(0,-1));used.add(j);changed=true;break}if(near(a,q0)){c.unshift(...q.slice(1).reverse());used.add(j);changed=true;break}}}result.push(c)}const removed=new Set(lines.map(e=>e.id));cad.entities=cad.entities.filter(e=>!removed.has(e.id));camQueue=camQueue.map(op=>({...op,entityIds:camOpEntityIds(op).filter(id=>!removed.has(id))})).filter(op=>op.entityIds.length);result.forEach(points=>cadAdd({type:'polyline',points}));cadSetSelection([]);cadCommitHistory();cadRender();camQueueRender()}

  function cadValidateCam(){
    const safe=+document.getElementById('cadSafeZ').value;
    const depth=+document.getElementById('cadDepth').value;
    const step=+document.getElementById('cadStepDown').value;
    const feed=+document.getElementById('cadFeed').value;
    const plunge=+document.getElementById('cadPlunge').value;
    const toolD=+document.getElementById('cadToolDiameter').value;
    const rpm=+document.getElementById('cadSpindle').value;
    const issues=[];
    if(!Number.isFinite(safe)||safe<=0)issues.push('Safe Z deve ser maior que 0.');
    if(!Number.isFinite(depth)||depth>=0)issues.push('Profundidade final deve ser negativa.');
    if(!Number.isFinite(step)||step<=0)issues.push('Passo Z deve ser maior que 0.');
    if(!Number.isFinite(feed)||feed<=0)issues.push('Avanço XY inválido.');
    if(!Number.isFinite(plunge)||plunge<=0)issues.push('Avanço Z inválido.');
    if(!Number.isFinite(toolD)||toolD<=0)issues.push('Diâmetro da ferramenta inválido.');
    if(!Number.isFinite(rpm)||rpm<0)issues.push('RPM inválido.');
    const op=document.getElementById('cadOperation').value;
    if(op==='inside'||op==='pocket'){
      cad.entities.forEach(e=>{if(e.type==='rect'&&(e.w<=toolD||e.h<=toolD))issues.push(`${e.id}: ferramenta não cabe no contorno interno.`);if(e.type==='circle'&&e.r<=toolD/2)issues.push(`${e.id}: ferramenta não cabe no círculo interno.`)});
    }
    return issues;
  }
  function cadUpdateCamSummary(){
    const depth=+document.getElementById('cadDepth').value||0,step=Math.max(.001,+document.getElementById('cadStepDown').value||1);
    const passes=depth<0?Math.ceil(Math.abs(depth)/step):0;
    const machinable=cad.entities.filter(e=>!(e.type==='text'&&e.purpose!=='machine')).length;
    const issues=cadValidateCam();
    const el=document.getElementById('cadCamSummary');if(!el)return;
    el.textContent=`${machinable} objeto(s) · ${passes} passada(s) Z${issues.length?` · ⚠ ${issues.length} aviso(s)`:''}`;
    el.style.color=issues.length?'var(--accent-amber)':'var(--accent-cyan)';
  }
  ['cadOperation','cadToolDiameter','cadToolNumber','cadAllowance','cadFinishPass','cadStepover','cadSafeZ','cadDepth','cadStepDown','cadFeed','cadPlunge','cadSpindle','cadOptimize','cadRetractEach','cadEntry','cadLeadIn','cadLeadLen','cadTabsCount','cadTabWidth','cadTabHeight','cadPeck','cadSpindleDelay'].forEach(id=>document.getElementById(id)?.addEventListener('input',cadUpdateCamSummary));
  document.getElementById('cadOffsetBtn').addEventListener('click',cadOffsetSelected);
  document.getElementById('cadMirrorXBtn').addEventListener('click',()=>{const selected=cadSelection();if(!selected.length)return;selected.forEach(cadMirrorEntityX);cadRender();cadCommitHistory()});
  document.getElementById('cadRotate90Btn').addEventListener('click',()=>{const selected=cadSelection();if(!selected.length)return;selected.forEach(cadRotateEntity90);cadRender();cadCommitHistory()});
  document.getElementById('cadJoinBtn').addEventListener('click',cadJoinGeometry);


  function cadGcode(){
    const safe=+document.getElementById('cadSafeZ').value||5;
    const depth=+document.getElementById('cadDepth').value||-1;
    const step=+document.getElementById('cadStepDown').value||1;
    const feed=Math.max(1,+document.getElementById('cadFeed').value||800);
    const plunge=Math.max(1,+document.getElementById('cadPlunge').value||250);
    const rpm=Math.max(0,+document.getElementById('cadSpindle').value||12000);
    const toolD=Math.max(.001,+document.getElementById('cadToolDiameter').value||3.175);
    const toolR=toolD/2;
    const toolN=Math.max(1,Math.round(+document.getElementById('cadToolNumber')?.value||1));
    const allowance=Math.max(0,+document.getElementById('cadAllowance')?.value||0);
    const finishPass=document.getElementById('cadFinishPass')?.value!=='0';
    const stepover=Math.max(.05,Math.min(.95,(+document.getElementById('cadStepover')?.value||45)/100))*toolD;
    const operation=document.getElementById('cadOperation').value;
    const optimize=document.getElementById('cadOptimize')?.value!=='0';
    const retractEach=document.getElementById('cadRetractEach')?.value!=='0';
    const entry=document.getElementById('cadEntry')?.value||'plunge';
    const leadIn=document.getElementById('cadLeadIn')?.value==='1';
    const leadLen=Math.max(.1,+document.getElementById('cadLeadLen')?.value||3);
    const tabsCount=Math.max(0,Math.round(+document.getElementById('cadTabsCount')?.value||0));
    const tabWidth=Math.max(.5,+document.getElementById('cadTabWidth')?.value||5);
    const tabHeight=Math.max(0,+document.getElementById('cadTabHeight')?.value||.8);
    const peck=Math.max(0,+document.getElementById('cadPeck')?.value||0);
    const spindleDelay=Math.max(0,+document.getElementById('cadSpindleDelay')?.value||0);
    const f=n=>Number(n).toFixed(3);
    const passes=cadDepths(depth,step);
    const out=['(G-code Studio - CAD/CAM Engine 4)','(Unidade: mm)',`(Ferramenta: T${toolN} - ${f(toolD)} mm)`,`(Sobremetal: ${f(allowance)} mm | Acabamento: ${finishPass?'sim':'nao'})`,`(Entrada: ${entry} | Tabs: ${tabsCount})`,`(Operacao: ${operation})`,`(Stepover: ${f(stepover)} mm)`,`(Profundidade: ${f(depth)} mm | Stepdown: ${f(step)} mm)`,`(Feed XY: ${f(feed)} | Plunge: ${f(plunge)} | Spindle: ${Math.round(rpm)})`,'G21','G90','G17','G40','G49',`T${toolN} M6`,`M3 S${Math.round(rpm)}`];
    if(spindleDelay>0)out.push(`G4 P${Number(spindleDelay).toFixed(3)}`);
    out.push(`G0 Z${f(safe)}`);
    let cur={x:0,y:0,z:safe};

    function rapidXY(p){
      if(Math.hypot(cur.x-p.x,cur.y-p.y)>1e-7) out.push(`G0 X${f(p.x)} Y${f(p.y)}`);
      cur.x=p.x;cur.y=p.y;
    }
    function retract(){if(Math.abs(cur.z-safe)>1e-7){out.push(`G0 Z${f(safe)}`);cur.z=safe}}
    function plungeTo(z){out.push(`G1 Z${f(z)} F${f(plunge)}`);cur.z=z}
    function enterCut(points,z){
      if(entry==='ramp'&&points?.length>1){const p0=points[0],p1=points[1];rapidXY(p0);out.push(`G1 X${f(p1.x)} Y${f(p1.y)} Z${f(z)} F${f(plunge)}`);cur={x:p1.x,y:p1.y,z};return 2}
      if(entry==='helix'&&points?.length>2){const bxs=points.map(p=>p.x),bys=points.map(p=>p.y),cx=(Math.min(...bxs)+Math.max(...bxs))/2,cy=(Math.min(...bys)+Math.max(...bys))/2,r=Math.max(.2,Math.min(toolD,Math.max(...bxs)-Math.min(...bxs),Math.max(...bys)-Math.min(...bys))/4);rapidXY({x:cx+r,y:cy});const turns=Math.max(1,Math.ceil(Math.abs(z-cur.z)/Math.max(.2,step)));for(let t=1;t<=turns;t++){const zz=cur.z+(z-cur.z)*t/turns;out.push(`G3 X${f(cx+r)} Y${f(cy)} Z${f(zz)} I${f(-r)} J0.000 F${f(plunge)}`)}cur={x:cx+r,y:cy,z};return 0}
      rapidXY(points[0]);plungeTo(z);return 0
    }

    function cutPath(points,closed=false){
      if(!points||points.length<2)return;
      function emitTabbedLoop(loop,z){
        const lens=[];let total=0;for(let i=1;i<loop.length;i++){const L=Math.hypot(loop[i].x-loop[i-1].x,loop[i].y-loop[i-1].y);lens.push(L);total+=L}
        const centers=Array.from({length:tabsCount},(_,i)=>total*(i+.5)/tabsCount),tabZ=Math.min(0,z+tabHeight);let acc=0;
        for(let i=1;i<loop.length;i++){
          const a=loop[i-1],b=loop[i],L=lens[i-1]||1,marks=centers.filter(c=>c>=acc&&c<=acc+L);let prev=0;
          for(const c of marks){const mid=(c-acc)/L,half=Math.min(.45,tabWidth/(2*L)),t1=Math.max(prev,mid-half),t2=Math.min(1,mid+half),p1={x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1},p2={x:a.x+(b.x-a.x)*t2,y:a.y+(b.y-a.y)*t2};
            out.push(`G1 X${f(p1.x)} Y${f(p1.y)} F${f(feed)}`,`G1 Z${f(tabZ)} F${f(plunge)}`,`G1 X${f(p2.x)} Y${f(p2.y)} F${f(feed)}`,`G1 Z${f(z)} F${f(plunge)}`);prev=t2;cur={x:p2.x,y:p2.y,z};}
          out.push(`G1 X${f(b.x)} Y${f(b.y)} F${f(feed)}`);cur.x=b.x;cur.y=b.y;acc+=L;
        }
      }
      for(let pi=0;pi<passes.length;pi++){
        const z=passes[pi];let startIdx=1;
        if(pi===0||retractEach) retract();
        if(leadIn && points.length>1){
          const p0=points[0],p1=points[1],dx=p1.x-p0.x,dy=p1.y-p0.y,L=Math.hypot(dx,dy)||1;
          const lp={x:p0.x-dx/L*leadLen,y:p0.y-dy/L*leadLen};
          rapidXY(lp);plungeTo(z);out.push(`G1 X${f(p0.x)} Y${f(p0.y)} F${f(feed)}`);cur.x=p0.x;cur.y=p0.y;
        }else startIdx=enterCut(points,z);
        if(closed && tabsCount>0 && pi===passes.length-1){
          if(startIdx>0 && (cur.x!==points[0].x||cur.y!==points[0].y)){out.push(`G1 X${f(points[0].x)} Y${f(points[0].y)} F${f(feed)}`);cur.x=points[0].x;cur.y=points[0].y}
          emitTabbedLoop([...points,points[0]],z);
        }else{
          for(let i=startIdx;i<points.length;i++){out.push(`G1 X${f(points[i].x)} Y${f(points[i].y)}${i===startIdx?` F${f(feed)}`:''}`);cur.x=points[i].x;cur.y=points[i].y}
          if(closed){out.push(`G1 X${f(points[0].x)} Y${f(points[0].y)}`);cur.x=points[0].x;cur.y=points[0].y}
        }
        if(pi<passes.length-1) retract();
      }
      if(retractEach) retract();
    }
    function drill(x,y){
      retract();rapidXY({x,y});
      if(peck>0){
        let z=0;const target=depth;
        while(z>target+1e-9){const next=Math.max(target,z-peck);plungeTo(next);retract();z=next}
      }else{for(const z of passes){plungeTo(z);retract()}}
    }
    function startPoint(e,reverse=false){
      if(e.type==='line')return reverse?{x:e.x2,y:e.y2}:{x:e.x1,y:e.y1};
      if(e.type==='polyline'&&e.points.length)return reverse?e.points[e.points.length-1]:e.points[0];
      if(e.type==='rect')return{x:e.x,y:e.y};
      if(e.type==='circle')return{x:e.cx+e.r,y:e.cy};
      if(e.type==='arc')return reverse?e.p3:e.p1;
      if(e.type==='text')return{x:e.x,y:e.y};
      return{x:0,y:0};
    }
    function orderEntities(list){
      if(!optimize)return list.map(e=>({e,reverse:false}));
      const left=list.slice(),ordered=[];let p={x:cur.x,y:cur.y};
      while(left.length){let bi=0,br=false,bd=Infinity;
        left.forEach((e,i)=>{
          const a=startPoint(e,false),d1=Math.hypot(a.x-p.x,a.y-p.y);if(d1<bd){bd=d1;bi=i;br=false}
          if(e.type==='line'||e.type==='polyline'||e.type==='arc'){const b=startPoint(e,true),d2=Math.hypot(b.x-p.x,b.y-p.y);if(d2<bd){bd=d2;bi=i;br=true}}
        });
        const e=left.splice(bi,1)[0];ordered.push({e,reverse:br});p=startPoint(e,br);
      }
      return ordered;
    }
    function rectPoints(e,mode){
      let x=e.x,y=e.y,w=e.w,h=e.h;
      if(mode==='outside'){const rr=toolR+allowance;x-=rr;y-=rr;w+=2*rr;h+=2*rr}
      if(mode==='inside'){const rr=toolR+allowance;if(w<=2*rr||h<=2*rr){out.push(`(AVISO: ${e.id} menor que a ferramenta para contorno interno)`);return null}x+=rr;y+=rr;w-=2*rr;h-=2*rr}
      return[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
    }
    function machineCircle(e,mode){
      let r=e.r;if(mode==='outside')r+=toolR+allowance;else if(mode==='inside')r-=toolR+allowance;
      if(r<=.0005){out.push(`(AVISO: ${e.id} raio invalido apos compensacao)`);return}
      const sx=e.cx+r,sy=e.cy;
      for(const z of passes){retract();rapidXY({x:sx,y:sy});plungeTo(z);out.push(`G2 X${f(sx)} Y${f(sy)} I${f(-r)} J0.000 F${f(feed)}`);cur.x=sx;cur.y=sy;if(retractEach)retract()}
    }
    function machineArc(e,reverse=false){
      const a=cadArc(e.p1,e.p2,e.p3);if(!a)return;
      const sp=reverse?e.p3:e.p1,ep=reverse?e.p1:e.p3,cw=reverse?a.ccw:!a.ccw;
      for(const z of passes){retract();rapidXY(sp);plungeTo(z);out.push(`${cw?'G2':'G3'} X${f(ep.x)} Y${f(ep.y)} I${f(a.cx-sp.x)} J${f(a.cy-sp.y)} F${f(feed)}`);cur.x=ep.x;cur.y=ep.y;if(retractEach)retract()}
    }

    function pocketRect(e){
      if(e.w<=toolD||e.h<=toolD){out.push(`(AVISO: ${e.id} pequeno demais para pocket)`);return}
      const x0=e.x+toolR,x1=e.x+e.w-toolR,y0=e.y+toolR,y1=e.y+e.h-toolR;
      const rows=[];let y=y0,dir=1;
      while(y<y1-1e-6){rows.push(dir>0?[{x:x0,y},{x:x1,y}]:[{x:x1,y},{x:x0,y}]);y+=stepover;dir*=-1}
      if(!rows.length||Math.abs(rows[rows.length-1][0].y-y1)>1e-6)rows.push(dir>0?[{x:x0,y:y1},{x:x1,y:y1}]:[{x:x1,y:y1},{x:x0,y:y1}]);
      for(const z of passes){
        retract();rapidXY(rows[0][0]);plungeTo(z);
        for(let i=0;i<rows.length;i++){const row=rows[i];if(i>0){out.push(`G1 X${f(row[0].x)} Y${f(row[0].y)} F${f(feed)}`);cur.x=row[0].x;cur.y=row[0].y}out.push(`G1 X${f(row[1].x)} Y${f(row[1].y)}${i===0?` F${f(feed)}`:''}`);cur.x=row[1].x;cur.y=row[1].y}
        out.push(`G1 X${f(x0)} Y${f(y0)} F${f(feed)}`,`G1 X${f(x1)} Y${f(y0)}`,`G1 X${f(x1)} Y${f(y1)}`,`G1 X${f(x0)} Y${f(y1)}`,`G1 X${f(x0)} Y${f(y0)}`);cur.x=x0;cur.y=y0;
      }
      retract();
    }
    function pocketCircle(e){
      const maxR=e.r-toolR;if(maxR<=0.001){out.push(`(AVISO: ${e.id} pequeno demais para pocket)`);return}
      const radii=[];for(let r=Math.min(stepover,maxR);r<maxR-1e-6;r+=stepover)radii.push(r);radii.push(maxR);
      for(const z of passes){
        retract();rapidXY({x:e.cx,y:e.cy});plungeTo(z);
        for(const r of radii){out.push(`G1 X${f(e.cx+r)} Y${f(e.cy)} F${f(feed)}`);cur.x=e.cx+r;cur.y=e.cy;out.push(`G2 X${f(e.cx+r)} Y${f(e.cy)} I${f(-r)} J0.000`)}
      }
      retract();
    }

    const comments=cad.entities.filter(e=>e.type==='text'&&e.purpose!=='machine');
    comments.forEach(e=>out.push(`(COMENTARIO: ${String(e.text||'').replace(/[()]/g,'')})`));
    const machinable=cad.entities.filter(e=>!(e.type==='text'&&e.purpose!=='machine'));
    for(const item of orderEntities(machinable)){
      const e=item.e,rev=item.reverse;out.push(`(Objeto ${e.id} ${e.type})`);
      if(operation==='drill'){if(e.type==='circle')drill(e.cx,e.cy);continue}
      if(operation==='pocket'){if(e.type==='rect')pocketRect(e);else if(e.type==='circle')pocketCircle(e);else if(e.type==='polyline'&&cadIsClosedPolyline(e)){const boundary=cadOffsetPolygon(e.points,-(toolR+allowance));if(!boundary){out.push(`(AVISO: pocket invalido ${e.id})`);continue}const rows=cadPocketScanlines(boundary,stepover);for(const z of passes){retract();if(!rows.length)break;rapidXY(rows[0][0]);plungeTo(z);for(let ri=0;ri<rows.length;ri++){const row=rows[ri];if(ri>0)out.push(`G1 X${f(row[0].x)} Y${f(row[0].y)} F${f(feed)}`);out.push(`G1 X${f(row[1].x)} Y${f(row[1].y)}${ri===0?` F${f(feed)}`:''}`);cur.x=row[1].x;cur.y=row[1].y} }retract();}else out.push(`(Nota: pocket ignorado para ${e.id} ${e.type})`);continue}
      if(e.type==='line')cutPath(rev?[{x:e.x2,y:e.y2},{x:e.x1,y:e.y1}]:[{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}]);
      else if(e.type==='rect'){const pts=rectPoints(e,operation);if(pts)cutPath(pts,true);if(finishPass&&allowance>0&&(operation==='outside'||operation==='inside')){const saved=allowance;const mode=operation;let x=e.x,y=e.y,w=e.w,h=e.h,rr=toolR;if(mode==='outside'){x-=rr;y-=rr;w+=2*rr;h+=2*rr}else{x+=rr;y+=rr;w-=2*rr;h-=2*rr}if(w>0&&h>0){out.push(`(Acabamento ${e.id})`);cutPath([{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],true)}}}
      else if(e.type==='polyline'){
        let pts=rev?[...e.points].reverse():e.points;
        const closed=cadIsClosedPolyline(e);
        if((operation==='outside'||operation==='inside')&&closed){const sign=operation==='outside'?1:-1,off=cadOffsetPolygon(pts,sign*(toolR+allowance));if(off)pts=off;else out.push(`(AVISO: falha offset ${e.id})`)}
        else if(operation!=='follow'&&!closed)out.push(`(Nota: compensacao exige polilinha fechada ${e.id})`);
        cutPath(pts,closed)
        if(finishPass&&allowance>0&&closed&&(operation==='outside'||operation==='inside')){const sign=operation==='outside'?1:-1,fin=cadOffsetPolygon(rev?[...e.points].reverse():e.points,sign*toolR);if(fin){out.push(`(Acabamento ${e.id})`);cutPath(fin,true)}}
      }
      else if(e.type==='circle'){machineCircle(e,operation);if(finishPass&&allowance>0&&(operation==='outside'||operation==='inside')){const fake={...e,r:e.r};out.push(`(Acabamento ${e.id})`);let r=e.r+(operation==='outside'?toolR:-toolR);if(r>0){const sx=e.cx+r,sy=e.cy;for(const z of passes){retract();rapidXY({x:sx,y:sy});plungeTo(z);out.push(`G2 X${f(sx)} Y${f(sy)} I${f(-r)} J0.000 F${f(feed)}`);cur.x=sx;cur.y=sy}}}}
      else if(e.type==='arc'){if(operation!=='follow')out.push(`(Nota: compensacao nao aplicada em arco ${e.id})`);machineArc(e,rev)}
      else if(e.type==='text'&&e.purpose==='machine'){
        let segs=cadTextSegments(e).map(p=>({points:p}));
        if(optimize){const ordered=[];let p={x:cur.x,y:cur.y};while(segs.length){let bi=0,br=false,bd=Infinity;segs.forEach((s,i)=>{let a=s.points[0],b=s.points[1],da=Math.hypot(a.x-p.x,a.y-p.y),db=Math.hypot(b.x-p.x,b.y-p.y);if(da<bd){bd=da;bi=i;br=false}if(db<bd){bd=db;bi=i;br=true}});let q=segs.splice(bi,1)[0].points;if(br)q=[q[1],q[0]];ordered.push(q);p=q[1]}segs=ordered.map(points=>({points}))}
        segs.forEach(s=>cutPath(s.points,false));
      }
    }
    retract();out.push('M5','M30');return out.join('\n');
  }
  document.getElementById('cadGenerate').addEventListener('click',()=>{if(!cad.entities.length)return alert('Desenhe ao menos uma geometria.');const issues=cadValidateCam();if(issues.length&&!confirm('Avisos CAM:\n\n'+issues.join('\n')+'\n\nGerar mesmo assim?'))return;codeEl.value=cadGcode();state.currentFileName='cad_programa.tap';document.getElementById('filename').textContent=state.currentFileName;renderHighlight();runParse();pushHistory();cadDialog.close();setTimeout(fitView,30)});

  function camFieldSnapshot(){const values={};GCS_CAM_FIELDS.forEach(id=>values[id]=document.getElementById(id)?.value);return values}
  function camApplyFields(values){GCS_CAM_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el&&values?.[id]!=null)el.value=values[id]})}
  function camOpEntityIds(op){return Array.isArray(op?.entityIds)?op.entityIds:(op?.entityId?[op.entityId]:[])}
  function camNormalizeQueue(queue){return (Array.isArray(queue)?queue:[]).map((op,index)=>({...op,id:op.id||`OP${Date.now()}_${index}`,name:op.name||`Operação ${index+1}`,entityIds:camOpEntityIds(op),fields:op.fields||{},enabled:op.enabled!==false})).filter(op=>op.entityIds.length)}
  function camValidateOperation(op){const issues=[],entities=camOpEntityIds(op).map(id=>cad.entities.find(e=>e.id===id)).filter(Boolean),f=op.fields||{},tool=+f.cadToolDiameter,depth=+f.cadDepth,feed=+f.cadFeed,plunge=+f.cadPlunge,rpm=+f.cadSpindle,operation=f.cadOperation;if(!entities.length)issues.push('sem objetos válidos');if(!(tool>0))issues.push('diâmetro de ferramenta inválido');if(!(depth<0))issues.push('profundidade deve ser negativa');if(!(feed>0)&&operation!=='drill')issues.push('avanço XY inválido');if(!(plunge>0))issues.push('avanço Z inválido');if(!(rpm>0))issues.push('RPM deve ser maior que zero');entities.forEach(e=>{const b=cadBBox(e),closed=e.type==='rect'||e.type==='circle'||(e.type==='polyline'&&cadIsClosedPolyline(e));if(operation==='pocket'&&!closed)issues.push(`${e.id}: pocket exige geometria fechada`);if((operation==='inside'||operation==='pocket')&&(Math.min(b.w,b.h)<=tool))issues.push(`${e.id}: ferramenta não cabe`);if(b.w<1e-9&&b.h<1e-9)issues.push(`${e.id}: geometria sem dimensão`)});return issues}
  function camRenderPreview(){const op=camQueue.find(x=>x.id===camPreviewId);if(!op)return;const mode=op.fields?.cadOperation,rr=Math.max(0,+op.fields?.cadToolDiameter||0)/2,color='#ffb020';cad.entities.filter(e=>camOpEntityIds(op).includes(e.id)).forEach(e=>{let q=cadClone(e);if(q.type==='rect'&&(mode==='inside'||mode==='outside')){const d=mode==='outside'?rr:-rr;q.x-=d;q.y-=d;q.w+=2*d;q.h+=2*d}else if(q.type==='circle'&&(mode==='inside'||mode==='outside'))q.r+=mode==='outside'?rr:-rr;const n=cadEl(q);if(n){n.removeAttribute('class');n.removeAttribute('data-id');n.setAttribute('stroke',color);n.setAttribute('fill','none');n.setAttribute('stroke-width',1/cad.zoom);n.setAttribute('stroke-dasharray',`${4/cad.zoom} ${3/cad.zoom}`);n.style.pointerEvents='none';cadOverlay.appendChild(n)}})}
  function camApplyProfile(lines,id){const profile=window.gcsCamProfile(id),headerSet=new Set(['G21','G90','G17','G40','G49','G64 P0.01','%','O1000','G21 G90 G17 G40 G49']),footer=/^(M5|M0?2|M30|M84|%)\s*$/i;let body=lines.filter(line=>!headerSet.has(line.trim())&&!footer.test(line.trim()));if(!profile.toolChange)body=body.map(line=>{const m=line.match(/^T(\d+)\s*M0?6\s*$/i);return m?`(Troca manual para T${m[1]})\nM0`:line});return[...profile.header,...body,...profile.footer]}
  function camQueueRender(){
    const box=document.getElementById('cadQueueList');if(!box)return;
    box.innerHTML=camQueue.length?camQueue.map((op,i)=>`<div class="prod-item" data-cam-row="${i}"><b>${i+1}</b><span class="grow"><b>${prodEscape(op.name)}</b><br>${camOpEntityIds(op).length} objeto(s) · ${prodEscape(op.fields.cadOperation)} · T${prodEscape(op.fields.cadToolNumber)} · Z${prodEscape(op.fields.cadDepth)}</span><button data-cam-edit="${i}" title="Editar">✎</button><button data-cam-copy="${i}" title="Duplicar">⧉</button><button data-cam-up="${i}" title="Subir">↑</button><button data-cam-down="${i}" title="Descer">↓</button><button data-cam-delete="${i}" title="Excluir">×</button></div>`).join(''):'<span style="color:var(--text-faint)">Fila vazia. Selecione um ou mais objetos e adicione uma operação.</span>';
    box.querySelectorAll('[data-cam-row]').forEach(row=>row.onclick=e=>{if(e.target.closest('button'))return;const op=camQueue[+row.dataset.camRow];camPreviewId=op.id;cadSetSelection(camOpEntityIds(op));cadRender();camRenderPreview()});
    box.querySelectorAll('[data-cam-edit]').forEach(b=>b.onclick=()=>{const op=camQueue[+b.dataset.camEdit];camEditingId=op.id;cadSetSelection(camOpEntityIds(op));camApplyFields(op.fields);document.getElementById('cadQueueName').value=op.name;document.getElementById('cadQueueAdd').textContent='Salvar operação';cadRender()});
    box.querySelectorAll('[data-cam-copy]').forEach(b=>b.onclick=()=>{const i=+b.dataset.camCopy,copy=cadClone(camQueue[i]);copy.id=`OP${Date.now()}`;copy.name+=' (cópia)';camQueue.splice(i+1,0,copy);camQueueRender();cadCommitHistory()});
    box.querySelectorAll('[data-cam-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.camUp;if(i>0)[camQueue[i-1],camQueue[i]]=[camQueue[i],camQueue[i-1]];camQueueRender();cadCommitHistory();gcsAutosaveFull()});
    box.querySelectorAll('[data-cam-down]').forEach(b=>b.onclick=()=>{const i=+b.dataset.camDown;if(i<camQueue.length-1)[camQueue[i+1],camQueue[i]]=[camQueue[i],camQueue[i+1]];camQueueRender();cadCommitHistory();gcsAutosaveFull()});
    box.querySelectorAll('[data-cam-delete]').forEach(b=>b.onclick=()=>{camQueue.splice(+b.dataset.camDelete,1);camQueueRender();cadCommitHistory();gcsAutosaveFull()});
  }
  document.getElementById('cadQueueAdd').addEventListener('click',()=>{
    const entities=cadSelection();if(!entities.length)return alert('Selecione um ou mais objetos do desenho para adicionar à fila CAM.');
    const issues=cadValidateCam();if(issues.length)return alert('Corrija os parâmetros antes de adicionar:\n\n'+issues.join('\n'));
    const name=document.getElementById('cadQueueName').value.trim()||`Operação ${camQueue.length+1}`,operation={id:camEditingId||`OP${Date.now()}`,name,entityIds:entities.map(e=>e.id),fields:camFieldSnapshot(),enabled:true};const editIndex=camQueue.findIndex(op=>op.id===camEditingId);if(editIndex>=0)camQueue[editIndex]=operation;else camQueue.push(operation);camEditingId=null;document.getElementById('cadQueueAdd').textContent='+ Operação da seleção';camQueueRender();cadCommitHistory();gcsAutosaveFull();
  });
  document.getElementById('cadQueueGenerate').addEventListener('click',()=>{
    const active=camQueue.filter(op=>op.enabled!==false&&camOpEntityIds(op).some(id=>cad.entities.some(e=>e.id===id)));if(!active.length)return alert('A fila CAM não possui operações válidas.');
    const invalid=active.flatMap((op,i)=>camValidateOperation(op).map(text=>`Operação ${i+1} (${op.name}): ${text}`));if(invalid.length)return alert('A fila CAM possui erros:\n\n'+invalid.join('\n'));
    const savedEntities=cad.entities,savedFields=camFieldSnapshot(),programs=[];
    try{
      let previousTool=null;active.forEach((op,i)=>{cad.entities=savedEntities.filter(e=>camOpEntityIds(op).includes(e.id));camApplyFields(op.fields);const tool=String(op.fields.cadToolNumber||'1');let part=cadGcode().split(/\r?\n/).filter(line=>!/^M30\s*$/i.test(line));if(tool===previousTool){if(programs.at(-1)==='M5')programs.pop();part=part.filter(line=>!/^T\d+\s*M0?6\s*$/i.test(line))}programs.push(`(===== OPERACAO ${i+1}: ${String(op.name||'CAM').replace(/[()]/g,'')} =====)`,...part);previousTool=tool});
    }finally{cad.entities=savedEntities;camApplyFields(savedFields)}
    const profileId=document.getElementById('cadMachineProfile').value,profile=window.gcsCamProfile(profileId),output=camApplyProfile(programs,profileId);codeEl.value=output.join('\n');state.currentFileName=`cad_fila_cam.${profile.extension}`;filename.textContent=state.currentFileName;renderHighlight();runParse();pushHistory();cadDialog.close();setTimeout(fitView,30);
  });


  // ============================================================
  // PROJETO GCS + AUTOSAVE COMPLETO
  // ============================================================
  const GCS_CAM_FIELDS=['cadOperation','cadToolDiameter','cadToolNumber','cadAllowance','cadFinishPass','cadStepover','cadSafeZ','cadDepth','cadStepDown','cadFeed','cadPlunge','cadSpindle','cadOptimize','cadRetractEach','cadEntry','cadLeadIn','cadLeadLen','cadTabsCount','cadTabWidth','cadTabHeight','cadPeck','cadSpindleDelay'];
  function gcsProjectObject(){const cam={};GCS_CAM_FIELDS.forEach(id=>cam[id]=document.getElementById(id)?.value);return{format:'GCODE_STUDIO_PROJECT',version:4,savedAt:new Date().toISOString(),name:state.currentFileName,code:codeEl.value,cad:{entities:cad.entities,nextId:cad.nextId,grid:cad.grid},cam,camQueue,machineProfile:document.getElementById('cadMachineProfile').value,config:{stock:config.stock,limits:config.limits,safeZ:config.safeZ,rapidRate:config.rapidRate,workOffsets:config.workOffsets},view:{plane:state.viewPlane,azimuth:state.isoAzimuth,elevation:state.isoElevation,projection:state.projectionMode}}}
  function gcsApplyProject(p){if(!p||p.format!=='GCODE_STUDIO_PROJECT')throw new Error('Projeto GCS inválido');codeEl.value=p.code||'';state.currentFileName=p.name||'projeto.tap';filename.textContent=state.currentFileName;if(p.cad){cad.entities=Array.isArray(p.cad.entities)?p.cad.entities:[];cad.nextId=p.cad.nextId||cad.entities.length+1;cad.grid=p.cad.grid||10}cadSetSelection([]);if(p.cam)GCS_CAM_FIELDS.forEach(id=>{if(p.cam[id]!=null&&document.getElementById(id))document.getElementById(id).value=p.cam[id]});camQueue=camNormalizeQueue(p.camQueue);if(p.machineProfile&&window.GCS_CAM_PROFILES?.[p.machineProfile])document.getElementById('cadMachineProfile').value=p.machineProfile;if(p.config){if(p.config.stock)Object.assign(config.stock,p.config.stock);if(p.config.limits)Object.assign(config.limits,p.config.limits);if(p.config.safeZ!=null)config.safeZ=p.config.safeZ;if(p.config.rapidRate)config.rapidRate=p.config.rapidRate;if(p.config.workOffsets)config.workOffsets=p.config.workOffsets}if(p.view){state.isoAzimuth=p.view.azimuth??state.isoAzimuth;state.isoElevation=p.view.elevation??state.isoElevation;state.projectionMode=p.view.projection||state.projectionMode}cadCommitHistory();renderHighlight();runParse();cadRender();camQueueRender();cadFit();fitView();cadUpdateCamSummary()}
  function gcsAutosaveFull(){try{localStorage.setItem('gcsProjectAutosaveV1',JSON.stringify(gcsProjectObject()))}catch(e){console.warn('Autosave projeto:',e)}}
  setInterval(gcsAutosaveFull,10000);
  document.getElementById('cadSaveProject').addEventListener('click',()=>cadDownload('projeto.gcs',JSON.stringify(gcsProjectObject(),null,2),'application/json'));
  document.getElementById('cadOpenProject').addEventListener('click',()=>document.getElementById('cadProjectInput').click());
  document.getElementById('cadProjectInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{gcsApplyProject(JSON.parse(await f.text()))}catch(err){alert('Não foi possível abrir o projeto: '+err.message)}e.target.value=''});
  document.getElementById('cadRecoverProject').addEventListener('click',()=>{try{const p=JSON.parse(localStorage.getItem('gcsProjectAutosaveV1')||'null');if(!p)return alert('Nenhum autosave disponível.');gcsApplyProject(p)}catch(e){alert('Autosave inválido.')}});





  // ============================================================
  // AJUDA
  // ============================================================
  const helpDialog = document.getElementById('helpDialog');
  document.getElementById('btnHelp').addEventListener('click', () => {
    helpDialog.showModal();
    document.getElementById('btnCloseHelp').focus();
  });
  document.getElementById('btnCloseHelp').addEventListener('click', () => helpDialog.close());
  helpDialog.addEventListener('click', (e) => {
    const r = helpDialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if(!inside) helpDialog.close();
  });


  // ============================================================
  // TOUCH / MOBILE GESTURES
  // ============================================================
  const touchState={
    active:false,
    mode:null,
    lastX:0,lastY:0,
    startDistance:0,
    startScale:1,
    centerX:0,centerY:0
  };

  function touchPoint(t){
    const r=canvas.getBoundingClientRect();
    return {x:t.clientX-r.left,y:t.clientY-r.top};
  }

  function touchDistance(a,b){
    return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  }

  function touchCenter(a,b){
    const r=canvas.getBoundingClientRect();
    return {
      x:(a.clientX+b.clientX)/2-r.left,
      y:(a.clientY+b.clientY)/2-r.top
    };
  }

  canvas.addEventListener('touchstart',e=>{
    if(state.measureMode)return;

    if(e.touches.length===1){
      const p=touchPoint(e.touches[0]);
      touchState.active=true;
      touchState.lastX=p.x;
      touchState.lastY=p.y;

      // 1 dedo: orbita no ISO; pan nas vistas 2D.
      touchState.mode=state.viewPlane==='ISO'?'orbit':'pan';
    }else if(e.touches.length===2){
      touchState.active=true;
      touchState.mode='pinch';
      touchState.startDistance=touchDistance(e.touches[0],e.touches[1]);
      touchState.startScale=state.scale;
      const c=touchCenter(e.touches[0],e.touches[1]);
      touchState.centerX=c.x;
      touchState.centerY=c.y;
    }

    e.preventDefault();
  },{passive:false});

  canvas.addEventListener('touchmove',e=>{
    if(!touchState.active||state.measureMode)return;

    if(e.touches.length===1 && touchState.mode!=='pinch'){
      const p=touchPoint(e.touches[0]);
      const dx=p.x-touchState.lastX;
      const dy=p.y-touchState.lastY;

      if(touchState.mode==='orbit' && state.viewPlane==='ISO'){
        setOrbitAnglesKeepCenter(
          state.isoAzimuth + dx*state.orbitSensitivity,
          state.isoElevation - dy*state.orbitSensitivity
        );
      }else{
        state.offsetX+=dx;
        state.offsetY+=dy;
      }

      touchState.lastX=p.x;
      touchState.lastY=p.y;
      drawCanvas();
    }

    if(e.touches.length===2){
      const dist=touchDistance(e.touches[0],e.touches[1]);
      if(touchState.startDistance>0){
        const factor=dist/touchState.startDistance;
        const newScale=Math.max(0.001,touchState.startScale*factor);

        const c=touchCenter(e.touches[0],e.touches[1]);
        const zoomFactor=newScale/state.scale;

        state.offsetX=c.x-(c.x-state.offsetX)*zoomFactor;
        state.offsetY=c.y-(c.y-state.offsetY)*zoomFactor;
        state.scale=newScale;
        drawCanvas();
      }
    }

    e.preventDefault();
  },{passive:false});

  canvas.addEventListener('touchend',e=>{
    if(e.touches.length===0){
      touchState.active=false;
      touchState.mode=null;
    }else if(e.touches.length===1){
      const p=touchPoint(e.touches[0]);
      touchState.mode=state.viewPlane==='ISO'?'orbit':'pan';
      touchState.lastX=p.x;
      touchState.lastY=p.y;
    }
    e.preventDefault();
  },{passive:false});

  // No mobile, um toque longo no canvas alterna temporariamente para pan no ISO.
  let longPressTimer=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||state.viewPlane!=='ISO')return;
    clearTimeout(longPressTimer);
    longPressTimer=setTimeout(()=>{
      touchState.mode='pan';
      if(navigator.vibrate)navigator.vibrate(15);
    },450);
  });
  canvas.addEventListener('pointerup',()=>clearTimeout(longPressTimer));
  canvas.addEventListener('pointercancel',()=>clearTimeout(longPressTimer));

  function updateResponsiveLayout(){
    const mobile=window.matchMedia('(max-width: 900px)').matches;

    // Em mobile, o gráfico XYZ começa fechado para preservar área útil.
    if(mobile && document.getElementById('chkShowXYZChart')?.checked){
      document.getElementById('chkShowXYZChart').checked=false;
      if(typeof updateXYZChartVisibility==='function')updateXYZChartVisibility();
    }

    // Evita canvas com dimensões antigas após troca de orientação.
    requestAnimationFrame(()=>{
      drawCanvas();
      if(state.bbox)fitView();
    });
  }

  window.addEventListener('orientationchange',()=>{
    setTimeout(updateResponsiveLayout,120);
  });

  const responsiveMQ=window.matchMedia('(max-width: 900px)');
  if(responsiveMQ.addEventListener)responsiveMQ.addEventListener('change',updateResponsiveLayout);


  document.querySelectorAll('dialog').forEach(dlg=>{
    if(dlg.dataset.outsideCloseBound)return;
    dlg.dataset.outsideCloseBound='1';
    dlg.addEventListener('click',e=>{
      if(e.target!==dlg)return;
      const r=dlg.getBoundingClientRect();
      const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
      if(!inside&&dlg.open)dlg.close();
    });
  });

  // ============================================================
  // SOBRE
  // ============================================================
  const aboutDialog = document.getElementById('aboutDialog');
  document.getElementById('btnAbout').addEventListener('click', () => {
    aboutDialog.showModal();
    document.getElementById('btnCloseAbout').focus();
  });
  document.getElementById('btnCloseAbout').addEventListener('click', () => {
    aboutDialog.close();
  });
  aboutDialog.addEventListener('click', (e) => {
    const r = aboutDialog.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom;
    if(!inside) aboutDialog.close();
  });

  // ============================================================
  // DIÁLOGOS DE MENSAGEM HTML5
  // ============================================================
  const msgDialog = document.getElementById('msgDialog');
  const msgDialogTitle = document.getElementById('msgDialogTitle');
  const msgDialogBody = document.getElementById('msgDialogBody');
  const msgDialogIcon = document.getElementById('msgDialogIcon');
  const msgDialogActions = document.getElementById('msgDialogActions');

  function showMessageDialog({
    title='Mensagem',
    message='',
    icon='i',
    buttons=[{label:'OK', value:'ok', primary:true}]
  } = {}){
    return new Promise(resolve => {
      msgDialogTitle.textContent = title;
      msgDialogBody.textContent = message;
      msgDialogIcon.textContent = icon;
      msgDialogActions.innerHTML = '';

      let settled = false;

      const finish = (value) => {
        if(settled) return;
        settled = true;
        msgDialog.close();
        resolve(value);
      };

      buttons.forEach(btn => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className =
          'btn' +
          (btn.primary ? ' primary' : '') +
          (btn.danger ? ' danger' : '');
        el.textContent = btn.label;
        el.addEventListener('click', () => finish(btn.value));
        msgDialogActions.appendChild(el);
      });

      // Esc equivale ao último botão (normalmente Cancelar/Fechar).
      const cancelValue = buttons.length
        ? buttons[buttons.length - 1].value
        : null;

      const onCancel = (e) => {
        e.preventDefault();
        msgDialog.removeEventListener('cancel', onCancel);
        finish(cancelValue);
      };

      msgDialog.addEventListener('cancel', onCancel, {once:true});

      msgDialog.showModal();

      const focusTarget =
        msgDialogActions.querySelector('.primary') ||
        msgDialogActions.querySelector('button');
      if(focusTarget) focusTarget.focus();
    });
  }

  function htmlAlert(message, title='Aviso'){
    return showMessageDialog({
      title,
      message,
      icon:'!',
      buttons:[
        {label:'OK', value:true, primary:true}
      ]
    });
  }

  function htmlConfirm(message, title='Confirmação'){
    return showMessageDialog({
      title,
      message,
      icon:'?',
      buttons:[
        {label:'Confirmar', value:true, primary:true},
        {label:'Cancelar', value:false}
      ]
    });
  }

  const els = {
    statLines: document.getElementById('statLines'),
    statCurLine: document.getElementById('statCurLine'),
    statToolCount: document.getElementById('statToolCount'),
    statWarnCount: document.getElementById('statWarnCount'),
    droX: document.getElementById('droX'), droY: document.getElementById('droY'), droZ: document.getElementById('droZ'),
    scrub: document.getElementById('scrub'), playIdx: document.getElementById('playIdx'),
    statBBox: document.getElementById('statBBox'),
    statLimitStatus: document.getElementById('statLimitStatus')
  };


  // ============================================================
  // PRÉ-PROCESSADOR: MACROS SIMPLES + M98/M99
  // ============================================================
  function evalMacroExpr(expr, vars){
    let s=String(expr||'').replace(/#(\d+)/g,(_,n)=>String(vars[n]??0))
      .replace(/\bEQ\b/gi,'==').replace(/\bNE\b/gi,'!=').replace(/\bGT\b/gi,'>')
      .replace(/\bLT\b/gi,'<').replace(/\bGE\b/gi,'>=').replace(/\bLE\b/gi,'<=')
      .replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||');
    if(!/^[0-9+\-*/().<>=!&| \t]+$/.test(s)) return 0;
    try{return Number(Function(`"use strict";return (${s})`)())||0;}catch{return 0;}
  }

  function preprocessProgram(raw){
    const source=String(raw||'').split(/\r?\n/);
    const subs={};
    const main=[];
    // Detecta Oxxxx que termina em M99 como subprograma.
    for(let i=0;i<source.length;i++){
      const om=source[i].match(/^\s*O(\d+)\b/i);
      if(om){
        let j=i+1, found=false;
        for(;j<source.length;j++){
          if(/\bM99\b/i.test(source[j])){found=true;break;}
          if(/^\s*O\d+\b/i.test(source[j]))break;
        }
        if(found){
          subs[Number(om[1])]=source.slice(i+1,j);
          i=j;continue;
        }
      }
      main.push(source[i]);
    }

    function expandSubs(lines,depth=0){
      if(depth>6)return lines;
      const out=[];
      lines.forEach(line=>{
        const m=line.match(/\bM98\s+P(\d+)(?:\s+L(\d+))?/i);
        if(m && subs[Number(m[1])]){
          const count=Math.max(1,Math.min(100,Number(m[2]||1)));
          for(let k=0;k<count;k++) out.push(...expandSubs(subs[Number(m[1])],depth+1));
        }else if(!/\bM99\b/i.test(line)) out.push(line);
      });
      return out;
    }

    const expanded=expandSubs(main);
    const vars={};
    const out=[];
    for(let i=0;i<expanded.length;i++){
      let line=expanded[i];
      const assign=line.match(/^\s*#(\d+)\s*=\s*(.+)$/);
      if(assign){vars[assign[1]]=evalMacroExpr(assign[2].replace(/[\[\]]/g,''),vars);continue;}

      const wh=line.match(/^\s*WHILE\s*\[(.+)\]\s*DO(\d+)/i);
      if(wh){
        const id=wh[2], block=[];let j=i+1,level=1;
        for(;j<expanded.length;j++){
          if(new RegExp(`^\\s*WHILE.*DO${id}\\b`,'i').test(expanded[j]))level++;
          if(new RegExp(`^\\s*END${id}\\b`,'i').test(expanded[j])){level--;if(level===0)break;}
          if(level>0)block.push(expanded[j]);
        }
        let guard=0;
        while(evalMacroExpr(wh[1],vars) && guard++<500){
          block.forEach(bl=>{
            const a=bl.match(/^\s*#(\d+)\s*=\s*(.+)$/);
            if(a)vars[a[1]]=evalMacroExpr(a[2].replace(/[\[\]]/g,''),vars);
            else out.push(bl.replace(/\[([^\]]+)\]/g,(_,e)=>String(evalMacroExpr(e,vars))).replace(/#(\d+)/g,(_,n)=>String(vars[n]??0)));
          });
        }
        i=j;continue;
      }

      line=line.replace(/\[([^\]]+)\]/g,(_,e)=>String(evalMacroExpr(e,vars)))
               .replace(/#(\d+)/g,(_,n)=>String(vars[n]??0));
      out.push(line);
    }
    return out.join('\n');
  }


  // ============================================================
  // DETECÇÃO AUTOMÁTICA: CNC / IMPRESSÃO 3D
  // ============================================================
  function detectJobType(code){
    const src=String(code||'');
    let printScore=0, cncScore=0;
    const printEvidence=[], cncEvidence=[];

    const add=(kind,score,label)=>{
      if(kind==='print'){printScore+=score;if(!printEvidence.includes(label))printEvidence.push(label);}
      else{cncScore+=score;if(!cncEvidence.includes(label))cncEvidence.push(label);}
    };

    // Sinais fortes de impressão FDM.
    if(/\bM10[49]\b|\bM140\b|\bM190\b/i.test(src)) add('print',6,'controle de temperatura');
    if(/\bM82\b|\bM83\b/i.test(src)) add('print',5,'modo de extrusão M82/M83');
    if(/\bG92\s+E[-+]?\d/i.test(src)) add('print',4,'reset do extrusor G92 E');
    if(/;\s*(LAYER|TYPE|TIME_ELAPSED|MESH|FLAVOR|FILAMENT)/i.test(src)) add('print',5,'metadados de slicer');

    const extrusionMoves=(src.match(/^\s*(?:N\d+\s+)?G0?1\b[^\r\n;]*\bE[-+]?\d*\.?\d+/gim)||[]).length;
    if(extrusionMoves>=3) add('print',Math.min(10,3+Math.floor(extrusionMoves/20)),'movimentos com eixo E');

    // Sinais fortes de usinagem CNC.
    if(/\bM0?[34]\b/i.test(src)) add('cnc',6,'spindle M3/M4');
    if(/\bM0?5\b/i.test(src)) add('cnc',3,'spindle M5');
    if(/\bM0?6\b/i.test(src)) add('cnc',6,'troca de ferramenta M6');
    if(/\bG8[123]\b/i.test(src)) add('cnc',6,'ciclo de furação');
    if(/\bG4[12]\b/i.test(src)) add('cnc',3,'compensação G41/G42');
    if(/(?:DIA(?:METRO)?|Ø|FRESA|MILL|ENDMILL|V-BIT|BALL\s*NOSE)/i.test(src)) add('cnc',4,'descrição de ferramenta CNC');

    // Em empate/arquivo ambíguo, CNC é o comportamento conservador da V1.
    const type=printScore>cncScore ? 'print3d' : 'cnc';
    const total=Math.max(1,printScore+cncScore);
    const confidence=Math.abs(printScore-cncScore)/total;

    return {
      type,confidence,
      printScore,cncScore,
      evidence:type==='print3d'?printEvidence:cncEvidence
    };
  }

  function applyDetectedJobType(code){
    const d=detectJobType(code);
    state.jobType=d.type;
    state.jobConfidence=d.confidence;
    state.jobEvidence=d.evidence;

    // O bloco representa matéria-prima removida; não faz sentido em FDM.
    // Não alteramos permanentemente a preferência do checkbox: apenas o renderer
    // ignora o stock quando o arquivo detectado é impressão 3D.
    return d;
  }

  /* ============================================================
     PARSER DE G-CODE
  ============================================================ */
  function parseGCode(text){
    text=preprocessProgram(text);
    const lines=text.split(/\r?\n/);
    const st={
      x:0,y:0,z:0,e:0,units:'mm',absolute:true,extruderAbsolute:true,plane:'XY',motion:null,feed:300,
      currentTool:1, spindle:false, spindleRPM:0, comp:'G40', coolant:'off', workOffset:'G54',
      cycle:null, cycleR:0, cycleZ:0, cycleQ:0, cycleP:0
    };
    const segments=[], tools=[], warnings=[];
    const bbox={minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity};
    let sawUnits=false, sawDistance=false;
    let printFeature='UNKNOWN',printLayer=-1;

    const extend=p=>{
      bbox.minX=Math.min(bbox.minX,p.x); bbox.maxX=Math.max(bbox.maxX,p.x);
      bbox.minY=Math.min(bbox.minY,p.y); bbox.maxY=Math.max(bbox.maxY,p.y);
      bbox.minZ=Math.min(bbox.minZ,p.z); bbox.maxZ=Math.max(bbox.maxZ,p.z);
    };
    const toolFor=n=>state.toolLibrary[n] || {
      number:n,name:`T${n}`,type:'endmill',diameter:config.toolDiameter,angle:60,flutes:2,stickout:25,holderDiameter:20,holderLength:45
    };
    const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);

    function pushLinear(type,start,end,line,feed,extra={}){
      if(distance(start,end)<1e-9) return;
      const tool=toolFor(st.currentTool);
      const rate=type==='rapid' ? config.rapidRate : Math.max(feed,0.001);
      const length=distance(start,end);
      const durationSec=(length/rate)*60;
      segments.push({
        type,start:{...start},end:{...end},line,feed,toolNumber:st.currentTool,
        toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,flutes:tool.flutes||2,stickout:tool.stickout||25,holderDiameter:tool.holderDiameter||20,holderLength:tool.holderLength||45,
        spindle:st.spindle,spindleRPM:st.spindleRPM,comp:st.comp,coolant:st.coolant,workOffset:st.workOffset,length,durationSec,...extra
      });
      extend(start); extend(end);
    }

    function pushArc(start,end,i,j,k,r,cw,plane,line,feed,extra={}){
      const arc=computeArc(start,end,i,j,k,r,cw,plane);
      if(arc.warning) warnings.push({line,severity:'warn',text:arc.warning});
      let length=0, prev=start;
      arc.points.forEach(p=>{length+=distance(prev,p);prev=p;});
      length+=distance(prev,end);
      const tool=toolFor(st.currentTool);
      const durationSec=(length/Math.max(feed,0.001))*60;
      segments.push({
        type:'arc',start:{...start},end:{...end},points:arc.points,line,feed,
        toolNumber:st.currentTool,toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,flutes:tool.flutes||2,stickout:tool.stickout||25,holderDiameter:tool.holderDiameter||20,holderLength:tool.holderLength||45,
        spindle:st.spindle,spindleRPM:st.spindleRPM,comp:st.comp,coolant:st.coolant,workOffset:st.workOffset,length,durationSec,
        clockwise:cw,plane,center:arc.center,radius:arc.radius,sweep:arc.sweep,...extra
      });
      extend(start); arc.points.forEach(extend); extend(end);
    }

    function runDrillCycle(lineNum,targetXY,cycle,feed){
      const tool=toolFor(st.currentTool);
      const start={x:st.x,y:st.y,z:st.z};
      const atXY={x:targetXY.x,y:targetXY.y,z:start.z};
      pushLinear('rapid',start,atXY,lineNum,feed,{cycle});
      const rPt={x:targetXY.x,y:targetXY.y,z:st.cycleR};
      pushLinear('rapid',atXY,rPt,lineNum,feed,{cycle});
      if(cycle==='G83'){
        const q=Math.max(0.001,Math.abs(st.cycleQ||Math.abs(st.cycleZ-st.cycleR)));
        let depth=st.cycleR;
        while(depth>st.cycleZ+1e-9){
          const nextDepth=Math.max(st.cycleZ,depth-q);

          // Aproximação visual de peck drilling:
          // cada novo mergulho parte do plano R e alcança uma profundidade maior.
          pushLinear(
            'cut',
            {x:targetXY.x,y:targetXY.y,z:st.cycleR},
            {x:targetXY.x,y:targetXY.y,z:nextDepth},
            lineNum,feed,{cycle}
          );

          depth=nextDepth;

          if(depth>st.cycleZ+1e-9){
            pushLinear(
              'rapid',
              {x:targetXY.x,y:targetXY.y,z:depth},
              {x:targetXY.x,y:targetXY.y,z:st.cycleR},
              lineNum,feed,{cycle}
            );
          }
        }
      }else{
        pushLinear('cut',rPt,{x:targetXY.x,y:targetXY.y,z:st.cycleZ},lineNum,feed,{cycle,dwell:cycle==='G82'?st.cycleP:0});
        if(cycle==='G82' && st.cycleP>0){
          // dwell virtual, no geometry
          segments.push({
            type:'dwell',start:{x:targetXY.x,y:targetXY.y,z:st.cycleZ},
            end:{x:targetXY.x,y:targetXY.y,z:st.cycleZ},line:lineNum,feed:0,
            toolNumber:st.currentTool,toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,
            durationSec:st.cycleP>10?st.cycleP/1000:st.cycleP,length:0,cycle
          });
        }
      }
      pushLinear('rapid',{x:targetXY.x,y:targetXY.y,z:st.cycleZ},
        {x:targetXY.x,y:targetXY.y,z:st.cycleR},lineNum,feed,{cycle});
      st.x=targetXY.x; st.y=targetXY.y; st.z=st.cycleR;
    }

    lines.forEach((raw,idx)=>{
      const lineNum=idx+1;
      const cm=raw.match(/(?:;TYPE:|;FEATURE:|;TYPE\s*=\s*)([^;]+)/i);if(cm)printFeature=cm[1].trim().toUpperCase();
      const lm=raw.match(/;LAYER:\s*(-?\d+)/i);if(lm)printLayer=parseInt(lm[1],10);
      let line=raw.replace(/\([^)]*\)/g,'');
      const semi=line.indexOf(';'); if(semi>=0) line=line.slice(0,semi);
      line=line.trim();

      const tMatch=raw.match(/\bT(\d+)\b/i);
      if(tMatch){
        st.currentTool=parseInt(tMatch[1],10);
        const tool=toolFor(st.currentTool);
        const diaMatch=raw.match(/(?:DIA(?:METRO)?|Ø|FRESA|TOOL|MILL|BIT)[^\d]*(\d+(?:[.,]\d+)?)\s*MM/i);
        if(diaMatch){
          tool.diameter=parseFloat(diaMatch[1].replace(',','.'))||tool.diameter;
          state.toolLibrary[st.currentTool]=tool;
        }
      }
      if(/\bM0?6\b/i.test(raw)){
        const tool=toolFor(st.currentTool);
        tools.push({line:lineNum,tool:String(st.currentTool),raw:raw.trim(),definition:tool});
      }

      if(!line) return;
      const words=[...line.matchAll(/([A-Za-z])\s*(-?\d*\.?\d+)/g)]
        .map(m=>({letter:m[1].toUpperCase(),val:parseFloat(m[2])}));
      if(!words.length) return;
      const get=L=>{const w=words.find(w=>w.letter===L);return w?w.val:undefined;};
      const gCodes=words.filter(w=>w.letter==='G').map(w=>w.val);
      const mCodes=words.filter(w=>w.letter==='M').map(w=>w.val);

      gCodes.forEach(g=>{
        if(g===20){st.units='in';sawUnits=true;}
        else if(g===21){st.units='mm';sawUnits=true;}
        else if(g===90){st.absolute=true;sawDistance=true;}
        else if(g===91){st.absolute=false;sawDistance=true;}
        else if(g===17) st.plane='XY';
        else if(g===18) st.plane='XZ';
        else if(g===19) st.plane='YZ';
        else if(g===40) st.comp='G40';
        else if(g===41) st.comp='G41';
        else if(g===42) st.comp='G42';
        else if(g>=54 && g<=59){st.workOffset=`G${g}`;state.activeWorkOffset=st.workOffset;}
        else if(g===80) st.cycle=null;
        else if([81,82,83].includes(g)) st.cycle=`G${g}`;
      });

      mCodes.forEach(m=>{
        if(m===3||m===4){st.spindle=true;const s=get('S');if(s!==undefined)st.spindleRPM=s;}
        else if(m===5) st.spindle=false;
        else if(m===7) st.coolant='mist';
        else if(m===8) st.coolant='flood';
        else if(m===9) st.coolant='off';
        else if(m===82) st.extruderAbsolute=true;
        else if(m===83) st.extruderAbsolute=false;
      });
      const s=get('S'); if(s!==undefined) st.spindleRPM=s;

      const unitScale=st.units==='in'?25.4:1;
      const f=get('F'); if(f!==undefined) st.feed=f*unitScale;

      // Impressoras 3D usam G92 E... para redefinir a posição lógica do extrusor.
      if(gCodes.includes(92)){
        const ev=get('E');
        if(ev!==undefined) st.e=ev;
        // G92 sem movimento não cria geometria.
        if(!['X','Y','Z'].some(L=>get(L)!==undefined)) return;
      }

      // Eventos de máquina sem geometria.
      const eventM=mCodes.find(m=>m===0||m===1||m===30);
      if(eventM!==undefined){
        const tool=toolFor(st.currentTool);
        segments.push({
          type:'event',event:eventM===0?'M0':eventM===1?'M1':'M30',
          start:{x:st.x,y:st.y,z:st.z},end:{x:st.x,y:st.y,z:st.z},
          line:lineNum,feed:0,durationSec:0,length:0,toolNumber:st.currentTool,
          toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,
          spindle:st.spindle,spindleRPM:st.spindleRPM,coolant:st.coolant,workOffset:st.workOffset
        });
      }

      // G28/G30: retorno à posição configurada de máquina.
      const homeCode=gCodes.find(g=>g===28||g===30);
      if(homeCode!==undefined){
        const home=homeCode===28?config.home28:config.home30;
        const start={x:st.x,y:st.y,z:st.z};
        const end={x:home.x,y:home.y,z:home.z};
        pushLinear('rapid',start,end,lineNum,st.feed,{machineHome:`G${homeCode}`});
        st.x=end.x;st.y=end.y;st.z=end.z;
        return;
      }

      if(st.cycle){
        const r=get('R'); if(r!==undefined) st.cycleR=r*unitScale;
        const z=get('Z'); if(z!==undefined) st.cycleZ=z*unitScale;
        const q=get('Q'); if(q!==undefined) st.cycleQ=q*unitScale;
        const p=get('P'); if(p!==undefined) st.cycleP=p;
        const tx=get('X'), ty=get('Y');
        if(tx!==undefined || ty!==undefined || gCodes.some(g=>[81,82,83].includes(g))){
          const targetXY={
            x:tx===undefined?st.x:(st.absolute?tx*unitScale+(config.workOffsets[st.workOffset]?.x||0):st.x+tx*unitScale),
            y:ty===undefined?st.y:(st.absolute?ty*unitScale+(config.workOffsets[st.workOffset]?.y||0):st.y+ty*unitScale)
          };
          runDrillCycle(lineNum,targetXY,st.cycle,st.feed);
        }
        return;
      }

      const motionG=gCodes.filter(g=>[0,1,2,3].includes(g));
      if(motionG.length) st.motion=motionG[motionG.length-1];

      const hasAxis=['X','Y','Z'].some(L=>get(L)!==undefined);
      const hasArc=['I','J','K','R'].some(L=>get(L)!==undefined);
      const onlyE=!hasAxis&&!hasArc&&get('E')!==undefined;
      if(onlyE){
        const ev=get('E');
        st.e=st.extruderAbsolute?ev:st.e+ev;
        return;
      }
      if(!hasAxis && !hasArc) return;
      if(st.motion===null) return;

      const start={x:st.x,y:st.y,z:st.z}, target={...start};
      ['x','y','z'].forEach(a=>{
        const rawVal=get(a.toUpperCase());
        if(rawVal!==undefined){
          const v=rawVal*unitScale;
          if(st.absolute){
            const off=config.workOffsets[st.workOffset]||{x:0,y:0,z:0};
            target[a]=v+(off[a]||0);
          }else target[a]=start[a]+v;
        }
      });

      const rawE=get('E');
      const targetE=rawE===undefined ? st.e : (st.extruderAbsolute ? rawE : st.e+rawE);
      const extrusionDelta=targetE-st.e;
      const extrusionInfo={
        extrusionDelta,
        extruding:extrusionDelta>1e-7,
        retracting:extrusionDelta<-1e-7,
        printFeature,printLayer
      };

      if(st.motion===0||st.motion===1){
        pushLinear(st.motion===0?'rapid':'cut',start,target,lineNum,st.feed,extrusionInfo);
      }else{
        const i=(get('I')??0)*unitScale, j=(get('J')??0)*unitScale, k=(get('K')??0)*unitScale;
        const rr=get('R'); const r=rr===undefined?undefined:rr*unitScale;
        pushArc(start,target,i,j,k,r,st.motion===2,st.plane,lineNum,st.feed,extrusionInfo);
      }
      st.x=target.x;st.y=target.y;st.z=target.z;st.e=targetE;
    });

    if(!sawUnits) warnings.push({line:1,severity:'warn',text:'Programa não declara G20/G21; assumido milímetro.'});
    if(!sawDistance) warnings.push({line:1,severity:'warn',text:'Programa não declara G90/G91; assumido absoluto.'});
    if(!isFinite(bbox.minX)) bbox.minX=bbox.maxX=bbox.minY=bbox.maxY=bbox.minZ=bbox.maxZ=0;
    if(bbox.minX<0||bbox.minY<0||bbox.minZ<-config.limZ||
       bbox.maxX>config.limX||bbox.maxY>config.limY||bbox.maxZ>config.limZ){
      warnings.push({line:1,severity:'error',
        text:`Percurso ultrapassa os Soft Limits (${config.limX}x${config.limY}x${config.limZ}mm).`});
    }
    return {segments,tools,warnings,bbox,units:st.units};
  }

  function computeArc(start, end, i, j, k, r, cw, plane){
    let a1='x', a2='y', a3='z', c1=i, c2=j;
    if(plane==='XZ'){ a2='z'; a3='y'; c2=k; }
    else if(plane==='YZ'){ a1='y'; a2='z'; a3='x'; c1=j; c2=k; }

    const s1=start[a1], s2=start[a2], s3=start[a3];
    const e1=end[a1], e2=end[a2], e3=end[a3];
    const dx=e1-s1, dy=e2-s2;
    const chord=Math.hypot(dx,dy);

    // Sem movimento planar: ainda pode ser uma hélice/linha; não fabricar arco.
    if(chord < 1e-10 && r === undefined && Math.hypot(c1,c2) < 1e-10){
      return { points:[{...end}], center:null, radius:0, sweep:0 };
    }

    let cx, cy, radius, startAng, delta, warning='';

    if(r !== undefined && Math.abs(r) > 1e-10){
      radius = Math.abs(r);
      if(chord > 2*radius + 1e-7){
        // G-code inválido para o raio informado: retorna linha para não quebrar o render.
        return {
          points:[{...end}], center:null, radius,
          sweep:0,
          warning:`Arco R inválido na linha: raio ${radius.toFixed(3)}mm menor que metade da corda.`
        };
      }

      if(chord < 1e-10){
        return {
          points:[{...end}], center:null, radius, sweep:0,
          warning:'Arco por R sem deslocamento final não é determinístico; use I/J/K para círculo completo.'
        };
      }

      const mx=(s1+e1)/2, my=(s2+e2)/2;
      const ux=-dy/chord, uy=dx/chord;
      const h=Math.sqrt(Math.max(0, radius*radius - (chord*chord)/4));
      const candidates=[
        {x:mx+ux*h, y:my+uy*h},
        {x:mx-ux*h, y:my-uy*h}
      ];

      const wantedMajor = r < 0;
      let best=null;
      candidates.forEach(c => {
        const sa=Math.atan2(s2-c.y,s1-c.x);
        const ea=Math.atan2(e2-c.y,e1-c.x);
        let d=ea-sa;
        if(cw){ while(d>=0) d-=Math.PI*2; }
        else { while(d<=0) d+=Math.PI*2; }
        const isMajor=Math.abs(d)>Math.PI+1e-9;
        if(best===null || isMajor===wantedMajor) {
          if(best===null || (isMajor===wantedMajor && Math.abs(d) < Math.abs(best.delta) && !wantedMajor) ||
             (isMajor===wantedMajor && wantedMajor && Math.abs(d) > Math.abs(best.delta))){
            best={x:c.x,y:c.y,delta:d};
          }
        }
      });
      if(!best) best={x:candidates[0].x,y:candidates[0].y,delta:0};
      cx=best.x; cy=best.y; delta=best.delta;
      startAng=Math.atan2(s2-cy,s1-cx);
    } else {
      cx=s1+c1; cy=s2+c2;
      radius=Math.hypot(s1-cx,s2-cy);
      if(radius < 1e-10){
        return { points:[{...end}], center:null, radius:0, sweep:0,
          warning:'Centro de arco inválido: I/J/K não definem um raio.' };
      }
      startAng=Math.atan2(s2-cy,s1-cx);
      let endAng=Math.atan2(e2-cy,e1-cx);
      delta=endAng-startAng;
      if(chord < 1e-10){
        delta = cw ? -Math.PI*2 : Math.PI*2;
      } else if(cw){
        while(delta>=-1e-10) delta-=Math.PI*2;
      } else {
        while(delta<=1e-10) delta+=Math.PI*2;
      }
    }

    // Tolerância geométrica fixa em mm. A quantidade de pontos cresce com o raio/ângulo.
    const tol=Math.max(0.005, Number(config.simArcTolerance)||0.05);
    const denom = radius > tol ? 2*Math.acos(Math.max(-1, Math.min(1, 1-tol/radius))) : Math.PI/18;
    let steps=Math.ceil(Math.abs(delta)/Math.max(denom, Math.PI/180));
    steps=Math.max(6, Math.min(Number(config.simArcMaxSteps)||4096, steps));

    const pts=[];
    for(let n=1;n<=steps;n++){
      const t=n/steps;
      const ang=startAng+delta*t;
      const pt={...start};
      pt[a1]=cx+radius*Math.cos(ang);
      pt[a2]=cy+radius*Math.sin(ang);
      pt[a3]=s3+(e3-s3)*t;
      pts.push(pt);
    }
    // O último ponto deve ser exatamente o endpoint do G-code para evitar drift acumulado.
    pts[pts.length-1]={...end};

    const center={x:start.x,y:start.y,z:start.z};
    center[a1]=cx; center[a2]=cy; center[a3]=s3;
    return { points:pts, center, radius, sweep:delta, warning };
  }

  /* ============================================================
     MODIFICADORES DE G-CODE
  ============================================================ */
  function transformGCode(fnTransform){
    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      if(line.trim().startsWith(';')) return line;
      return line.replace(/([XYZxyz])\s*(-?\d*\.?\d+)/g, (match, axis, val) => {
        const newVal = fnTransform(axis.toUpperCase(), parseFloat(val));
        return axis + newVal.toFixed(3);
      });
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView();
  }

  document.getElementById('btnApplyShift').addEventListener('click', () => {
    const dx = parseFloat(document.getElementById('shiftX').value)||0;
    const dy = parseFloat(document.getElementById('shiftY').value)||0;
    const dz = parseFloat(document.getElementById('shiftZ').value)||0;
    transformGCode((axis, val) => {
      if(axis==='X') return val + dx;
      if(axis==='Y') return val + dy;
      if(axis==='Z') return val + dz;
      return val;
    });
    closeDialogs();
  });

  document.getElementById('btnApplyScale').addEventListener('click', () => {
    const factor = parseFloat(document.getElementById('scaleFactor').value)||1;
    const mirror = document.getElementById('mirrorAxis').value;
    
    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      let l = line;
      if(mirror !== 'none'){
        if(l.includes('G2')) l = l.replace('G2','G3');
        else if(l.includes('G3')) l = l.replace('G3','G2');
      }
      return l.replace(/([XYZIJKxyzijk])\s*(-?\d*\.?\d+)/g, (match, axis, val) => {
        let v = parseFloat(val) * factor;
        const ax = axis.toUpperCase();
        if(mirror === 'X' && (ax==='X'||ax==='I')) v = -v;
        if(mirror === 'Y' && (ax==='Y'||ax==='J')) v = -v;
        return axis + v.toFixed(3);
      });
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView(); closeDialogs();
  });

  document.getElementById('btnApplyRotate').addEventListener('click', () => {
    const deg = parseFloat(document.getElementById('rotateAngle').value)||0;
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      if(line.trim().startsWith(';')) return line;
      let x=null, y=null, i=null, j=null;
      line.replace(/([XYIJxyij])\s*(-?\d*\.?\d+)/g, (m, a, v) => {
        const val = parseFloat(v);
        const ax = a.toUpperCase();
        if(ax==='X') x=val; if(ax==='Y') y=val;
        if(ax==='I') i=val; if(ax==='J') j=val;
      });

      let res = line;
      if(x!==null && y!==null){
        const nx = x*cos - y*sin;
        const ny = x*sin + y*cos;
        res = res.replace(/X-?\d*\.?\d+/i, 'X'+nx.toFixed(3)).replace(/Y-?\d*\.?\d+/i, 'Y'+ny.toFixed(3));
      }
      if(i!==null && j!==null){
        const ni = i*cos - j*sin;
        const nj = i*sin + j*cos;
        res = res.replace(/I-?\d*\.?\d+/i, 'I'+ni.toFixed(3)).replace(/J-?\d*\.?\d+/i, 'J'+nj.toFixed(3));
      }
      return res;
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView(); closeDialogs();
  });

  document.getElementById('btnRenumber').addEventListener('click', () => {
    const lines = codeEl.value.split('\n');
    let num = 10;
    const out = lines.map(l => {
      let clean = l.replace(/^N\d+\s*/i, '').trim();
      if(!clean || clean.startsWith(';')) return clean;
      const res = `N${num} ${clean}`;
      num += 10;
      return res;
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse();
  });

  /* ============================================================
     OPERAÇÕES DE ARQUIVO
  ============================================================ */
  document.getElementById('btnNew').addEventListener('click', async () => {
    const confirmed = await htmlConfirm(
      'Deseja criar um novo arquivo? O código atual será limpo.',
      'Novo programa'
    );
    if(confirmed){
      codeEl.value = "G21 G90 G17 G40 G49\nG0 Z10.0\nM30\n";
      state.currentFileName = 'novo_programa.tap';
      document.getElementById('filename').textContent = state.currentFileName;
      renderHighlight(); runParse(); fitView();
    }
  });

  const openWrap = document.getElementById('openWrap');
  const openMenu = document.getElementById('openMenu');
  const fileInput = document.getElementById('fileInput');
  const fileInputSequence = document.getElementById('fileInputSequence');

  document.getElementById('btnOpen').addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if(!openWrap.contains(e.target)) openMenu.classList.remove('open');
  });

  document.getElementById('btnOpenSingle').addEventListener('click', () => {
    openMenu.classList.remove('open');
    state.fileQueue = [];
    state.fileQueueIndex = -1;
    state.sequencePlaying = false;
    state.multiFileMode = null;
    fileInput.value = '';
    fileInput.click();
  });

  document.getElementById('btnOpenSequence').addEventListener('click', () => {
    openMenu.classList.remove('open');
    state.fileQueue = [];
    state.fileQueueIndex = -1;
    state.sequencePlaying = false;
    state.multiFileMode = null;
    fileInputSequence.value = '';
    fileInputSequence.click();
  });

  function readFileText(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(String(e.target.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
      reader.readAsText(file);
    });
  }

  async function loadProgramFile(file, options={}){
    try{
      const text = await readFileText(file);
      state.currentFileName = file.name;
      document.getElementById('filename').textContent = file.name;
      codeEl.value = text;
      rememberRecent(file.name,text);
      renderHighlight();
      runParse();
      fitView();

      if(options.startPlayback){
        // Começa sempre do início do novo programa.
        state.playIndex = 0;
        updatePlaybackUI();
        drawCanvas();
        startPlay();
      }
      return true;
    }catch(err){
      console.error(err);
      await htmlAlert(
        `Não foi possível abrir "${file.name}".`,
        'Erro ao abrir arquivo'
      );
      return false;
    }
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    stopPlay();
    await loadProgramFile(file);
    fileInput.value = '';
  });

  fileInputSequence.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if(!files.length) return;

    stopPlay();

    /*
     * Ao abrir vários arquivos existem dois comportamentos:
     *
     * 1) SEQUENCIAL:
     *    cada arquivo é carregado e executado separadamente.
     *    Ao terminar um, o próximo começa.
     *    O stock é reiniciado a cada novo programa.
     *
     * 2) COMO UM SÓ:
     *    todos os arquivos são concatenados em memória e analisados
     *    como um único programa. O playback, o stock e a usinagem
     *    permanecem contínuos entre os arquivos.
     */
    const multiMode = await showMessageDialog({
      title:'Abrir vários arquivos',
      message:
        'Como deseja reproduzir os arquivos selecionados?\n\n' +
        'Como um só: todos os arquivos formam uma única simulação contínua e usam o mesmo bloco de material.\n\n' +
        'Sequencial: cada arquivo é executado separadamente, um após o outro.',
      icon:'▶',
      buttons:[
        {label:'Como um só', value:'combined', primary:true},
        {label:'Sequencial', value:'sequential'},
        {label:'Cancelar', value:'cancel'}
      ]
    });

    if(multiMode === 'cancel'){
      fileInputSequence.value = '';
      return;
    }

    if(multiMode === 'combined'){
      state.multiFileMode = 'combined';
      state.sequencePlaying = false;
      state.fileQueue = [];
      state.fileQueueIndex = -1;

      try{
        const parts = [];
        for(let i=0; i<files.length; i++){
          const file = files[i];
          const fileText = await readFileText(file);

          // Marcadores são comentários válidos e ajudam a identificar
          // visualmente onde cada programa começa e termina no editor.
          parts.push(
            `; ===== ARQUIVO ${i+1}/${files.length}: ${file.name} =====
${fileText}
; ===== FIM: ${file.name} =====`
          );
        }

        codeEl.value = parts.join('\n\n');
        state.currentFileName =
          files.length === 1
            ? files[0].name
            : `${files.length}_arquivos_combinados.tap`;

        document.getElementById('filename').textContent =
          files.length === 1
            ? files[0].name
            : `${files.length} arquivos • combinado`;

        renderHighlight();
        runParse();
        fitView();

        state.playIndex = 0;
        resetStockSimulation();
        updatePlaybackUI();
        drawCanvas();
        startPlay();

      }catch(err){
        console.error(err);
        await htmlAlert(
          'Não foi possível ler todos os arquivos selecionados.',
          'Erro ao abrir arquivos'
        );
        state.multiFileMode = null;
      }

    }else if(multiMode === 'sequential'){
      state.multiFileMode = 'sequential';
      state.fileQueue = files;
      state.fileQueueIndex = 0;
      state.sequencePlaying = true;

      // O FileList já vem na ordem escolhida pelo navegador/sistema.
      const ok = await loadProgramFile(state.fileQueue[0], {startPlayback:true});
      if(!ok){
        state.sequencePlaying = false;
        state.fileQueue = [];
        state.fileQueueIndex = -1;
        state.multiFileMode = null;
      }
    }

    fileInputSequence.value = '';
  });

  const saveNameDialog = document.getElementById('saveNameDialog');
  const saveFileNameInput = document.getElementById('saveFileNameInput');

  function normalizeSaveName(name){
    let n=(name||'').trim();
    if(!n)n='programa.tap';

    // Mantém extensões CNC conhecidas. Caso contrário, acrescenta .tap.
    if(!/\.(tap|nc|cnc|gcode|txt)$/i.test(n)) n += '.tap';
    return n;
  }

  document.getElementById('btnSave').addEventListener('click', () => {
    saveFileNameInput.value = state.currentFileName || 'programa.tap';
    saveNameDialog.showModal();
    requestAnimationFrame(() => {
      saveFileNameInput.focus();
      const dot=saveFileNameInput.value.lastIndexOf('.');
      saveFileNameInput.setSelectionRange(0, dot>0?dot:saveFileNameInput.value.length);
    });
  });

  document.getElementById('btnConfirmSaveName').addEventListener('click', () => {
    const fileName = normalizeSaveName(saveFileNameInput.value);

    state.currentFileName = fileName;
    document.getElementById('filename').textContent = fileName;

    const blob = new Blob([codeEl.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    rememberRecent(fileName, codeEl.value);
    saveNameDialog.close();
  });

  document.getElementById('btnCancelSaveName').addEventListener('click', () => {
    saveNameDialog.close();
  });

  saveFileNameInput.addEventListener('keydown', e => {
    if(e.key === 'Enter'){
      e.preventDefault();
      document.getElementById('btnConfirmSaveName').click();
    }
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = state.currentFileName.replace(/\.[^/.]+$/, "") + "_preview.png";
    a.click();
  });

  /* ============================================================
     SYNTAX HIGHLIGHTING & EDITOR EVENTS
  ============================================================ */
  function highlightLine(line){
    let out = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    out = out.replace(/(;[^\n]*|\([^)]*\))/g, '<span class="tok-comment">$1</span>');
    out = out.replace(/\b([Gg])(\d+\.?\d*)/g, '<span class="tok-g">$1$2</span>');
    out = out.replace(/\b([Mm])(\d+)/g, '<span class="tok-m">$1$2</span>');
    out = out.replace(/\b([XYZxyz])(-?\d*\.?\d+)/g, '<span class="tok-axis">$1$2</span>');
    out = out.replace(/\b([IJKijk])(-?\d*\.?\d+)/g, '<span class="tok-ijk">$1$2</span>');
    out = out.replace(/\b([Ff])(-?\d*\.?\d+)/g, '<span class="tok-f">$1$2</span>');
    out = out.replace(/\b([SsTt])(\d+)/g, '<span class="tok-s">$1$2</span>');
    return out.length ? out : '&nbsp;';
  }

  function renderHighlight(){
    const lines = codeEl.value.split('\n');
    highlightEl.innerHTML = lines.map(highlightLine).join('\n');
    let buf = ''; for(let n=1; n<=lines.length; n++) buf += n + '\n';
    gutterEl.textContent = buf;
    els.statLines.textContent = lines.length;
    codeEl.style.height = (lines.length * 20 + 40) + 'px';
  }

  function updateCursorHighlight(){
    const pos = codeEl.selectionStart;
    const curLine = codeEl.value.slice(0, pos).split('\n').length;
    els.statCurLine.textContent = curLine;
    state.selectedLine = curLine;

    lineHighlightEl.style.display = 'block';
    lineHighlightEl.style.top = (10 + (curLine-1)*20) + 'px';
    drawCanvas();
  }

  codeEl.addEventListener('click', updateCursorHighlight);
  codeEl.addEventListener('keyup', (e) => {
    updateCursorHighlight();
    if(['ArrowUp','ArrowDown','Enter','Escape'].includes(e.key)) return;

    const pos = codeEl.selectionStart;
    const textBefore = codeEl.value.slice(0, pos);
    const lastWord = textBefore.split(/[\s\n]+/).pop().toUpperCase();

    if(lastWord.length >= 1 && (lastWord.startsWith('G') || lastWord.startsWith('M'))){
      const matches = GCODE_DICT.filter(d => d.code.startsWith(lastWord));
      if(matches.length){
        acBox.innerHTML = matches.map((m,i) => `<div class="ac-item ${i===0?'selected':''}" data-code="${m.code}"><b>${m.code}</b> <span>${m.desc}</span></div>`).join('');
        acBox.style.display = 'block';
        acBox.style.top = (10 + (textBefore.split('\n').length)*20) + 'px';
        acBox.style.left = '60px';
        return;
      }
    }
    acBox.style.display = 'none';
  });

  acBox.addEventListener('click', (e) => {
    const item = e.target.closest('.ac-item');
    if(!item) return;
    insertCode(item.dataset.code);
  });

  function insertCode(codeStr){
    const pos = codeEl.selectionStart;
    const textBefore = codeEl.value.slice(0, pos);
    const lastWord = textBefore.split(/[\s\n]+/).pop();
    const startPos = pos - lastWord.length;
    codeEl.value = codeEl.value.slice(0, startPos) + codeStr + ' ' + codeEl.value.slice(pos);
    acBox.style.display = 'none';
    renderHighlight(); runParse(); codeEl.focus();
  }


  // ============================================================
  // WEBGL2 PURO - RENDERER 3D
  // ============================================================
  const webgl3d={
    gl:null,available:false,program:null,lineProgram:null,lastError:null,renderer:'',vendor:'',maxTextureSize:0,
    meshVAO:null,meshVBO:null,meshNBO:null,meshCBO:null,meshIBO:null,meshIndexCount:0,
    wallVAO:null,wallVBO:null,wallNBO:null,wallCBO:null,wallVertexCount:0,
    lineVAO:null,lineVBO:null,lineCBO:null,lineVertexCount:0,
    pointVAO:null,pointVBO:null,pointCBO:null,pointVertexCount:0,
    depositVAO:null,depositVBO:null,depositNBO:null,depositCBO:null,depositIBO:null,
    depositIndexCount:0,depositSegmentCounts:[],depositSegmentRanges:[],depositKey:'',
    depositLiveVAO:null,depositLiveVBO:null,depositLiveNBO:null,depositLiveCBO:null,depositLiveIBO:null,depositLiveIndexCount:0,
    stockKey:''
  };

  function glCompile(gl,type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const msg=gl.getShaderInfoLog(s)||'Erro de shader';gl.deleteShader(s);throw new Error(msg);
    }
    return s;
  }
  function glMakeProgram(gl,vs,fs){
    const p=gl.createProgram(),a=glCompile(gl,gl.VERTEX_SHADER,vs),b=glCompile(gl,gl.FRAGMENT_SHADER,fs);
    gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const msg=gl.getProgramInfoLog(p)||'Erro WebGL';gl.deleteProgram(p);throw new Error(msg);}
    return p;
  }

  function updateGraphicsStatus(){
    const box=document.getElementById('gpuStatus'),txt=document.getElementById('gpuStatusText');
    if(!box||!txt)return;
    box.classList.toggle('webgl2',!!webgl3d.available);
    box.classList.toggle('canvas2d',!webgl3d.available);
    if(webgl3d.available){
      txt.textContent='WebGL2 · GPU';
      const details=[webgl3d.vendor,webgl3d.renderer].filter(Boolean).join(' · ');
      box.title=`WebGL2 ativo${details?'\n'+details:''}${webgl3d.maxTextureSize?'\nMax texture: '+webgl3d.maxTextureSize:''}`;
    }else{
      txt.textContent='Canvas 2D · fallback';
      box.title=`WebGL2 indisponível. Usando Canvas 2D.${webgl3d.lastError?'\n'+webgl3d.lastError:''}`;
    }
  }

  function initWebGL3D(){
    try{
      const gl=glCanvas.getContext('webgl2',{
        alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'high-performance'
      });
      if(!gl){webgl3d.lastError='WebGL2 não suportado pelo navegador/GPU';updateGraphicsStatus();return false;}
      try{
        const dbg=gl.getExtension('WEBGL_debug_renderer_info');
        webgl3d.renderer=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');
        webgl3d.vendor=dbg?String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)||''):String(gl.getParameter(gl.VENDOR)||'');
        webgl3d.maxTextureSize=Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)||0);
      }catch(_){ }

      const transform=`
        uniform vec2 uViewport; uniform float uScale; uniform vec2 uOffset;
        uniform float uAzimuth; uniform float uElevation;
        uniform float uPerspective; uniform float uPerspectiveDistance;
        uniform float uDepthCenter; uniform float uDepthScale;
        vec4 projectWorld(vec3 p){
          float ca=cos(uAzimuth),sa=sin(uAzimuth);
          float x1=p.x*ca-p.y*sa, y1=p.x*sa+p.y*ca;
          float ce=cos(uElevation),se=sin(uElevation);
          float depth=y1*ce+p.z*se;
          float vertical=y1*se+p.z*ce;
          float f=1.0;
          if(uPerspective>0.5)f=uPerspectiveDistance/max(120.0,uPerspectiveDistance+depth);
          float px=x1*f*uScale+uOffset.x, py=-vertical*f*uScale+uOffset.y;
          return vec4((px/uViewport.x)*2.0-1.0,1.0-(py/uViewport.y)*2.0,
                      clamp((depth-uDepthCenter)*uDepthScale,-0.95,0.95),1.0);
        }
        vec3 rotateNormal(vec3 n){
          float ca=cos(uAzimuth),sa=sin(uAzimuth);
          float x1=n.x*ca-n.y*sa,y1=n.x*sa+n.y*ca;
          float ce=cos(uElevation),se=sin(uElevation);
          return normalize(vec3(x1,y1*ce+n.z*se,y1*se+n.z*ce));
        }`;

      const meshVS=`#version 300 es
        precision highp float;
        layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec4 aColor;
        out vec3 vNormal;out vec4 vColor;${transform}
        void main(){gl_Position=projectWorld(aPosition);vNormal=rotateNormal(aNormal);vColor=aColor;}`;
      const meshFS=`#version 300 es
        precision highp float;
        in vec3 vNormal;in vec4 vColor;uniform float uXray;out vec4 outColor;
        void main(){
          vec3 n=normalize(vNormal),light=normalize(vec3(-.35,.45,.82));
          float shade=.34+.66*max(dot(n,light),0.0);
          outColor=vec4(vColor.rgb*shade,vColor.a*(uXray>.5?.26:1.0));
        }`;
      const lineVS=`#version 300 es
        precision highp float;
        layout(location=0) in vec3 aPosition;layout(location=1) in vec4 aColor;
        out vec4 vColor;uniform float uPointSize;${transform}
        void main(){gl_Position=projectWorld(aPosition);gl_PointSize=uPointSize;vColor=aColor;}`;
      const lineFS=`#version 300 es
        precision highp float;
        in vec4 vColor;uniform float uRoundPoint;out vec4 outColor;
        void main(){if(uRoundPoint>.5){vec2 d=gl_PointCoord-vec2(.5);if(dot(d,d)>.25)discard;}outColor=vColor;}`;

      webgl3d.gl=gl;webgl3d.program=glMakeProgram(gl,meshVS,meshFS);webgl3d.lineProgram=glMakeProgram(gl,lineVS,lineFS);
      // Cache das uniform locations: gl.getUniformLocation() envolve um round-trip ao driver,
      // então buscamos uma única vez aqui (por programa) em vez de a cada frame em glUniforms().
      const GL_UNIFORM_NAMES=['uViewport','uScale','uOffset','uAzimuth','uElevation','uPerspective','uPerspectiveDistance','uDepthCenter','uDepthScale','uXray','uPointSize','uRoundPoint'];
      function cacheUniformLocations(program){
        const locs={};
        GL_UNIFORM_NAMES.forEach(name=>{ locs[name]=gl.getUniformLocation(program,name); });
        return locs;
      }
      webgl3d.programUniforms=cacheUniformLocations(webgl3d.program);
      webgl3d.lineUniforms=cacheUniformLocations(webgl3d.lineProgram);

      function meshVAO(){
        const vao=gl.createVertexArray();gl.bindVertexArray(vao);
        const pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
        const nor=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nor);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
        const col=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,col);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,0,0);
        return {vao,pos,nor,col};
      }
      let m=meshVAO();webgl3d.meshVAO=m.vao;webgl3d.meshVBO=m.pos;webgl3d.meshNBO=m.nor;webgl3d.meshCBO=m.col;
      webgl3d.meshIBO=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.meshIBO);
      m=meshVAO();webgl3d.wallVAO=m.vao;webgl3d.wallVBO=m.pos;webgl3d.wallNBO=m.nor;webgl3d.wallCBO=m.col;

      // Malha sólida do material depositado em impressão 3D.
      m=meshVAO();
      webgl3d.depositVAO=m.vao;webgl3d.depositVBO=m.pos;webgl3d.depositNBO=m.nor;webgl3d.depositCBO=m.col;
      webgl3d.depositIBO=gl.createBuffer();
      gl.bindVertexArray(webgl3d.depositVAO);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.depositIBO);

      // Buffer dinâmico: somente o trecho que está saindo do nozzle neste frame.
      // Mantemos a peça já concluída em STATIC_DRAW e atualizamos apenas este pequeno prefixo.
      m=meshVAO();
      webgl3d.depositLiveVAO=m.vao;webgl3d.depositLiveVBO=m.pos;webgl3d.depositLiveNBO=m.nor;webgl3d.depositLiveCBO=m.col;
      webgl3d.depositLiveIBO=gl.createBuffer();
      gl.bindVertexArray(webgl3d.depositLiveVAO);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.depositLiveIBO);

      function lineVAO(){
        const vao=gl.createVertexArray();gl.bindVertexArray(vao);
        const pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
        const col=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,col);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);
        return {vao,pos,col};
      }
      let l=lineVAO();webgl3d.lineVAO=l.vao;webgl3d.lineVBO=l.pos;webgl3d.lineCBO=l.col;
      l=lineVAO();webgl3d.pointVAO=l.vao;webgl3d.pointVBO=l.pos;webgl3d.pointCBO=l.col;
      gl.bindVertexArray(null);

      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(.0706,.0824,.0941,1);
      webgl3d.available=true;webgl3d.lastError=null;updateGraphicsStatus();return true;
    }catch(err){
      console.error('WebGL2 renderer:',err);webgl3d.lastError=String(err);webgl3d.available=false;updateGraphicsStatus();return false;
    }
  }

  // Recuperação de perda de contexto: sem isso, se o contexto WebGL cair (notebook
  // hibernando, driver de GPU reiniciando, muitas abas com WebGL abertas), a vista ISO
  // fica travada numa tela preta permanente. Ao perder o contexto, cai no fallback 2D
  // na hora; ao recuperar, reconstrói os shaders/buffers e volta pro WebGL automaticamente.
  if(glCanvas){
    glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('Contexto WebGL perdido — usando fallback 2D até recuperar.');
      webgl3d.available = false;
      webgl3d.lastError='Contexto WebGL2 perdido';
      updateGraphicsStatus();
      drawCanvas();
    }, false);
    glCanvas.addEventListener('webglcontextrestored', () => {
      console.info('Contexto WebGL recuperado — reinicializando renderer 3D.');
      webgl3d.stockKey = '';
      webgl3d.lineKey = '';
      webgl3d.depositKey = '';
      initWebGL3D();
      drawCanvas();
    }, false);
  }

  function resizeWebGLCanvas(){
    if(!webgl3d.available)return null;
    const gl=webgl3d.gl,r=glCanvas.parentElement.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(glCanvas.width!==w||glCanvas.height!==h){glCanvas.width=w;glCanvas.height=h;}
    gl.viewport(0,0,w,h);return {width:r.width,height:r.height,dpr};
  }

  function glDepthParams(){
    const b=state.bbox||{minX:0,maxX:100,minY:0,maxY:100,minZ:-20,maxZ:20},sb=stockBounds();
    const pts=[
      {x:b.minX,y:b.minY,z:b.minZ},{x:b.maxX,y:b.minY,z:b.minZ},{x:b.minX,y:b.maxY,z:b.minZ},{x:b.maxX,y:b.maxY,z:b.minZ},
      {x:b.minX,y:b.minY,z:b.maxZ},{x:b.maxX,y:b.minY,z:b.maxZ},{x:b.minX,y:b.maxY,z:b.maxZ},{x:b.maxX,y:b.maxY,z:b.maxZ},
      {x:sb.x0,y:sb.y0,z:sb.zBottom},{x:sb.x1,y:sb.y1,z:sb.zTop}
    ];
    let lo=Infinity,hi=-Infinity;
    pts.forEach(p=>{const q=rotateProject(p,state.isoAzimuth,state.isoElevation);lo=Math.min(lo,q.depth);hi=Math.max(hi,q.depth);});
    return {center:(lo+hi)/2,scale:1.7/Math.max(1,hi-lo)};
  }

  function glUniforms(locs,rect){
    const gl=webgl3d.gl,d=glDepthParams();
    const f1=(l,v)=>{if(l!=null)gl.uniform1f(l,v);};
    const f2=(l,a,b)=>{if(l!=null)gl.uniform2f(l,a,b);};
    f2(locs.uViewport,rect.width,rect.height);f1(locs.uScale,state.scale);f2(locs.uOffset,state.offsetX,state.offsetY);
    f1(locs.uAzimuth,state.isoAzimuth);f1(locs.uElevation,state.isoElevation);
    f1(locs.uPerspective,state.projectionMode==='perspective'?1:0);f1(locs.uPerspectiveDistance,state.perspectiveDistance||900);
    f1(locs.uDepthCenter,d.center);f1(locs.uDepthScale,d.scale);
  }

  function webglColorDepth(depth,alpha=.78){
    depth=Math.max(0,Math.min(1,depth));
    if(state.depthMap){
      return [Math.max(0,Math.min(1,1.7*depth)),Math.max(0,Math.min(1,1.6-1.5*Math.abs(depth-.55))),Math.max(0,Math.min(1,1.25*(1-depth))),alpha];
    }
    return [.22+depth*.10,.65-depth*.20,.72-depth*.20,alpha];
  }

  function uploadWebGLWalls(pos,nor,col){
    const gl=webgl3d.gl;gl.bindVertexArray(webgl3d.wallVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.wallVBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.wallNBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.wallCBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.DYNAMIC_DRAW);
    webgl3d.wallVertexCount=pos.length/3;gl.bindVertexArray(null);
  }

  function buildOriginalStockWebGL(){
    const b=stockBounds(),p=[
      [b.x0,b.y0,b.zBottom],[b.x1,b.y0,b.zBottom],[b.x1,b.y1,b.zBottom],[b.x0,b.y1,b.zBottom],
      [b.x0,b.y0,b.zTop],[b.x1,b.y0,b.zTop],[b.x1,b.y1,b.zTop],[b.x0,b.y1,b.zTop]
    ],faces=[[4,5,6,7,0,0,1],[0,3,2,1,0,0,-1],[0,1,5,4,0,-1,0],[1,2,6,5,1,0,0],[2,3,7,6,0,1,0],[3,0,4,7,-1,0,0]];
    const pos=[],nor=[],col=[];
    faces.forEach(f=>{const [a,b1,c,d,nx,ny,nz]=f;[[a,b1,c],[a,c,d]].forEach(t=>t.forEach(i=>{pos.push(...p[i]);nor.push(nx,ny,nz);col.push(.24,.62,.70,.75);}));});
    webgl3d.meshIndexCount=0;uploadWebGLWalls(pos,nor,col);
  }

  function buildStockWebGL(force=false){
    const mode=document.getElementById('stockViewMode')?.value||'machined';
    if(mode==='original'){
      const key=`o:${config.stkX}:${config.stkY}:${config.stkZ}:${config.stkZOrigin}:${state.xray}`;
      if(!force&&webgl3d.stockKey===key)return;webgl3d.stockKey=key;buildOriginalStockWebGL();return;
    }
    const sim=ensureStockSimulation();syncStockSimulation();const b=stockBounds();
    const key=[sim.nx,sim.ny,sim.lastIndex,state.stockQuality,state.depthMap,state.sectionAxis,state.sectionValue,config.stkX,config.stkY,config.stkZ,mode].join(':');
    if(!force&&webgl3d.stockKey===key)return;webgl3d.stockKey=key;

    const nx=sim.nx,ny=sim.ny,dx=sim.dx,dy=sim.dy,vx=nx+1,vy=ny+1,count=vx*vy,heights=new Float32Array(count);
    function height(ix,iy){
      let s=0,n=0;for(let oy=-1;oy<=0;oy++)for(let ox=-1;ox<=0;ox++){const x=ix+ox,y=iy+oy;if(x>=0&&x<nx&&y>=0&&y<ny){s+=sim.top[y*nx+x];n++;}}
      return n?s/n:b.zTop;
    }
    for(let y=0;y<vy;y++)for(let x=0;x<vx;x++)heights[y*vx+x]=height(x,y);

    const pos=new Float32Array(count*3),nor=new Float32Array(count*3),col=new Float32Array(count*4);
    for(let y=0;y<vy;y++)for(let x=0;x<vx;x++){
      const k=y*vx+x,z=heights[k];pos.set([x*dx,y*dy,z],k*3);
      const hl=heights[y*vx+Math.max(0,x-1)],hr=heights[y*vx+Math.min(vx-1,x+1)],hd=heights[Math.max(0,y-1)*vx+x],hu=heights[Math.min(vy-1,y+1)*vx+x];
      let nxv=-(hr-hl)/(Math.max(dx,1e-6)*Math.max(1,Math.min(vx-1,x+1)-Math.max(0,x-1)));
      let nyv=-(hu-hd)/(Math.max(dy,1e-6)*Math.max(1,Math.min(vy-1,y+1)-Math.max(0,y-1))),nzv=1;
      const ln=Math.hypot(nxv,nyv,nzv)||1;nxv/=ln;nyv/=ln;nzv/=ln;nor.set([nxv,nyv,nzv],k*3);
      col.set(webglColorDepth((b.zTop-z)/Math.max(.001,config.stkZ)),k*4);
    }

    const idx=[];
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const z=(heights[y*vx+x]+heights[y*vx+x+1]+heights[(y+1)*vx+x]+heights[(y+1)*vx+x+1])/4;
      if(!stockCellVisible((x+.5)*dx,(y+.5)*dy,z))continue;
      const a=y*vx+x,b1=a+1,d=(y+1)*vx+x,c=d+1;idx.push(a,b1,c,a,c,d);
    }

    const gl=webgl3d.gl;gl.bindVertexArray(webgl3d.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.meshVBO);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.meshNBO);gl.bufferData(gl.ARRAY_BUFFER,nor,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.meshCBO);gl.bufferData(gl.ARRAY_BUFFER,col,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.meshIBO);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.DYNAMIC_DRAW);
    webgl3d.meshIndexCount=idx.length;gl.bindVertexArray(null);

    const wp=[],wn=[],wc=[];
    function quad(a,b1,c,d,n){
      [[a,b1,c],[a,c,d]].forEach(t=>t.forEach(v=>{wp.push(...v);wn.push(...n);wc.push(.18,.48,.55,.65);}));
    }
    for(let x=0;x<nx;x++){
      let z0=heights[x],z1=heights[x+1];quad([x*dx,0,b.zBottom],[(x+1)*dx,0,b.zBottom],[(x+1)*dx,0,z1],[x*dx,0,z0],[0,-1,0]);
      z0=heights[ny*vx+x];z1=heights[ny*vx+x+1];quad([x*dx,ny*dy,b.zBottom],[x*dx,ny*dy,z0],[(x+1)*dx,ny*dy,z1],[(x+1)*dx,ny*dy,b.zBottom],[0,1,0]);
    }
    for(let y=0;y<ny;y++){
      let z0=heights[y*vx],z1=heights[(y+1)*vx];quad([0,y*dy,b.zBottom],[0,y*dy,z0],[0,(y+1)*dy,z1],[0,(y+1)*dy,b.zBottom],[-1,0,0]);
      z0=heights[y*vx+nx];z1=heights[(y+1)*vx+nx];quad([nx*dx,y*dy,b.zBottom],[nx*dx,(y+1)*dy,b.zBottom],[nx*dx,(y+1)*dy,z1],[nx*dx,y*dy,z0],[1,0,0]);
    }
    uploadWebGLWalls(wp,wn,wc);
  }

  function pushGLLine(p,c,a,b,color){p.push(a.x,a.y,a.z,b.x,b.y,b.z);c.push(...color,...color);}
  function addGLBox(p,c,min,max,color){
    const q=[{x:min.x,y:min.y,z:min.z},{x:max.x,y:min.y,z:min.z},{x:max.x,y:max.y,z:min.z},{x:min.x,y:max.y,z:min.z},
      {x:min.x,y:min.y,z:max.z},{x:max.x,y:min.y,z:max.z},{x:max.x,y:max.y,z:max.z},{x:min.x,y:max.y,z:max.z}];
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>pushGLLine(p,c,q[a],q[b],color));
  }
  function heatGL(feed){const t=Math.max(0,Math.min(1,(feed||0)/1200));return [Math.max(0,2*t-.5),Math.min(1,1.8-1.6*Math.abs(t-.55)),Math.max(0,1.1-1.5*t),1];}


  function inferPrintLayerHeight(){
    const zs=[];
    let last=null;
    state.segments.forEach(seg=>{
      if(!seg.extruding)return;
      const z=Number(seg.end?.z);
      if(!isFinite(z))return;
      if(last===null || Math.abs(z-last)>1e-4){
        zs.push(z);last=z;
      }
    });
    const diffs=[];
    for(let i=1;i<zs.length;i++){
      const d=Math.abs(zs[i]-zs[i-1]);
      if(d>0.02 && d<2)diffs.push(d);
    }
    if(!diffs.length)return state.printLayerHeight||0.20;
    diffs.sort((a,b)=>a-b);
    return Math.max(0.05,Math.min(1,diffs[Math.floor(diffs.length/2)]));
  }

  function printFilamentColor(z,layerH){
    // Variação discreta entre camadas adjacentes para evidenciar a deposição,
    // mantendo uma única cor de filamento.
    const lh=Math.max(.05,layerH||.2);
    const layer=Math.max(0,Math.round((z||0)/lh));
    const k=(layer%2)?1.00:.88;
    return [0.20*k,0.82*k,0.50*k,1.0];
  }

  function uploadLiveDepositPrefix(segIndex,progress){
    if(!webgl3d.available||state.jobType!=='print3d')return 0;
    const seg=state.segments[segIndex];
    if(!seg?.extruding||progress<=0){webgl3d.depositLiveIndexCount=0;return 0;}

    const geom=state.renderGeometry.length===state.segments.length?state.renderGeometry:
      state.segments.map(s=>({points:s.type==='arc'?[s.start,...(s.points||[]),s.end]:[s.start,s.end]}));
    const pts=geom[segIndex]?.points;
    if(!pts||pts.length<2){webgl3d.depositLiveIndexCount=0;return 0;}

    const lengths=[];let total=0;
    for(let i=1;i<pts.length;i++){
      const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y,pts[i].z-pts[i-1].z);
      lengths.push(d);total+=d;
    }
    if(total<1e-8){webgl3d.depositLiveIndexCount=0;return 0;}
    let remaining=total*Math.max(0,Math.min(1,progress));

    const layerH=inferPrintLayerHeight();
    const width=Math.max(.20,state.printNozzleWidth||.45);
    const sides=8,pos=[],nor=[],col=[],idx=[];
    let vertexBase=0,indexTotal=0;

    function pushVertex(v,n,c){pos.push(v.x,v.y,v.z);nor.push(n[0],n[1],n[2]);col.push(...c);}
    function addPiece(a,b){
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz);if(len<1e-8)return;
      const ux=dx/len,uy=dy/len,uz=dz/len;
      let px=-uy,py=ux,pz=0,pl=Math.hypot(px,py,pz);if(pl<1e-6){px=1;py=0;pz=0;pl=1;}px/=pl;py/=pl;pz/=pl;
      let qx=uy*pz-uz*py,qy=uz*px-ux*pz,qz=ux*py-uy*px,ql=Math.hypot(qx,qy,qz)||1;qx/=ql;qy/=ql;qz/=ql;
      const ringA=[],ringB=[],fc=printFilamentColor((a.z+b.z)*.5,layerH);
      for(let side=0;side<sides;side++){
        const ang=side/sides*Math.PI*2,ca=Math.cos(ang),sa=Math.sin(ang);
        const ox=px*(width*.5)*ca+qx*(layerH*.5)*sa,oy=py*(width*.5)*ca+qy*(layerH*.5)*sa,oz=pz*(width*.5)*ca+qz*(layerH*.5)*sa-layerH*.5;
        const nz=oz+layerH*.5,nl=Math.hypot(ox,oy,nz)||1,n=[ox/nl,oy/nl,nz/nl];
        ringA.push(vertexBase++);pushVertex({x:a.x+ox,y:a.y+oy,z:a.z+oz},n,fc);
        ringB.push(vertexBase++);pushVertex({x:b.x+ox,y:b.y+oy,z:b.z+oz},n,fc);
      }
      for(let side=0;side<sides;side++){
        const n=(side+1)%sides;idx.push(ringA[side],ringB[side],ringB[n],ringA[side],ringB[n],ringA[n]);indexTotal+=6;
      }
    }
    function addSpan(a,b,spanLen){
      if(spanLen<1e-8)return;
      // Limite de 4096 microtrechos no movimento atual para preservar FPS em segmentos gigantes.
      const base=Math.max(.10,Math.min(.35,width*.55));
      const step=Math.max(base,(total*Math.max(0,Math.min(1,progress)))/4096);
      const parts=Math.max(1,Math.ceil(spanLen/step));
      for(let j=0;j<parts;j++){
        const t0=j/parts,t1=(j+1)/parts;
        addPiece({x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0,z:a.z+(b.z-a.z)*t0},{x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1,z:a.z+(b.z-a.z)*t1});
      }
    }

    for(let i=0;i<lengths.length&&remaining>1e-9;i++){
      const a=pts[i],b=pts[i+1],take=Math.min(lengths[i],remaining);
      if(take>=lengths[i]-1e-9)addSpan(a,b,lengths[i]);
      else{
        const t=lengths[i]>1e-9?take/lengths[i]:0;
        addSpan(a,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},take);
      }
      remaining-=take;
    }

    const gl=webgl3d.gl;
    gl.bindVertexArray(webgl3d.depositLiveVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositLiveVBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositLiveNBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositLiveCBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.depositLiveIBO);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);webgl3d.depositLiveIndexCount=indexTotal;return indexTotal;
  }

  function buildDepositWebGL(){
    if(!webgl3d.available || state.jobType!=='print3d'){
      webgl3d.depositIndexCount=0;
      webgl3d.depositSegmentCounts=[];
      webgl3d.depositSegmentRanges=[];
      return;
    }

    const key=`${state.geometryVersion||0}|${state.segments.length}|${state.jobType}`;
    if(webgl3d.depositKey===key)return;
    webgl3d.depositKey=key;

    const layerH=inferPrintLayerHeight();
    const width=Math.max(0.20,state.printNozzleWidth||0.45);
    const radius=Math.max(width*0.5,layerH*0.5);
    const sides=8; // cordão arredondado/octogonal em vez de prisma quadrado
    const pos=[],nor=[],col=[],idx=[];
    const cumulative=new Array(state.segments.length).fill(0);
    const ranges=new Array(state.segments.length).fill(null);

    let vertexBase=0,indexTotal=0;

    function pushVertex(v,n,c){
      pos.push(v.x,v.y,v.z);
      nor.push(n[0],n[1],n[2]);
      col.push(...c);
    }

    function addTubePiece(a,b){
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      const len=Math.hypot(dx,dy,dz);
      if(len<1e-7)return 0;

      const ux=dx/len,uy=dy/len,uz=dz/len;

      let px=-uy,py=ux,pz=0;
      let pl=Math.hypot(px,py,pz);
      if(pl<1e-6){px=1;py=0;pz=0;pl=1;}
      px/=pl;py/=pl;pz/=pl;

      let qx=uy*pz-uz*py;
      let qy=uz*px-ux*pz;
      let qz=ux*py-uy*px;
      let ql=Math.hypot(qx,qy,qz)||1;
      qx/=ql;qy/=ql;qz/=ql;

      const ringA=[],ringB=[];
      for(let s=0;s<sides;s++){
        const ang=(s/sides)*Math.PI*2;
        const ca=Math.cos(ang),sa=Math.sin(ang);

        const ox=px*(width*0.5)*ca + qx*(layerH*0.5)*sa;
        const oy=py*(width*0.5)*ca + qy*(layerH*0.5)*sa;
        const oz=pz*(width*0.5)*ca + qz*(layerH*0.5)*sa - layerH*0.5;

        const nz=oz+layerH*0.5;
        const nlen=Math.hypot(ox,oy,nz)||1;
        const n=[ox/nlen,oy/nlen,nz/nlen];

        ringA.push(vertexBase++);
        const filamentColor=printFilamentColor((a.z+b.z)*0.5,layerH);
        pushVertex({x:a.x+ox,y:a.y+oy,z:a.z+oz},n,filamentColor);

        ringB.push(vertexBase++);
        pushVertex({x:b.x+ox,y:b.y+oy,z:b.z+oz},n,filamentColor);
      }

      const before=indexTotal;
      for(let s=0;s<sides;s++){
        const n=(s+1)%sides;
        idx.push(ringA[s],ringB[s],ringB[n]);
        idx.push(ringA[s],ringB[n],ringA[n]);
        indexTotal+=6;
      }

      return indexTotal-before;
    }

    function addTubeSegment(a,b){
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      const len=Math.hypot(dx,dy,dz);
      if(len<1e-7)return 0;

      // Subdivide movimentos G1/G2/G3 em pequenos trechos para
      // permitir que a deposição apareça progressivamente.
      const targetStep=Math.max(0.12,Math.min(0.50,width*0.75));
      const parts=Math.max(1,Math.ceil(len/targetStep));

      let added=0;
      for(let i=0;i<parts;i++){
        const t0=i/parts;
        const t1=(i+1)/parts;

        const p0={
          x:a.x+dx*t0,
          y:a.y+dy*t0,
          z:a.z+dz*t0
        };
        const p1={
          x:a.x+dx*t1,
          y:a.y+dy*t1,
          z:a.z+dz*t1
        };

        added+=addTubePiece(p0,p1);
      }

      return added;
    }

    const geom=state.renderGeometry.length===state.segments.length?state.renderGeometry:
      state.segments.map(seg=>({
        points:seg.type==='arc'?[seg.start,...(seg.points||[]),seg.end]:[seg.start,seg.end]
      }));

    for(let si=0;si<state.segments.length;si++){
      const seg=state.segments[si],g=geom[si];
      const startIndex=indexTotal;

      if(seg?.extruding && g?.points?.length>=2){
        for(let k=1;k<g.points.length;k++) addTubeSegment(g.points[k-1],g.points[k]);
      }

      const endIndex=indexTotal;
      ranges[si]={
        start:startIndex,
        count:endIndex-startIndex,
        tubePieces:Math.floor((endIndex-startIndex)/48)
      };
      cumulative[si]=endIndex;
    }

    const gl=webgl3d.gl;
    gl.bindVertexArray(webgl3d.depositVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositVBO);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositNBO);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.depositCBO);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,webgl3d.depositIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    webgl3d.depositIndexCount=indexTotal;
    webgl3d.depositSegmentCounts=cumulative;
    webgl3d.depositSegmentRanges=ranges;
  }

  function currentSegmentProgress(){
    if(!state.segments.length)return 0;
    const i=Math.max(0,Math.min(state.playIndex,state.segments.length-1));
    const startTime=i>0 ? (state.cumulativeTimes[i-1]||0) : 0;
    const endTime=state.cumulativeTimes[i]||startTime;
    const span=Math.max(1e-9,endTime-startTime);
    return Math.max(0,Math.min(1,(state.virtualTime-startTime)/span));
  }

  function drawDepositedPrintWebGL(rect){
    if(state.jobType!=='print3d'||!webgl3d.depositIndexCount)return;

    const gl=webgl3d.gl,pr=webgl3d.program;
    gl.useProgram(pr);glUniforms(webgl3d.programUniforms,rect);
    const xr=webgl3d.programUniforms.uXray;
    if(xr!=null)gl.uniform1f(xr,0);
    gl.bindVertexArray(webgl3d.depositVAO);

    const i=Math.max(0,Math.min(state.playIndex,state.segments.length-1));

    // Tudo antes do movimento atual permanece solidamente impresso.
    const completed=i>0 ? (webgl3d.depositSegmentCounts[i-1]||0) : 0;
    if(completed>0){
      gl.drawElements(gl.TRIANGLES,completed,gl.UNSIGNED_INT,0);
    }

    // Movimento atual nasce continuamente até a posição interpolada do nozzle.
    // A malha estática contém o movimento inteiro, mas não a desenhamos aqui;
    // geramos somente o prefixo realmente depositado neste frame.
    const progress=currentSegmentProgress();
    const liveCount=uploadLiveDepositPrefix(i,progress);
    if(liveCount>0){
      gl.bindVertexArray(webgl3d.depositLiveVAO);
      gl.drawElements(gl.TRIANGLES,liveCount,gl.UNSIGNED_INT,0);
    }

    gl.bindVertexArray(null);
  }

  function buildWebGLLines(){
    const p=[],c=[],showStock=state.jobType==='cnc' && document.getElementById('chkShowStock')?.checked,useHeat=document.getElementById('chkHeatmap')?.checked;
    if(document.getElementById('chkShowGrid')?.checked){
      const b=state.bbox,spanX=Math.max(40,b&&isFinite(b.minX)?(b.maxX-b.minX)*1.5:100),spanY=Math.max(40,b&&isFinite(b.minY)?(b.maxY-b.minY)*1.5:100);
      const cx=b&&isFinite(b.minX)?(b.minX+b.maxX)/2:0,cy=b&&isFinite(b.minY)?(b.minY+b.maxY)/2:0,x0=cx-spanX/2,x1=cx+spanX/2,y0=cy-spanY/2,y1=cy+spanY/2;
      let step=10;if(state.scale*step<15)step=50;if(state.scale*step<15)step=100;if(state.scale*step>150)step=5;
      for(let x=Math.floor(x0/step)*step;x<=x1;x+=step)pushGLLine(p,c,{x,y:y0,z:0},{x,y:y1,z:0},[.12,.15,.18,.75]);
      for(let y=Math.floor(y0/step)*step;y<=y1;y+=step)pushGLLine(p,c,{x:x0,y,z:0},{x:x1,y,z:0},[.12,.15,.18,.75]);
      const a=Math.max(20,Math.min(spanX,spanY)*.2);
      pushGLLine(p,c,{x:0,y:0,z:0},{x:a,y:0,z:0},[1,.25,.25,1]);pushGLLine(p,c,{x:0,y:0,z:0},{x:0,y:a,z:0},[.24,.86,.52,1]);pushGLLine(p,c,{x:0,y:0,z:0},{x:0,y:0,z:a},[.31,.82,.90,1]);
    }
    if(document.getElementById('chkShowLimits')?.checked)addGLBox(p,c,{x:0,y:0,z:-config.limZ},{x:config.limX,y:config.limY,z:config.limZ},[1,.36,.36,.35]);

    // No modo Comparar, mantém o contorno do bloco virgem sobre o material usinado.
    if(showStock && document.getElementById('stockViewMode')?.value==='compare'){
      const sb=stockBounds();
      addGLBox(p,c,{x:sb.x0,y:sb.y0,z:sb.zBottom},{x:sb.x1,y:sb.y1,z:sb.zTop},[1,.69,.13,.65]);
    }

    if(state.jobType==='cnc'){
      (state.fixtures||[]).forEach(f=>addGLBox(p,c,{x:f.x,y:f.y,z:f.z},{x:f.x+f.w,y:f.y+f.d,z:f.z+f.h},[1,.69,.13,.9]));

      const refs=[{q:config.home28,c:[1,.36,.36,1]},{q:config.home30,c:[1,.69,.13,1]},{q:config.workOffsets[state.activeWorkOffset]||{x:0,y:0,z:0},c:[.78,.57,.92,1]}];
      refs.forEach(o=>{const s=4,q=o.q;pushGLLine(p,c,{x:q.x-s,y:q.y,z:q.z},{x:q.x+s,y:q.y,z:q.z},o.c);pushGLLine(p,c,{x:q.x,y:q.y-s,z:q.z},{x:q.x,y:q.y+s,z:q.z},o.c);pushGLLine(p,c,{x:q.x,y:q.y,z:q.z-s},{x:q.x,y:q.y,z:q.z+s},o.c);});
    }else{
      // Mesa de impressão baseada no envelope da peça, com pequena margem.
      const b=state.bbox;
      if(b&&isFinite(b.minX)){
        const m=10,z=0,x0=b.minX-m,x1=b.maxX+m,y0=b.minY-m,y1=b.maxY+m;
        const plate=[.20,.36,.42,.65];
        pushGLLine(p,c,{x:x0,y:y0,z},{x:x1,y:y0,z},plate);
        pushGLLine(p,c,{x:x1,y:y0,z},{x:x1,y:y1,z},plate);
        pushGLLine(p,c,{x:x1,y:y1,z},{x:x0,y:y1,z},plate);
        pushGLLine(p,c,{x:x0,y:y1,z},{x:x0,y:y0,z},plate);
      }
    }

    const geom=state.renderGeometry.length===state.segments.length?state.renderGeometry:
      state.segments.map(seg=>({points:seg.type==='arc'?[seg.start,...(seg.points||[])]:[seg.start,seg.end]}));
    geom.forEach((g,i)=>{
      const seg=state.segments[i];if(!seg||!g.points||g.points.length<2||seg.type==='event'||seg.type==='dwell')return;
      if(seg.toolNumber&&state.toolVisibility[seg.toolNumber]===false)return;if(seg.type==='rapid'&&!state.showRapid)return;if(seg.type!=='rapid'&&!state.showCut)return;
      if(state.zMaxFilter<Infinity&&seg.start.z>state.zMaxFilter&&seg.end.z>state.zMaxFilter)return;
      const played=i<=state.playIndex,current=i===state.playIndex,selected=seg.line===state.selectedLine;
      if(showStock&&played&&!current&&seg.type!=='rapid'&&state.hidePlayedPath3D)return;
      let color;
      if(state.jobType==='print3d'){
        // Extrusão futura fica totalmente oculta.
        // A atual é representada pelo cordão sólido progressivo.
        if(seg.extruding){
          // O cordão sólido é a própria trajetória de extrusão; não desenhamos a linha-guia futura.
          return;
        }else if(seg.retracting){
          color=current?[.78,.57,.92,.65]:[.78,.57,.92,.18];
        }else{
          // Travel fica discreto e só ganha destaque no movimento corrente.
          color=current?[1,.78,.32,.72]:[.35,.45,.52,.08];
        }
      }else if(useHeat&&seg.type!=='rapid')color=heatGL(seg.feed);
      else if(seg.type==='rapid')color=current?[1,.82,.4,1]:(played?[1,.69,.13,.92]:[.4,.27,.05,.65]);
      else if(current)color=[1,1,1,1];else if(selected)color=[.66,1,.82,1];else if(played)color=[.24,.86,.52,1];else color=[.1,.32,.19,.72];
      for(let k=1;k<g.points.length;k++)pushGLLine(p,c,g.points[k-1],g.points[k],color);
    });
    // Cabeçote atual: fresa/holder para CNC ou hotend/nozzle para impressão 3D.
    if(state.segments.length && state.playIndex<state.segments.length){
      const seg=state.segments[state.playIndex],q=currentPlaybackPosition();

      if(state.jobType==='print3d'){
        // Nozzle cônico + bloco aquecedor + corpo do hotend (wireframe leve).
        const nozzleTop={x:q.x,y:q.y,z:q.z+5};
        const blockZ=q.z+7, bodyTop=q.z+18;
        pushGLLine(p,c,q,{x:q.x-2.2,y:q.y,z:nozzleTop.z},[1,.62,.18,1]);
        pushGLLine(p,c,q,{x:q.x+2.2,y:q.y,z:nozzleTop.z},[1,.62,.18,1]);
        pushGLLine(p,c,{x:q.x-2.2,y:q.y,z:nozzleTop.z},{x:q.x+2.2,y:q.y,z:nozzleTop.z},[1,.62,.18,1]);
        const br=5;
        addGLBox(p,c,
          {x:q.x-br,y:q.y-br,z:blockZ-2},
          {x:q.x+br,y:q.y+br,z:blockZ+2},
          [1,.45,.15,.88]
        );
        pushGLLine(p,c,{x:q.x,y:q.y,z:blockZ+2},{x:q.x,y:q.y,z:bodyTop},[.72,.78,.84,.9]);
        pushGLLine(p,c,{x:q.x-3,y:q.y,z:bodyTop},{x:q.x+3,y:q.y,z:bodyTop},[.72,.78,.84,.9]);
      }else{
        const stick=Math.max(10,seg.stickout||25);
        const holderR=Math.max(4,(seg.holderDiameter||20)/2);
        const toolR=Math.max(1,(seg.toolDiameter||6)/2);
        const toolTop={x:q.x,y:q.y,z:q.z+stick};
        const holderTop={x:q.x,y:q.y,z:q.z+stick+Math.min(25,seg.holderLength||25)};

        // Fresa.
        pushGLLine(p,c,q,toolTop,[.31,.82,.90,1]);
        pushGLLine(p,c,{x:toolTop.x-toolR,y:toolTop.y,z:toolTop.z},{x:toolTop.x+toolR,y:toolTop.y,z:toolTop.z},[.31,.82,.90,1]);

        // Porta-ferramenta simplificado.
        pushGLLine(p,c,{x:q.x-holderR,y:q.y,z:toolTop.z},{x:q.x-holderR,y:q.y,z:holderTop.z},[.65,.72,.78,.85]);
        pushGLLine(p,c,{x:q.x+holderR,y:q.y,z:toolTop.z},{x:q.x+holderR,y:q.y,z:holderTop.z},[.65,.72,.78,.85]);
        pushGLLine(p,c,{x:q.x-holderR,y:q.y,z:holderTop.z},{x:q.x+holderR,y:q.y,z:holderTop.z},[.65,.72,.78,.85]);
      }
    }

    const gl=webgl3d.gl;gl.bindVertexArray(webgl3d.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.lineVBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.lineCBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c),gl.DYNAMIC_DRAW);
    webgl3d.lineVertexCount=p.length/3;gl.bindVertexArray(null);
  }

  function currentPlaybackPosition(){
    if(!state.segments.length)return {x:0,y:0,z:0};
    const i=Math.max(0,Math.min(state.playIndex,state.segments.length-1));
    const seg=state.segments[i];
    if(!seg||!seg.start||!seg.end){
      for(let j=i-1;j>=0;j--){if(state.segments[j]?.end)return state.segments[j].end;}
      return {x:0,y:0,z:0};
    }

    const progress=currentSegmentProgress();
    const points=seg.type==='arc'?[seg.start,...(seg.points||[]),seg.end]:[seg.start,seg.end];
    if(points.length<2)return seg.end;

    const lengths=[];
    let total=0;
    for(let k=1;k<points.length;k++){
      const l=Math.hypot(
        points[k].x-points[k-1].x,
        points[k].y-points[k-1].y,
        points[k].z-points[k-1].z
      );
      lengths.push(l);total+=l;
    }

    let target=total*progress;
    for(let k=0;k<lengths.length;k++){
      if(target<=lengths[k] || k===lengths.length-1){
        const a=points[k],b=points[k+1];
        const t=lengths[k]>1e-9?Math.max(0,Math.min(1,target/lengths[k])):0;
        return {
          x:a.x+(b.x-a.x)*t,
          y:a.y+(b.y-a.y)*t,
          z:a.z+(b.z-a.z)*t
        };
      }
      target-=lengths[k];
    }
    return seg.end;
  }

  function buildWebGLToolPoint(){
    const p=[],c=[];if(state.segments.length&&state.playIndex<state.segments.length){const q=currentPlaybackPosition();p.push(q.x,q.y,q.z);c.push(...(state.jobType==='print3d'?[1,.55,.16,1]:[.31,.82,.90,1]));}
    const gl=webgl3d.gl;gl.bindVertexArray(webgl3d.pointVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.pointVBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,webgl3d.pointCBO);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c),gl.DYNAMIC_DRAW);
    webgl3d.pointVertexCount=p.length/3;gl.bindVertexArray(null);
  }

  // Chave leve com tudo que influencia a geometria de linhas/ponto de ferramenta.
  // Câmera (pan/zoom/orbit) NÃO entra aqui de propósito: mover a câmera não deve
  // reconstruir a geometria e reenviar pra GPU — só os uniforms da view mudam.
  // Qualquer novo dado que passe a influenciar buildWebGLLines()/buildWebGLToolPoint()
  // precisa ser incluído aqui, ou o cache pode exibir um frame desatualizado.
  function computeLineGeomKey(){
    return [
      state.segments.length, state.geometryVersion||0, state.jobType,
      state.jobType==='print3d'?Math.floor(currentSegmentProgress()*250):0,
      document.getElementById('chkShowGrid')?.checked,
      document.getElementById('chkHeatmap')?.checked,
      document.getElementById('chkShowStock')?.checked,
      document.getElementById('chkShowLimits')?.checked,
      document.getElementById('stockViewMode')?.value,
      state.playIndex, state.selectedLine,
      state.showRapid, state.showCut, state.zMaxFilter,
      state.hidePlayedPath3D, JSON.stringify(state.toolVisibility||{}),
      (state.fixtures||[]).length
    ].join('|');
  }

  function renderWebGL3D(){
    if(!webgl3d.available)return false;
    const gl=webgl3d.gl,r=resizeWebGLCanvas();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(state.jobType==='cnc' && document.getElementById('chkShowStock')?.checked){
      buildStockWebGL(false);const pr=webgl3d.program;gl.useProgram(pr);glUniforms(webgl3d.programUniforms,r);
      const xr=webgl3d.programUniforms.uXray;if(xr!=null)gl.uniform1f(xr,state.xray?1:0);
      if(state.xray)gl.depthMask(false);
      if(webgl3d.meshIndexCount){gl.bindVertexArray(webgl3d.meshVAO);gl.drawElements(gl.TRIANGLES,webgl3d.meshIndexCount,gl.UNSIGNED_INT,0);}
      if(webgl3d.wallVertexCount){gl.bindVertexArray(webgl3d.wallVAO);gl.drawArrays(gl.TRIANGLES,0,webgl3d.wallVertexCount);}
      gl.depthMask(true);
    }
    if(state.jobType==='print3d'){
      buildDepositWebGL();
      drawDepositedPrintWebGL(r);
    }

    const lineKey=computeLineGeomKey();
    if(webgl3d.lineKey!==lineKey){
      webgl3d.lineKey=lineKey;
      buildWebGLLines();buildWebGLToolPoint();
    }
    const lp=webgl3d.lineProgram;gl.useProgram(lp);glUniforms(webgl3d.lineUniforms,r);
    if(webgl3d.lineUniforms.uPointSize!=null)gl.uniform1f(webgl3d.lineUniforms.uPointSize,8*r.dpr);
    if(webgl3d.lineUniforms.uRoundPoint!=null)gl.uniform1f(webgl3d.lineUniforms.uRoundPoint,0);
    gl.bindVertexArray(webgl3d.lineVAO);gl.drawArrays(gl.LINES,0,webgl3d.lineVertexCount);
    if(webgl3d.pointVertexCount){
      if(webgl3d.lineUniforms.uRoundPoint!=null)gl.uniform1f(webgl3d.lineUniforms.uRoundPoint,1);
      gl.bindVertexArray(webgl3d.pointVAO);gl.drawArrays(gl.POINTS,0,webgl3d.pointVertexCount);
    }
    gl.bindVertexArray(null);return true;
  }

  initWebGL3D();

  /* ============================================================
     RENDERIZADOR DE GRADE / GRID
  ============================================================ */
  function drawGrid(rect){
    ctx.save();
    ctx.lineWidth = 1;

    // Calcula passo adaptativo com base na escala (Zoom)
    let step = 10;
    if(state.scale * step < 15) step = 50;
    if(state.scale * step < 15) step = 100;
    if(state.scale * step > 150) step = 5;

    if(state.viewPlane === 'ISO'){
      // Grade 3D no plano Z=0, dimensionada a partir do próprio percurso (não dos limites da máquina)
      ctx.strokeStyle = '#222830';
      const b = state.bbox;
      const hasBbox = b && isFinite(b.minX);
      const spanX = Math.max(40, hasBbox ? (b.maxX-b.minX)*1.5 : 100);
      const spanY = Math.max(40, hasBbox ? (b.maxY-b.minY)*1.5 : 100);
      const cx = hasBbox ? (b.minX+b.maxX)/2 : 0;
      const cy = hasBbox ? (b.minY+b.maxY)/2 : 0;
      const gx0 = cx - spanX/2, gx1 = cx + spanX/2;
      const gy0 = cy - spanY/2, gy1 = cy + spanY/2;

      // limite defensivo: nunca desenhar mais que ~300 linhas por eixo, mesmo em zoom extremo
      const MAX_ISO_LINES = 300;
      const stepX = Math.max(step, spanX/MAX_ISO_LINES);
      const stepY = Math.max(step, spanY/MAX_ISO_LINES);

      ctx.beginPath();
      for(let x = Math.floor(gx0/stepX)*stepX; x <= gx1; x += stepX){
        const p1 = toScreen({x, y:gy0, z:0});
        const p2 = toScreen({x, y:gy1, z:0});
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
      for(let y = Math.floor(gy0/stepY)*stepY; y <= gy1; y += stepY){
        const p1 = toScreen({x:gx0, y, z:0});
        const p2 = toScreen({x:gx1, y, z:0});
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();

      // Gizmo de eixos coloridos na origem da peça — dá a referência 3D que faltava
      const origin = toScreen({x:0, y:0, z:0});
      const axisLen = Math.max(stepX*1.5, spanX*0.15);
      const gizmoAxes = [
        { pt:{x:axisLen, y:0, z:0}, color:'#ff6b6b', label:'X' },
        { pt:{x:0, y:axisLen, z:0}, color:'#3ddc84', label:'Y' },
        { pt:{x:0, y:0, z:axisLen}, color:'#4fd1e5', label:'Z' }
      ];
      gizmoAxes.forEach(a => {
        const p = toScreen(a.pt);
        ctx.beginPath();
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;
        ctx.moveTo(origin[0], origin[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        ctx.fillStyle = a.color;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(a.label, p[0]+4, p[1]);
      });
    } else {
      // Grade 2D para planos XY, XZ, YZ
      const wMinX = (0 - state.offsetX) / state.scale;
      const wMaxX = (rect.width - state.offsetX) / state.scale;
      const wMaxY = -(0 - state.offsetY) / state.scale;
      const wMinY = -(rect.height - state.offsetY) / state.scale;

      const startX = Math.floor(wMinX / step) * step;
      const endX = Math.ceil(wMaxX / step) * step;
      const startY = Math.floor(wMinY / step) * step;
      const endY = Math.ceil(wMaxY / step) * step;

      // limite defensivo contra zoom extremo (evita milhares de linhas por frame)
      const MAX_ORTHO_LINES = 600;
      const safeStepX = ((endX-startX)/step) > MAX_ORTHO_LINES ? (endX-startX)/MAX_ORTHO_LINES : step;
      const safeStepY = ((endY-startY)/step) > MAX_ORTHO_LINES ? (endY-startY)/MAX_ORTHO_LINES : step;

      // Linhas Secundárias da Grade
      ctx.beginPath();
      ctx.strokeStyle = '#1a1e23';
      for(let x = startX; x <= endX; x += safeStepX){
        if(x % (step * 5) === 0) continue;
        const [sx] = toScreen({x: x, y: 0, z: 0});
        ctx.moveTo(sx, 0); ctx.lineTo(sx, rect.height);
      }
      for(let y = startY; y <= endY; y += safeStepY){
        if(y % (step * 5) === 0) continue;
        const [, sy] = toScreen({x: 0, y: y, z: 0});
        ctx.moveTo(0, sy); ctx.lineTo(rect.width, sy);
      }
      ctx.stroke();

      // Linhas Principais da Grade (Divisão de 5x)
      ctx.beginPath();
      ctx.strokeStyle = '#272f38';
      const majorStep = step * 5;
      const startMajX = Math.floor(wMinX / majorStep) * majorStep;
      const endMajX = Math.ceil(wMaxX / majorStep) * majorStep;
      const startMajY = Math.floor(wMinY / majorStep) * majorStep;
      const endMajY = Math.ceil(wMaxY / majorStep) * majorStep;

      for(let x = startMajX; x <= endMajX; x += majorStep){
        const [sx] = toScreen({x: x, y: 0, z: 0});
        ctx.moveTo(sx, 0); ctx.lineTo(sx, rect.height);
      }
      for(let y = startMajY; y <= endMajY; y += majorStep){
        const [, sy] = toScreen({x: 0, y: y, z: 0});
        ctx.moveTo(0, sy); ctx.lineTo(rect.width, sy);
      }
      ctx.stroke();

      // Eixos de Origem (0,0)
      const [originX, originY] = toScreen({x: 0, y: 0, z: 0});
      
      // Eixo Horizontal (X)
      ctx.beginPath();
      ctx.strokeStyle = '#ff5c5c66';
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, originY); ctx.lineTo(rect.width, originY);
      ctx.stroke();

      // Eixo Vertical (Y)
      ctx.beginPath();
      ctx.strokeStyle = '#3ddc8466';
      ctx.lineWidth = 1.5;
      ctx.moveTo(originX, 0); ctx.lineTo(originX, rect.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ============================================================
     CANVAS INTERATIVO E ALINHAMENTO AUTOMÁTICO
  ============================================================ */
  function pointLerp(a,b,t){
    return {
      x:a.x+(b.x-a.x)*t,
      y:a.y+(b.y-a.y)*t,
      z:a.z+(b.z-a.z)*t
    };
  }

  // Interseção de uma reta 3D com a caixa de trabalho.
  // Retorna o intervalo t que está DENTRO da máquina.
  function lineInsideBox(a,b){
    let t0=0, t1=1;
    const mins=[0,0,-config.limZ];
    const maxs=[config.limX,config.limY,config.limZ];
    const av=[a.x,a.y,a.z], bv=[b.x,b.y,b.z];

    for(let i=0;i<3;i++){
      const d=bv[i]-av[i];
      if(Math.abs(d)<1e-12){
        if(av[i]<mins[i] || av[i]>maxs[i]) return null;
        continue;
      }
      let ta=(mins[i]-av[i])/d;
      let tb=(maxs[i]-av[i])/d;
      if(ta>tb){ const q=ta; ta=tb; tb=q; }
      t0=Math.max(t0,ta);
      t1=Math.min(t1,tb);
      if(t0>t1) return null;
    }
    return {t0,t1};
  }

  function draw3DWireBox(min,max,stroke,fill){
    const c=[
      {x:min.x,y:min.y,z:min.z},{x:max.x,y:min.y,z:min.z},
      {x:max.x,y:max.y,z:min.z},{x:min.x,y:max.y,z:min.z},
      {x:min.x,y:min.y,z:max.z},{x:max.x,y:min.y,z:max.z},
      {x:max.x,y:max.y,z:max.z},{x:min.x,y:max.y,z:max.z}
    ];
    const faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];

    if(fill && state.viewPlane==='ISO'){
      ctx.save();
      ctx.fillStyle=fill;
      faces.forEach(face=>{
        ctx.beginPath();
        face.forEach((idx,i)=>{
          const p=toScreen(c[idx]);
          if(i===0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]);
        });
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }

    const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    ctx.save();
    ctx.strokeStyle=stroke;
    ctx.lineWidth=1;
    ctx.setLineDash([4,3]);
    edges.forEach(([a,b])=>{
      const p1=toScreen(c[a]), p2=toScreen(c[b]);
      ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawToolMarker(pt, seg){
    const size=Math.max(5,Math.min(14,8+state.scale*0.01));
    ctx.save();
    ctx.lineCap='round';
    ctx.lineJoin='round';

    if(state.viewPlane==='ISO'){
      const tip=toScreen(pt);
      const shaft=toScreen({x:pt.x,y:pt.y,z:pt.z+Math.max(4,size*1.8)/Math.max(state.scale,0.001)});
      const up=toScreen({x:pt.x,y:pt.y,z:pt.z+Math.max(8,size*3)/Math.max(state.scale,0.001)});
      ctx.strokeStyle='#4fd1e5'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(up[0],up[1]); ctx.lineTo(shaft[0],shaft[1]); ctx.stroke();
      ctx.fillStyle='#4fd1e5';
      ctx.beginPath(); ctx.arc(tip[0],tip[1],Math.max(3,size/2),0,Math.PI*2); ctx.fill();
    }else{
      const p=toScreen(pt);
      ctx.strokeStyle='#4fd1e5'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(p[0],p[1],size,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p[0]-size-3,p[1]); ctx.lineTo(p[0]+size+3,p[1]); ctx.moveTo(p[0],p[1]-size-3); ctx.lineTo(p[0],p[1]+size+3); ctx.stroke();
    }
    ctx.restore();
  }

  // Desenha somente os trechos de cada segmento que estão fora dos limites.
  function drawLimitViolation(points){
    let found=false;
    ctx.save();
    ctx.strokeStyle='#ff5c5c';
    ctx.lineWidth=3;
    ctx.setLineDash([7,4]);
    for(let i=1;i<points.length;i++){
      const a=points[i-1], b=points[i];
      const inside=lineInsideBox(a,b);
      const pieces=[];
      if(!inside){
        pieces.push([0,1]);
      }else{
        if(inside.t0>1e-8) pieces.push([0,inside.t0]);
        if(inside.t1<1-1e-8) pieces.push([inside.t1,1]);
      }
      pieces.forEach(([tA,tB])=>{
        if(tB-tA<1e-8) return;
        const pa=toScreen(pointLerp(a,b,tA));
        const pb=toScreen(pointLerp(a,b,tB));
        ctx.beginPath(); ctx.moveTo(pa[0],pa[1]); ctx.lineTo(pb[0],pb[1]); ctx.stroke();
        found=true;
      });
    }
    ctx.restore();
    return found;
  }

  // Recorta uma polilinha pelo plano Z = filtro. Em vez de esconder o segmento inteiro,
  // mantém a parte visível e calcula a interseção do corte.
  function clipChainToZ(points,zMax){
    if(!isFinite(zMax)) return [points];
    const out=[];
    let current=[];
    function flush(){ if(current.length>=2) out.push(current); current=[]; }
    for(let i=1;i<points.length;i++){
      const a=points[i-1], b=points[i];
      const aIn=a.z<=zMax+1e-9, bIn=b.z<=zMax+1e-9;
      if(aIn && current.length===0) current.push(a);
      if(aIn && bIn){ current.push(b); continue; }
      const dz=b.z-a.z;
      if(Math.abs(dz)<1e-12){ if(aIn) current.push(b); else flush(); continue; }
      const t=(zMax-a.z)/dz;
      if(aIn && !bIn){
        current.push(pointLerp(a,b,Math.max(0,Math.min(1,t)))); flush();
      }else if(!aIn && bIn){
        current=[pointLerp(a,b,Math.max(0,Math.min(1,t))),b];
      }else{
        flush();
      }
    }
    flush();
    return out;
  }

  /* ============================================================
     STOCK SOLID + SIMULAÇÃO DE USINAGEM 3D
     O bloco é uma malha de alturas: cada célula representa o topo
     restante do material. A base continua sólida até o fundo.
     Não altera a UI; a simulação acompanha state.playIndex.
  ============================================================ */
  function stockBounds(){
    const top = config.stkZOrigin === 'top' ? 0 : config.stkZ;
    const bottom = config.stkZOrigin === 'top' ? -config.stkZ : 0;
    return { x0:0, x1:config.stkX, y0:0, y1:config.stkY,
      zTop:Math.max(top,bottom), zBottom:Math.min(top,bottom) };
  }

  function stockResolutionForMode(){
    const normal=Math.max(0.25, Math.min(2, Number(config.stockResolution)||0.5));
    // Durante o playback usamos uma malha mais grossa.
    // Quando parado, a malha volta à resolução configurada.
    if(state.stockQuality==='preview') return Math.max(normal, 1.0);
    return normal;
  }

  function resetStockSimulation(resolutionOverride=null){
    const b=stockBounds();
    const res=resolutionOverride ?? stockResolutionForMode();
    const nx=Math.max(1, Math.ceil((b.x1-b.x0)/res));
    const ny=Math.max(1, Math.ceil((b.y1-b.y0)/res));
    const actualResX=(b.x1-b.x0)/nx, actualResY=(b.y1-b.y0)/ny;
    const top=new Float32Array(nx*ny);
    top.fill(b.zTop);
    state.stockSim={nx,ny,dx:actualResX,dy:actualResY,top,bottom:b.zBottom,topOriginal:b.zTop,lastIndex:-1,resolution:res};
    state.stockCache=null;
    state.stockRenderCache=null;
    if(typeof webgl3d!=='undefined')webgl3d.stockKey='';
  }

  function ensureStockSimulation(){
    if(!state.stockSim) resetStockSimulation();
    return state.stockSim;
  }

  function stockToolRadius(seg){
    // Sem alterar a UI: usa o diâmetro configurado internamente.
    // 6 mm é o padrão do exemplo do próprio programa.
    return Math.max(0.25,(Number(seg && seg.toolDiameter) || Number(config.toolDiameter) || 6)/2);
  }

  function cutStockAtPoint(sim,x,y,z,radius,seg){
    const minX=Math.max(0,Math.floor((x-radius)/sim.dx));
    const maxX=Math.min(sim.nx-1,Math.floor((x+radius)/sim.dx));
    const minY=Math.max(0,Math.floor((y-radius)/sim.dy));
    const maxY=Math.min(sim.ny-1,Math.floor((y+radius)/sim.dy));
    const r2=radius*radius;
    const type=(seg&&seg.toolType)||'endmill';
    const angle=((seg&&seg.toolAngle)||60)*Math.PI/180;
    for(let iy=minY;iy<=maxY;iy++){
      const cy=(iy+0.5)*sim.dy;
      for(let ix=minX;ix<=maxX;ix++){
        const cx=(ix+0.5)*sim.dx;
        const d2=(cx-x)*(cx-x)+(cy-y)*(cy-y);
        if(d2>r2) continue;
        const d=Math.sqrt(d2);
        let cutterZ=z;
        if(type==='ballnose'){
          // z é a ponta inferior da esfera.
          cutterZ=z + radius - Math.sqrt(Math.max(0,radius*radius-d2));
        }else if(type==='vbit'){
          // Perfil cônico a partir da ponta da V-bit.
          cutterZ=z + d/Math.max(Math.tan(angle/2),1e-6);
        }
        const k=iy*sim.nx+ix;
        if(cutterZ<sim.top[k]) sim.top[k]=Math.max(sim.bottom,cutterZ);
      }
    }
  }

  function simulateStockSegment(seg, sim){
    if(state.jobType==='print3d') return;
    if(!seg || seg.type==='rapid') return;
    const pts=seg.type==='arc' ? [seg.start,...seg.points,seg.end] : [seg.start,seg.end];
    const radius=stockToolRadius(seg);
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1], b=pts[i];
      const len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
      const step=Math.max(Math.min(sim.dx,sim.dy)*0.6,0.35);
      const n=Math.max(1,Math.ceil(len/step));
      for(let j=0;j<=n;j++){
        const t=j/n;
        const x=a.x+(b.x-a.x)*t;
        const y=a.y+(b.y-a.y)*t;
        const z=a.z+(b.z-a.z)*t;
        // Só corta quando a ponta da ferramenta está dentro/abaixo do topo.
        if(z<=sim.topOriginal+1e-9) cutStockAtPoint(sim,x,y,z,radius,seg);
      }
    }
  }

  function rebuildStockTo(target, quality){
    state.stockQuality=quality;
    resetStockSimulation();
    const s=state.stockSim;
    if(target>=0){
      for(let i=0;i<=target && i<state.segments.length;i++) simulateStockSegment(state.segments[i],s);
      s.lastIndex=Math.min(target,state.segments.length-1);
    }
    state.stockRenderCache=null;
    if(typeof webgl3d!=='undefined')webgl3d.stockKey='';
  }

  function syncStockSimulation(){
    const target=(state.playing || state.playIndex>0) ? Math.min(state.playIndex,state.segments.length-1) : -1;
    if(target<0) return;

    const wantedQuality=state.playing ? 'preview' : 'normal';
    if(!state.stockSim || state.stockQuality!==wantedQuality){
      rebuildStockTo(target,wantedQuality);
      return;
    }

    const sim=state.stockSim;
    if(target < sim.lastIndex){
      rebuildStockTo(target,wantedQuality);
      return;
    }

    const start=sim.lastIndex+1;
    for(let i=start;i<=target;i++) simulateStockSegment(state.segments[i],sim);
    sim.lastIndex=target;
  }

  function refineStockAfterPlayback(){
    if(state.stockRefineTimer) cancelAnimationFrame(state.stockRefineTimer);
    state.stockRefineTimer=requestAnimationFrame(()=>{
      state.stockRefineTimer=null;
      if(state.playing) return;
      const target=state.playIndex>0 ? Math.min(state.playIndex,state.segments.length-1) : -1;
      if(target<0){
        state.stockQuality='normal';
        resetStockSimulation();
        drawCanvas();
        return;
      }
      rebuildStockTo(target,'normal');
      drawCanvas();
    });
  }


  function stockCellVisible(x,y,z){
    if(state.sectionAxis==='none')return true;
    const b=stockBounds();
    const t=Math.max(0,Math.min(1,state.sectionValue));
    if(state.sectionAxis==='X')return x<=b.x0+(b.x1-b.x0)*t;
    if(state.sectionAxis==='Y')return y<=b.y0+(b.y1-b.y0)*t;
    if(state.sectionAxis==='Z')return z<=b.zBottom+(b.zTop-b.zBottom)*t;
    return true;
  }

  function drawSolidStock3D(){
    const stockMode=document.getElementById('stockViewMode')?.value||'machined';
    if(stockMode==='original'){
      const b=stockBounds();
      draw3DWireBox({x:b.x0,y:b.y0,z:b.zBottom},{x:b.x1,y:b.y1,z:b.zTop},'#4fd1e588','#4fd1e522');
      return;
    }

    if(state.viewPlane!=='ISO') return;
    const sim=ensureStockSimulation();
    syncStockSimulation();
    const b=stockBounds();
    const cellW=sim.dx, cellH=sim.dy;
    ctx.save();
    ctx.lineJoin='round';
    ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=state.xray?0:3;ctx.shadowOffsetY=state.xray?0:2;
    ctx.lineCap='round';

    // Desenha primeiro as paredes externas do bloco, do fundo até o topo local.
    const sideAlpha='rgba(79,209,229,0.13)';
    const sideStroke='rgba(79,209,229,0.22)';
    const sides=[
      {x:0, yStart:0, axis:'y'},
      {x:sim.nx-1, yStart:0, axis:'y'},
      {y:0, xStart:0, axis:'x'},
      {y:sim.ny-1, xStart:0, axis:'x'}
    ];
    sides.forEach(side=>{
      const n=side.axis==='y'?sim.ny:sim.nx;
      for(let i=0;i<n;i++){
        let x0,y0,x1,y1,z;
        if(side.axis==='y'){
          const x=(side.x+0.5)*cellW;
          y0=i*cellH; y1=(i+1)*cellH; z=sim.top[side.x+ i*sim.nx];
          if(side.x===0){x0=0;x1=0;} else {x0=b.x1;x1=b.x1;}
        }else{
          const y=(side.y+0.5)*cellH;
          x0=i*cellW; x1=(i+1)*cellW; z=sim.top[side.y*sim.nx+i];
        }
        if(side.axis==='y'){
          const p=[toScreen({x:x0,y:y0,z:sim.bottom}),toScreen({x:x0,y:y1,z:sim.bottom}),toScreen({x:x0,y:y1,z}),toScreen({x:x0,y:y0,z})];
          ctx.beginPath(); p.forEach((q,k)=>k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath();
          ctx.fillStyle=sideAlpha; ctx.fill(); ctx.strokeStyle=sideStroke; ctx.lineWidth=.5; ctx.stroke();
        }else{
          const yy=(side.y===0?0:b.y1);
          const p=[toScreen({x:x0,y:yy,z:sim.bottom}),toScreen({x:x1,y:yy,z:sim.bottom}),toScreen({x:x1,y:yy,z}),toScreen({x:x0,y:yy,z})];
          ctx.beginPath(); p.forEach((q,k)=>k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath();
          ctx.fillStyle=sideAlpha; ctx.fill(); ctx.strokeStyle=sideStroke; ctx.lineWidth=.5; ctx.stroke();
        }
      }
    });

    // Superfície sólida usinada: cada célula é um quadrilátero com sua altura.
    // A ordem por diagonais reduz sobreposição visual na projeção ISO.
    for(let sum=0;sum<sim.nx+sim.ny-1;sum++){
      for(let iy=0;iy<sim.ny;iy++){
        const ix=sum-iy;
        if(ix<0 || ix>=sim.nx) continue;
        const z=sim.top[iy*sim.nx+ix];
        const x0=ix*cellW, x1=(ix+1)*cellW;
        const y0=iy*cellH, y1=(iy+1)*cellH;
        const p=[toScreen({x:x0,y:y0,z}),toScreen({x:x1,y:y0,z}),toScreen({x:x1,y:y1,z}),toScreen({x:x0,y:y1,z})];
        ctx.beginPath(); p.forEach((q,k)=>k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath();
        if(!stockCellVisible((x0+x1)/2,(y0+y1)/2,z))continue;
        const depth=Math.max(0,Math.min(1,(b.zTop-z)/Math.max(0.001,config.stkZ)));
        const alpha=state.xray?0.18:0.72;
        if(state.depthMap){
          const hue=220-depth*220;
          ctx.fillStyle=`hsla(${hue},85%,48%,${alpha})`;
        }else{
          ctx.fillStyle=`rgba(${40+Math.round(depth*35)},${150-Math.round(depth*55)},${175-Math.round(depth*55)},${alpha})`;
        }
        ctx.fill();
      }
    }
    ctx.restore();
    if(stockMode==='compare'){
      const bb=stockBounds();
      draw3DWireBox({x:bb.x0,y:bb.y0,z:bb.zBottom},{x:bb.x1,y:bb.y1,z:bb.zTop},'#ffb02088',null);
    }

  }



  function drawMachineReferences(){
    if(state.viewPlane!=='ISO')return;
    const items=[
      {p:config.home28,label:'G28',c:'#ff5c5c'},
      {p:config.home30,label:'G30',c:'#ffb020'},
      {p:config.workOffsets[state.activeWorkOffset]||{x:0,y:0,z:0},label:state.activeWorkOffset,c:'#c792ea'}
    ];
    ctx.save();ctx.font='bold 10px monospace';
    items.forEach(o=>{
      const q=toScreen(o.p);ctx.strokeStyle=o.c;ctx.fillStyle=o.c;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(q[0]-5,q[1]);ctx.lineTo(q[0]+5,q[1]);ctx.moveTo(q[0],q[1]-5);ctx.lineTo(q[0],q[1]+5);ctx.stroke();
      ctx.fillText(o.label,q[0]+7,q[1]-5);
    });ctx.restore();
  }

  function drawFixtures(){
    if(state.viewPlane!=='ISO'||!state.fixtures.length)return;
    state.fixtures.forEach((f,i)=>{
      draw3DWireBox(
        {x:f.x,y:f.y,z:f.z},{x:f.x+f.w,y:f.y+f.d,z:f.z+f.h},
        '#ffb020aa','rgba(255,176,32,.12)'
      );
    });
  }

  function pointInFixture(p,margin=0){
    return state.fixtures.find(f=>p.x>=f.x-margin&&p.x<=f.x+f.w+margin&&
      p.y>=f.y-margin&&p.y<=f.y+f.d+margin&&p.z>=f.z-margin&&p.z<=f.z+f.h+margin);
  }

  function analyzeCollisions(){
    if(state.jobType==='print3d') return [];
    const hits=[];
    state.segments.forEach((seg,idx)=>{
      if(seg.type==='event'||seg.type==='dwell')return;
      const pts=seg.type==='arc'?[seg.start,...seg.points]:[seg.start,seg.end];
      const sampleStep=Math.max(1,Math.floor(pts.length/30));
      for(let i=0;i<pts.length;i+=sampleStep){
        const p=pts[i],toolR=(seg.toolDiameter||6)/2;
        const fixture=pointInFixture(p,toolR);
        if(fixture){hits.push({line:seg.line,type:'fixture',text:`Possível colisão com fixture "${fixture.name||'Volume'}".`});break;}
        if(state.holderCollision){
          const holderBottom=p.z+(seg.stickout||25);
          const holderTop=holderBottom+(seg.holderLength||45);
          const stock=stockBounds();
          if(holderBottom<stock.zTop && p.x>=stock.x0&&p.x<=stock.x1&&p.y>=stock.y0&&p.y<=stock.y1){
            hits.push({line:seg.line,type:'holder',text:'Possível colisão do porta-ferramenta com o material.'});break;
          }
          const spindleRadius=Math.max(30,(seg.holderDiameter||20)*1.5);
          const spindleFixture=state.fixtures.find(f=>{
            const dx=Math.max(f.x-p.x,0,p.x-(f.x+f.w)),dy=Math.max(f.y-p.y,0,p.y-(f.y+f.d));
            return Math.hypot(dx,dy)<=spindleRadius && (f.z+f.h)>=holderTop;
          });
          if(spindleFixture){
            hits.push({line:seg.line,type:'spindle',text:`Possível colisão do spindle/porta-ferramenta com "${spindleFixture.name||'Fixture'}".`});break;
          }
        }
      }
    });
    state.collisionHits=hits;
    return hits;
  }

  function drawPrintDepositCanvas2D(geom){
    if(state.jobType!=='print3d')return false;
    const layerH=inferPrintLayerHeight(),nozzleW=Math.max(.20,state.printNozzleWidth||.45);
    const current=Math.max(0,Math.min(state.playIndex,state.segments.length-1));
    const progress=currentSegmentProgress();

    function drawChain(points,z,alpha=1){
      if(!points||points.length<2)return;
      const fc=printFilamentColor(z,layerH);
      ctx.save();ctx.beginPath();
      points.forEach((p,k)=>{const q=toScreen(p);if(k===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);});
      ctx.strokeStyle=`rgba(${Math.round(fc[0]*255)},${Math.round(fc[1]*255)},${Math.round(fc[2]*255)},${alpha})`;
      ctx.lineWidth=Math.max(2,nozzleW*state.scale);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.restore();
    }
    function prefix(points,pct){
      if(!points||points.length<2||pct<=0)return [];
      const ls=[];let total=0;for(let k=1;k<points.length;k++){const d=Math.hypot(points[k].x-points[k-1].x,points[k].y-points[k-1].y,points[k].z-points[k-1].z);ls.push(d);total+=d;}
      let rem=total*Math.min(1,pct),out=[points[0]];
      for(let k=0;k<ls.length&&rem>1e-9;k++){
        const a=points[k],b=points[k+1];if(rem>=ls[k]-1e-9){out.push(b);rem-=ls[k];}
        else{const t=ls[k]>1e-9?rem/ls[k]:0;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});break;}
      }
      return out;
    }

    for(let i=0;i<=current&&i<state.segments.length;i++){
      const seg=state.segments[i];if(!seg?.extruding)continue;
      const pts=geom[i]?.points;if(!pts?.length)continue;
      if(i<current)drawChain(pts,seg.end?.z||seg.start?.z||0,.95);
      else drawChain(prefix(pts,progress),currentPlaybackPosition().z,.98);
    }
    return true;
  }

  function drawCanvas(){
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const targetW=Math.max(1,Math.round(rect.width*dpr)), targetH=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==targetW || canvas.height!==targetH){ canvas.width=targetW; canvas.height=targetH; }
    ctx.setTransform(dpr,0,0,dpr,0,0);

    ctx.fillStyle='#121518';
    ctx.fillRect(0,0,rect.width,rect.height);

    // 3D ISO usa WebGL2/GPU; Canvas 2D fica como fallback automático.
    if(state.viewPlane==='ISO' && webgl3d.available){
      glCanvas.style.display='block';
      canvas.style.opacity='0';
      renderWebGL3D();
      updateMachineHud();
      drawXYZChart();
      return;
    }else{
      glCanvas.style.display='none';
      canvas.style.opacity='1';
    }

    if(document.getElementById('chkShowGrid').checked) drawGrid(rect);

    // Volume da máquina / soft limits.
    if(document.getElementById('chkShowLimits').checked){
      if(state.viewPlane==='ISO'){
        draw3DWireBox(
          {x:0,y:0,z:-config.limZ},
          {x:config.limX,y:config.limY,z:config.limZ},
          '#ff5c5c55', '#ff5c5c08'
        );
      }else{
        const p1=toScreen({x:0,y:0,z:0});
        const p2=state.viewPlane==='XY'
          ? toScreen({x:config.limX,y:config.limY,z:0})
          : (state.viewPlane==='XZ'
              ? toScreen({x:config.limX,y:0,z:config.limZ})
              : toScreen({x:0,y:config.limY,z:config.limZ}));
        ctx.save();
        ctx.strokeStyle='#ff5c5c44'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
        ctx.strokeRect(Math.min(p1[0],p2[0]),Math.min(p1[1],p2[1]),Math.abs(p2[0]-p1[0]),Math.abs(p2[1]-p1[1]));
        ctx.restore();
      }
    }

    // Bloco sólido + material usinado: disponível SOMENTE no ISO 3D.
    // Nos modos XY/XZ/YZ o checkbox não desenha nenhum bloco de material.
    if(
      state.viewPlane==='ISO' &&
      state.jobType==='cnc' &&
      document.getElementById('chkShowStock').checked
    ){
      drawSolidStock3D();
    }
    drawFixtures();
    drawMachineReferences();

    const useHeatmap=document.getElementById('chkHeatmap').checked;
    const geom=state.renderGeometry.length===state.segments.length
      ? state.renderGeometry
      : state.segments.map((seg,index)=>({index,type:seg.type,line:seg.line,feed:seg.feed,points:seg.type==='arc'?[seg.start,...seg.points]:[seg.start,seg.end]}));

    // Em impressão 3D o material é revelado apenas até o nozzle atual.
    // Futuras extrusões não são desenhadas como trajetória convencional.
    if(state.jobType==='print3d')drawPrintDepositCanvas2D(geom);

    let violationCount=0;

    geom.forEach((g,idx)=>{
      const seg=state.segments[idx];
      if(!seg) return;
      if(state.jobType==='print3d' && seg.extruding) return;
      if(seg.toolNumber && state.toolVisibility[seg.toolNumber]===false)return;
      if(seg.type==='rapid' && !state.showRapid)return;
      if(seg.type!=='rapid' && seg.type!=='event' && seg.type!=='dwell' && !state.showCut)return;
      const chains=clipChainToZ(g.points,state.zMaxFilter);
      if(!chains.length) return;

      const isSelected=seg.line===state.selectedLine;
      const isPlayed=idx<=state.playIndex;
      const isCurrent=idx===state.playIndex;

      chains.forEach(points=>{
        ctx.save();
        ctx.beginPath();
        points.forEach((p,i)=>{
          const [sx,sy]=toScreen(p);
          if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
        });

        if(useHeatmap && seg.type!=='rapid'){
          const hue=Math.max(0,Math.min(240,240-(seg.feed/1200)*240));
          ctx.strokeStyle=`hsl(${hue}, 80%, 50%)`;
        }else if(seg.type==='rapid'){
          ctx.setLineDash([5,4]);
          ctx.strokeStyle=isCurrent?'#ffd166':(isPlayed?'#ffb020':'#66460d');
        }else{
          ctx.setLineDash([]);

          /*
           * No modo ISO 3D, o bloco usinado é a representação
           * principal do caminho da ferramenta. A trajetória
           * verde de segmentos já executados fica oculta para
           * não poluir a visualização.
           *
           * Para reativar, altere:
           *   state.hidePlayedPath3D = true;
           * para false.
           */
          const hidePlayedPath3D =
            state.viewPlane === 'ISO' &&
            document.getElementById('chkShowStock')?.checked &&
            state.hidePlayedPath3D;

          if(hidePlayedPath3D && isPlayed && !isCurrent){
            ctx.strokeStyle='rgba(0,0,0,0)';
          }else{
            ctx.strokeStyle=isCurrent
              ? '#ffffff'
              : (isSelected
                  ? '#a9ffd0'
                  : (isPlayed ? '#3ddc84' : '#1b5232'));
          }
        }

        ctx.lineWidth=isSelected?3:(isCurrent?3.2:(seg.type==='rapid'?1.1:1.5));
        ctx.lineJoin='round'; ctx.lineCap='round';
        ctx.stroke();
        ctx.restore();
      });

      // Prévia de compensação G41/G42.
      if(seg.comp!=='G40') drawCompensationPreview(g.points,seg);

      // Trajetória que efetivamente sai da máquina.
      if(document.getElementById('chkShowLimits').checked){
        if(drawLimitViolation(g.points)) violationCount++;
      }
    });

    state.limitViolations=violationCount;

    // Ponto/ferramenta atual.
    if(state.segments.length && state.playIndex<state.segments.length){
      const tip=currentPlaybackPosition();
      drawToolMarker(tip,state.segments[state.playIndex]);
      els.droX.textContent=tip.x.toFixed(3);
      els.droY.textContent=tip.y.toFixed(3);
      els.droZ.textContent=tip.z.toFixed(3);
    }

    drawMeasurementOverlay();
    updateMachineHud();
    drawXYZChart();
  }

  /* ============================================================
     GRÁFICO DE POSIÇÃO XYZ AO LONGO DO PERCURSO
  ============================================================ */
  // Constrói a série de pontos (distância percorrida acumulada -> x,y,z) usada pelo gráfico.
  // Cacheada em state.xyzSeries e reconstruída apenas quando o programa é reanalisado (runParse),
  // já que drawCanvas() roda a cada frame de pan/zoom/playback e não deve refazer esse cálculo sempre.
  function buildXYZSeries(){
    const pts = [{ dist:0, x:0, y:0, z:0, segIndex:-1 }];
    if(state.segments.length){
      const first = state.segments[0].start;
      pts[0] = { dist:0, x:first.x, y:first.y, z:first.z, segIndex:-1 };
    }
    let dist = 0;
    state.segments.forEach((seg, idx) => {
      const chain = seg.type==='arc' ? [seg.start, ...seg.points] : [seg.start, seg.end];
      for(let i=1; i<chain.length; i++){
        dist += Math.hypot(chain[i].x-chain[i-1].x, chain[i].y-chain[i-1].y, chain[i].z-chain[i-1].z);
      }
      pts.push({ dist, x:seg.end.x, y:seg.end.y, z:seg.end.z, segIndex: idx });
    });
    state.xyzSeries = pts;
    return pts;
  }

  function drawXYZChart(){
    if(!xyzChartWrap || xyzChartWrap.style.display === 'none') return;
    const rect = xyzChart.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    xyzChart.width = rect.width * dpr;
    xyzChart.height = rect.height * dpr;
    xyzCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    xyzCtx.clearRect(0, 0, rect.width, rect.height);

    const padL = 6, padR = 6, padT = 8, padB = 14;
    const plotW = Math.max(1, rect.width - padL - padR);
    const plotH = Math.max(1, rect.height - padT - padB);

    const series = state.xyzSeries || buildXYZSeries();
    if(series.length < 2){
      xyzCtx.fillStyle = '#525a61';
      xyzCtx.font = '11px monospace';
      xyzCtx.fillText('Sem percurso para exibir', padL, rect.height/2);
      return;
    }

    const maxDist = series[series.length-1].dist || 1;
    let vMin = Infinity, vMax = -Infinity;
    series.forEach(p => {
      vMin = Math.min(vMin, p.x, p.y, p.z);
      vMax = Math.max(vMax, p.x, p.y, p.z);
    });
    if(vMin === vMax){ vMin -= 1; vMax += 1; }
    const vPad = (vMax-vMin) * 0.08;
    vMin -= vPad; vMax += vPad;

    const xAt = (d) => padL + (d/maxDist) * plotW;
    const yAt = (v) => padT + (1 - (v-vMin)/(vMax-vMin)) * plotH;

    // linha de referência no zero (quando o range inclui zero)
    if(vMin < 0 && vMax > 0){
      xyzCtx.strokeStyle = '#2a3138';
      xyzCtx.lineWidth = 1;
      xyzCtx.beginPath();
      xyzCtx.moveTo(padL, yAt(0)); xyzCtx.lineTo(padL+plotW, yAt(0));
      xyzCtx.stroke();
    }

    function drawSeries(key, color){
      xyzCtx.beginPath();
      xyzCtx.strokeStyle = color;
      xyzCtx.lineWidth = 1.4;
      series.forEach((p, i) => {
        const sx = xAt(p.dist), sy = yAt(p[key]);
        if(i===0) xyzCtx.moveTo(sx, sy); else xyzCtx.lineTo(sx, sy);
      });
      xyzCtx.stroke();
    }
    drawSeries('x', '#ff6b6b');
    drawSeries('y', '#3ddc84');
    drawSeries('z', '#4fd1e5');

    // linha vertical indicando a posição atual da simulação
    if(state.segments.length && state.playIndex < state.segments.length){
      const cur = series[Math.min(state.playIndex+1, series.length-1)];
      const px = xAt(cur.dist);
      xyzCtx.strokeStyle = '#ffb020';
      xyzCtx.lineWidth = 1.5;
      xyzCtx.beginPath();
      xyzCtx.moveTo(px, padT); xyzCtx.lineTo(px, padT+plotH);
      xyzCtx.stroke();
    }

    xyzCtx.fillStyle = '#525a61';
    xyzCtx.font = '9px monospace';
    xyzCtx.fillText(vMax.toFixed(0)+'mm', padL, padT+8);
    xyzCtx.fillText(vMin.toFixed(0)+'mm', padL, padT+plotH-2);
    xyzCtx.fillText(maxDist.toFixed(0)+'mm percorridos', padL+plotW-90, rect.height-3);
  }

  xyzChart.addEventListener('click', (e) => {
    const rect = xyzChart.getBoundingClientRect();
    const padL = 6, padR = 6;
    const plotW = Math.max(1, rect.width - padL - padR);
    const series = state.xyzSeries || buildXYZSeries();
    if(series.length < 2) return;
    const maxDist = series[series.length-1].dist || 1;
    const clickX = e.clientX - rect.left;
    const targetDist = ((clickX - padL) / plotW) * maxDist;

    let bestIdx = 0, bestDiff = Infinity;
    series.forEach(p => {
      const diff = Math.abs(p.dist - targetDist);
      if(diff < bestDiff){ bestDiff = diff; bestIdx = p.segIndex; }
    });
    state.playIndex = Math.max(0, Math.min(state.segments.length-1, bestIdx));
    updatePlaybackUI();
    drawCanvas();
  });

  document.getElementById('chkShowXYZChart').addEventListener('change', (e) => {
    xyzChartWrap.style.display = (e.target.checked && state.viewPlane === 'ISO') ? 'flex' : 'none';
    drawCanvas();
  });

  // Projeção axonométrica com rotação livre em torno de Z (azimute) e X (elevação).
  // Com os ângulos padrão (45°/35.264°) reproduz a isométrica "verdadeira" (eixos a 120°).
  function rotateProject(pt, azimuth, elevation){
    const cosA = Math.cos(azimuth), sinA = Math.sin(azimuth);
    const x1 = pt.x*cosA - pt.y*sinA;
    const y1 = pt.x*sinA + pt.y*cosA;
    const z1 = pt.z;
    const cosE = Math.cos(elevation), sinE = Math.sin(elevation);
    const y2 = y1*cosE + z1*sinE;
    const z2 = y1*sinE + z1*cosE;
    return { x:x1, y:z2, depth:y2 };
  }

  function toScreen(pt){
    if(state.viewPlane==='ISO'){
      /*
       * Projeção axonométrica de verdade: o ponto é rotacionado no espaço 3D
       * (azimute em torno de Z, depois elevação em torno de X) e então
       * projetado ortograficamente na tela. state.isoAzimuth/isoElevation
       * podem ser ajustados por arrasto do mouse ou pelos sliders.
       */
      const p = rotateProject(pt, state.isoAzimuth, state.isoElevation);
      let factor=1;
      if(state.projectionMode==='perspective'){
        factor=state.perspectiveDistance/Math.max(120,state.perspectiveDistance+p.depth);
      }
      return [
        p.x * factor * state.scale + state.offsetX,
        -p.y * factor * state.scale + state.offsetY
      ];
    }

    const [a1, a2] =
      state.viewPlane==='XZ'
        ? ['x','z']
        : (state.viewPlane==='YZ'
            ? ['y','z']
            : ['x','y']);

    return [
      pt[a1] * state.scale + state.offsetX,
      -pt[a2] * state.scale + state.offsetY
    ];
  }

  // ALINHAMENTO AUTOMÁTICO DE ENQUADRAMENTO
  function fitView(){
    const b = state.bbox;
    if(!b) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if(!rect.width || !rect.height) return;

    let min2D = { x: Infinity, y: Infinity };
    let max2D = { x: -Infinity, y: -Infinity };

    function projectForFit(pt){
      if(state.viewPlane === 'ISO'){
        return rotateProject(pt, state.isoAzimuth, state.isoElevation);
      }

      if(state.viewPlane === 'XZ'){
        return { x: pt.x, y: pt.z };
      }

      if(state.viewPlane === 'YZ'){
        return { x: pt.y, y: pt.z };
      }

      return { x: pt.x, y: pt.y };
    }

    function expand2D(pt){
      const p2d = projectForFit(pt);

      min2D.x = Math.min(min2D.x, p2d.x);
      max2D.x = Math.max(max2D.x, p2d.x);
      min2D.y = Math.min(min2D.y, p2d.y);
      max2D.y = Math.max(max2D.y, p2d.y);
    }

    if(isFinite(b.minX)){
      const corners = [
        {x: b.minX, y: b.minY, z: b.minZ},
        {x: b.maxX, y: b.minY, z: b.minZ},
        {x: b.minX, y: b.maxY, z: b.minZ},
        {x: b.maxX, y: b.maxY, z: b.minZ},
        {x: b.minX, y: b.minY, z: b.maxZ},
        {x: b.maxX, y: b.minY, z: b.maxZ},
        {x: b.minX, y: b.maxY, z: b.maxZ},
        {x: b.maxX, y: b.maxY, z: b.maxZ}
      ];
      corners.forEach(expand2D);

      if(state.jobType==='cnc' && document.getElementById('chkShowStock')?.checked){
        const sb=stockBounds();
        [
          {x:sb.x0,y:sb.y0,z:sb.zBottom},{x:sb.x1,y:sb.y0,z:sb.zBottom},
          {x:sb.x0,y:sb.y1,z:sb.zBottom},{x:sb.x1,y:sb.y1,z:sb.zBottom},
          {x:sb.x0,y:sb.y0,z:sb.zTop},{x:sb.x1,y:sb.y0,z:sb.zTop},
          {x:sb.x0,y:sb.y1,z:sb.zTop},{x:sb.x1,y:sb.y1,z:sb.zTop}
        ].forEach(expand2D);
      }
    } else {
      expand2D({x:0, y:0, z:0});
      expand2D({x:config.stkX, y:config.stkY, z:config.stkZ});
    }

    const w = Math.max(1, max2D.x - min2D.x);
    const h = Math.max(1, max2D.y - min2D.y);
    const padding =
      window.matchMedia('(max-width: 600px)').matches ? 24 :
      window.matchMedia('(max-width: 900px)').matches ? 40 : 70;

    state.scale = Math.min((rect.width - padding*2) / w, (rect.height - padding*2) / h);
    if(!isFinite(state.scale) || state.scale <= 0) state.scale = 1;

    const midX = (min2D.x + max2D.x) / 2;
    const midY = (min2D.y + max2D.y) / 2;

    state.offsetX = rect.width / 2 - midX * state.scale;
    state.offsetY = rect.height / 2 + midY * state.scale;

    drawCanvas();
  }



  function modelOrbitCenter(){
    const b=state.bbox;
    if(b && isFinite(b.minX)){
      return {
        x:(b.minX+b.maxX)/2,
        y:(b.minY+b.maxY)/2,
        z:(b.minZ+b.maxZ)/2
      };
    }
    return {x:0,y:0,z:0};
  }

  function projectedPixelAtAngles(pt,az,el){
    const p=rotateProject(pt,az,el);
    let factor=1;
    if(state.projectionMode==='perspective'){
      factor=(state.perspectiveDistance||900)/
        Math.max(120,(state.perspectiveDistance||900)+(p.depth||0));
    }
    return {
      x:p.x*factor*state.scale+state.offsetX,
      y:-p.y*factor*state.scale+state.offsetY
    };
  }

  function setOrbitAnglesKeepCenter(azimuth,elevation){
    const center=modelOrbitCenter();
    const before=projectedPixelAtAngles(center,state.isoAzimuth,state.isoElevation);

    state.isoAzimuth=azimuth;
    const lim=80*Math.PI/180;
    state.isoElevation=Math.max(-lim,Math.min(lim,elevation));

    const after=projectedPixelAtAngles(center,state.isoAzimuth,state.isoElevation);
    state.offsetX+=before.x-after.x;
    state.offsetY+=before.y-after.y;

    updateRotationReadout();
    if(typeof updateIsoControls==='function')updateIsoControls();
  }

  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    state.isDraggingCanvas = true;
    state.dragMode = (state.viewPlane === 'ISO' && !e.shiftKey) ? 'orbit' : 'pan';
    state.dragStart = {
      x: e.clientX, y: e.clientY,
      offsetX: state.offsetX, offsetY: state.offsetY,
      azimuth: state.isoAzimuth, elevation: state.isoElevation
    };
    canvas.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if(!state.isDraggingCanvas) return;
    const dx = e.clientX - state.dragStart.x;
    const dy = e.clientY - state.dragStart.y;

    if(state.dragMode === 'orbit'){
      setOrbitAnglesKeepCenter(
        state.dragStart.azimuth + dx * state.orbitSensitivity,
        state.dragStart.elevation - dy * state.orbitSensitivity
      );
    } else {
      state.offsetX = state.dragStart.offsetX + dx;
      state.offsetY = state.dragStart.offsetY + dy;
    }
    drawCanvas();
  });

  window.addEventListener('mouseup', () => {
    state.isDraggingCanvas = false;
    canvas.classList.remove('grabbing');
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = Math.max(0.72,Math.min(1.38,Math.exp(-e.deltaY*0.0015)));
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    state.offsetX = mouseX - (mouseX - state.offsetX) * zoomFactor;
    state.offsetY = mouseY - (mouseY - state.offsetY) * zoomFactor;
    state.scale = Math.max(0.0005,Math.min(5000,state.scale*zoomFactor));
    drawCanvas();
  });

  window.addEventListener('resize',()=>{if(webgl3d.available)resizeWebGLCanvas();drawCanvas();});

  /* ============================================================
     ATALHOS & EVENTOS DE EXECUÇÃO
  ============================================================ */
  window.addEventListener('keydown', (e) => {
    const target=e.target;
    const editing=target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement || target?.isContentEditable;
    if(editing || e.ctrlKey || e.altKey || e.metaKey || document.querySelector('dialog[open]')) return;
    if(e.key === 'F5'){ e.preventDefault(); togglePlay(); }
    if(e.key === 'Escape'){ e.preventDefault(); stopPlay(); fitView(); }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); stepPlaybackLine(-1); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); stepPlaybackLine(1); }
  });

  codeEl.addEventListener('keydown', (e) => {
    if(e.ctrlKey && e.key === '/'){
      e.preventDefault();
      const start = codeEl.selectionStart;
      const lines = codeEl.value.split('\n');
      const curLineIdx = codeEl.value.slice(0, start).split('\n').length - 1;
      if(lines[curLineIdx].startsWith(';')) lines[curLineIdx] = lines[curLineIdx].replace(/^;\s*/, '');
      else lines[curLineIdx] = '; ' + lines[curLineIdx];
      codeEl.value = lines.join('\n'); renderHighlight(); runParse();
    }
  });


  // ============================================================
  // RECURSOS DESKTOP 1.0
  // ============================================================
  function fmtTime(sec){
    sec=Math.max(0,Math.round(sec||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            :`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function buildProgramStats(){
    const s={segments:state.segments.length,rapid:0,cut:0,arc:0,dwell:0,
      distance:0,cutDistance:0,rapidDistance:0,time:0,minZ:Infinity,maxZ:-Infinity,tools:new Set()};
    state.segments.forEach(seg=>{
      s[seg.type]=(s[seg.type]||0)+1;
      const len=seg.length||0;s.distance+=len;s.time+=seg.durationSec||0;
      if(seg.type==='rapid')s.rapidDistance+=len;else if(seg.type!=='dwell')s.cutDistance+=len;
      s.minZ=Math.min(s.minZ,seg.start.z,seg.end.z);s.maxZ=Math.max(s.maxZ,seg.start.z,seg.end.z);
      if(seg.toolNumber)s.tools.add(seg.toolNumber);
    });
    if(!isFinite(s.minZ)){s.minZ=0;s.maxZ=0;}
    let weightedRPM=0,weightedFeed=0,weight=0;
    state.segments.forEach(seg=>{if(seg.type!=='rapid'&&seg.length>0){weightedRPM+=(seg.spindleRPM||0)*seg.length;weightedFeed+=(seg.feed||0)*seg.length;weight+=seg.length;}});
    s.avgRPM=weight?weightedRPM/weight:0;s.avgFeed=weight?weightedFeed/weight:0;
    state.stats=s;
    state.totalTime=s.time;
    state.cumulativeTimes=[];
    let acc=0;
    state.segments.forEach(seg=>{acc+=seg.durationSec||0;state.cumulativeTimes.push(acc);});
    return s;
  }

  function analyzeProgram(parsed){
    const issues=[...(parsed.warnings||[])];
    let lastTool=null;
    state.segments.forEach((seg,idx)=>{
      if(seg.feed<=0 && seg.type!=='rapid' && seg.type!=='dwell' && seg.type!=='event')
        issues.push({line:seg.line,severity:'error',text:state.jobType==='print3d'?'Movimento com avanço F igual ou menor que zero.':'Movimento de corte com avanço F igual ou menor que zero.'});

      if(state.jobType==='cnc'){
        if(seg.type!=='rapid' && seg.type!=='dwell' && seg.type!=='event' && !seg.spindle)
          issues.push({line:seg.line,severity:'warn',text:'Movimento de corte com spindle aparentemente desligado (M5/sem M3/M4).'});
        if(seg.end.z < stockBounds().zBottom-1e-6)
          issues.push({line:seg.line,severity:'error',text:`Ferramenta ultrapassa o fundo do material (${seg.end.z.toFixed(3)} mm).`});
        if(seg.comp!=='G40')
          issues.push({line:seg.line,severity:'info',text:`${seg.comp} detectado. A compensação é exibida como prévia geométrica; cantos dependem do controlador CNC.`});
      }

      if(seg.length > Math.max(config.limX,config.limY,config.limZ)*4)
        issues.push({line:seg.line,severity:'warn',text:`Movimento muito longo (${seg.length.toFixed(1)} mm). Verifique unidades e G90/G91.`});

      if(seg.toolNumber!==lastTool){lastTool=seg.toolNumber;}
    });

    if(state.jobType==='cnc'){
      const source=codeEl.value;
      const sourceLines=source.split(/\r?\n/);
      const lastLine=Math.max(1,sourceLines.length);
      if(!/\bM0?5\b/i.test(source))issues.push({line:lastLine,severity:'error',text:'Programa CNC sem M5 para desligar o spindle.'});
      if(!/\bM(?:0?2|30)\b/i.test(source))issues.push({line:lastLine,severity:'error',text:'Programa CNC sem comando de encerramento M2/M30.'});
      if(!/\bS\s*\d+/i.test(source))issues.push({line:1,severity:'warn',text:'Nenhuma rotação S foi definida para o spindle.'});
      state.segments.forEach(seg=>{
        if(seg.type==='rapid'){
          const horizontal=Math.hypot(seg.end.x-seg.start.x,seg.end.y-seg.start.y);
          if(horizontal>1 && Math.min(seg.start.z,seg.end.z)<config.safeZ)
            issues.push({line:seg.line,severity:'warn',text:`G0 horizontal abaixo do Safe Z (${config.safeZ} mm).`});
        }
      });
      analyzeCollisions().forEach(h=>issues.push({line:h.line,severity:'error',text:h.text}));
    }else{
      const extrusionCount=state.segments.filter(s=>s.extruding).length;
      if(extrusionCount===0)
        issues.push({line:1,severity:'warn',text:'Arquivo detectado como impressão 3D, mas nenhum movimento com extrusão positiva foi encontrado.'});
    }
    state.analysis=issues;
    return issues;
  }

  function renderAnalysisDialog(){
    const body=document.getElementById('analysisBody');
    if(!state.analysis.length){
      body.innerHTML='<div class="pro-card"><b>Nenhum problema detectado</b><span>O programa passou pelas verificações disponíveis.</span></div>';
      return;
    }
    body.innerHTML=state.analysis.map(i=>{
      const sev=i.severity||'warn';
      const label=sev==='error'?'ERRO':sev==='info'?'INFO':'AVISO';
      return `<div class="drawer-item severity-${sev}" onclick="scrollToLine(${i.line||1})">
        <b>${label} • Linha ${i.line||1}</b><span>${i.text}</span></div>`;
    }).join('');
  }

  function renderStatsDialog(){
    const s=state.stats||buildProgramStats();
    const tools=[...s.tools].map(n=>{
      const t=state.toolLibrary[n];return t?`T${n} ${t.name} Ø${t.diameter}mm`:`T${n}`;
    }).join('<br>')||'—';
    document.getElementById('statsBody').innerHTML=`
      <div class="pro-grid">
        <div class="pro-card"><b>Tempo estimado</b><span>${fmtTime(s.time)}</span></div>
        <div class="pro-card"><b>Movimentos</b><span>${s.segments}</span></div>
        <div class="pro-card"><b>Distância total</b><span>${s.distance.toFixed(1)} mm</span></div>
        <div class="pro-card"><b>Distância de corte</b><span>${s.cutDistance.toFixed(1)} mm</span></div>
        <div class="pro-card"><b>Movimento rápido</b><span>${s.rapidDistance.toFixed(1)} mm</span></div>
        <div class="pro-card"><b>Z mínimo / máximo</b><span>${s.minZ.toFixed(3)} / ${s.maxZ.toFixed(3)} mm</span></div>
        <div class="pro-card"><b>G0 / corte / arco</b><span>${s.rapid} / ${s.cut} / ${s.arc}</span></div>
        <div class="pro-card"><b>Ferramentas</b><span>${tools}</span></div>
      </div>`;
  }

  function renderToolLibrary(){
    const body=document.getElementById('toolLibBody');
    body.innerHTML=Object.values(state.toolLibrary).sort((a,b)=>a.number-b.number).map(t=>`
      <tr data-tool="${t.number}">
        <td>T${t.number}</td>
        <td><input data-k="name" value="${String(t.name).replace(/"/g,'&quot;')}"></td>
        <td><select data-k="type">
          <option value="endmill"${t.type==='endmill'?' selected':''}>End Mill</option>
          <option value="ballnose"${t.type==='ballnose'?' selected':''}>Ball Nose</option>
          <option value="vbit"${t.type==='vbit'?' selected':''}>V-Bit</option>
          <option value="drill"${t.type==='drill'?' selected':''}>Broca</option>
        </select></td>
        <td><input data-k="diameter" type="number" min=".1" step=".1" value="${t.diameter}"></td>
        <td><input data-k="angle" type="number" min="1" max="179" step="1" value="${t.angle||60}"></td>
        <td><input data-k="flutes" type="number" min="1" max="12" step="1" value="${t.flutes||2}"></td>
        <td><input data-k="stickout" type="number" min="1" step=".5" value="${t.stickout||25}"></td>
        <td><input data-k="holderDiameter" type="number" min="1" step=".5" value="${t.holderDiameter||20}"></td>
      </tr>`).join('');
  }

  function saveToolLibrary(){
    document.querySelectorAll('#toolLibBody tr').forEach(tr=>{
      const n=Number(tr.dataset.tool),old=state.toolLibrary[n]||{number:n};
      tr.querySelectorAll('[data-k]').forEach(el=>{
        const k=el.dataset.k;
        old[k]=(['diameter','angle','flutes','stickout','holderDiameter'].includes(k))?Number(el.value):el.value;
      });
      state.toolLibrary[n]=old;
    });
    runParse();
  }

  function renderBookmarks(){
    const lines=codeEl.value.split('\n');
    const all=[...new Set([...state.bookmarks,...state.breakpoints])].sort((a,b)=>a-b);
    document.getElementById('bookmarksBody').innerHTML=all.length?all.map(line=>{
      const isB=state.breakpoints.has(line),isM=state.bookmarks.has(line);
      return `<div class="drawer-item" onclick="scrollToLine(${line})"><b>Linha ${line}</b>
        <span>${isB?'● Breakpoint ':''}${isM?'◆ Marcador ':''}${(lines[line-1]||'').trim()}</span></div>`;
    }).join(''):'<div class="pro-card"><span>Nenhum marcador ou breakpoint.</span></div>';
  }

  function updateScrollMarks(){
    const count=Math.max(1,codeEl.value.split('\n').length);
    const toolMarks=(state.parsedTools||[]).map(t=>`<div class="scroll-mark tool" style="top:${t.line/count*100}%"></div>`);
    const bp=[...state.breakpoints].map(l=>`<div class="scroll-mark breakpoint-mark" style="top:${l/count*100}%"></div>`);
    const bm=[...state.bookmarks].map(l=>`<div class="scroll-mark bookmark-mark" style="top:${l/count*100}%"></div>`);
    scrollMapEl.innerHTML=[...toolMarks,...bp,...bm].join('');
  }

  function pushHistory(){
    if(state.historyLock)return;
    const value=codeEl.value;
    if(state.history[state.historyIndex]===value)return;
    state.history=state.history.slice(0,state.historyIndex+1);
    state.history.push(value);
    if(state.history.length>80)state.history.shift();
    state.historyIndex=state.history.length-1;
  }
  function restoreHistory(delta){
    const n=state.historyIndex+delta;
    if(n<0||n>=state.history.length)return;
    state.historyIndex=n;state.historyLock=true;codeEl.value=state.history[n];state.historyLock=false;
    renderHighlight();runParse();
  }

  function nearestGeometryPoint(clientX,clientY){
    const rect=canvas.getBoundingClientRect(),mx=clientX-rect.left,my=clientY-rect.top;
    let best=null,bestD=Infinity;
    state.renderGeometry.forEach(g=>g.points.forEach(p=>{
      const q=toScreen(p),d=(q[0]-mx)**2+(q[1]-my)**2;
      if(d<bestD){bestD=d;best=p;}
    }));
    return bestD<=900?{...best}:null;
  }

  function drawMeasurementOverlay(){
    if(!state.measurePoints.length)return;
    ctx.save();ctx.strokeStyle='#4fd1e5';ctx.fillStyle='#4fd1e5';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
    const a=toScreen(state.measurePoints[0]);
    ctx.beginPath();ctx.arc(a[0],a[1],4,0,Math.PI*2);ctx.fill();
    if(state.measurePoints[1]){
      const b=toScreen(state.measurePoints[1]);
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
      ctx.beginPath();ctx.arc(b[0],b[1],4,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  // Prévia de G41/G42: offset lateral em XY de cada trecho.
  function drawCompensationPreview(points,seg){
    if(seg.comp==='G40'||points.length<2)return;
    const sign=seg.comp==='G41'?1:-1, r=(seg.toolDiameter||config.toolDiameter)/2;
    ctx.save();ctx.strokeStyle='#c792ea99';ctx.setLineDash([3,3]);ctx.lineWidth=1;
    ctx.beginPath();
    points.forEach((p,i)=>{
      let a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      const op={x:p.x-sign*dy/len*r,y:p.y+sign*dx/len*r,z:p.z};
      const q=toScreen(op);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);
    });
    ctx.stroke();ctx.restore();
  }

  // dialog wiring
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeDialog).close()));
  document.getElementById('btnToolsLib').addEventListener('click',()=>{renderToolLibrary();document.getElementById('toolsLibDialog').showModal();});
  document.getElementById('btnAddTool').addEventListener('click',()=>{
    const n=Math.max(0,...Object.keys(state.toolLibrary).map(Number))+1;
    state.toolLibrary[n]={number:n,name:`Ferramenta ${n}`,type:'endmill',diameter:6,angle:60,flutes:2,stickout:25,holderDiameter:20,holderLength:45};renderToolLibrary();
  });
  document.getElementById('btnSaveTools').addEventListener('click',()=>{saveToolLibrary();document.getElementById('toolsLibDialog').close();});
  document.getElementById('btnAnalyze').addEventListener('click',()=>{renderAnalysisDialog();document.getElementById('analysisDialog').showModal();});
  document.getElementById('btnStats').addEventListener('click',()=>{renderStatsDialog();document.getElementById('statsDialog').showModal();});
  document.getElementById('btnBookmarks').addEventListener('click',()=>{renderBookmarks();document.getElementById('bookmarksDialog').showModal();});
  document.getElementById('btnUndo').addEventListener('click',()=>restoreHistory(-1));
  document.getElementById('btnRedo').addEventListener('click',()=>restoreHistory(1));
  document.getElementById('btnMeasure').addEventListener('click',()=>{
    state.measureMode=!state.measureMode;state.measurePoints=[];
    document.getElementById('measureBadge').style.display=state.measureMode?'block':'none';
    document.getElementById('btnMeasure').classList.toggle('primary',state.measureMode);drawCanvas();
  });

  gutterEl.addEventListener('dblclick',e=>{
    const line=Math.max(1,Math.floor((e.offsetY+editorScrollEl.scrollTop-10)/20)+1);
    state.breakpoints.has(line)?state.breakpoints.delete(line):state.breakpoints.add(line);
    updateScrollMarks();
  });

  canvas.addEventListener('click',async e=>{
    if(!state.measureMode)return;
    const p=nearestGeometryPoint(e.clientX,e.clientY);if(!p)return;
    state.measurePoints.push(p);
    if(state.measurePoints.length===2){
      const [a,b]=state.measurePoints,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
      drawCanvas();
      await htmlAlert(`ΔX: ${dx.toFixed(3)} mm\nΔY: ${dy.toFixed(3)} mm\nΔZ: ${dz.toFixed(3)} mm\nDistância: ${Math.hypot(dx,dy,dz).toFixed(3)} mm`,'Medição');
      state.measurePoints=[];drawCanvas();
    }else drawCanvas();
  });


  canvas.addEventListener('dblclick',e=>{
    if(state.measureMode)return;
    const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    let best=null,bestD=Infinity;
    state.renderGeometry.forEach((g,idx)=>{
      g.points.forEach(p=>{
        const q=toScreen(p),d=(q[0]-mx)**2+(q[1]-my)**2;
        if(d<bestD){bestD=d;best=state.segments[idx];}
      });
    });
    if(best&&bestD<1600)scrollToLine(best.line);
  });

  codeEl.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.key.toLowerCase()==='b'){
      e.preventDefault();const line=codeEl.value.slice(0,codeEl.selectionStart).split('\n').length;
      state.bookmarks.has(line)?state.bookmarks.delete(line):state.bookmarks.add(line);updateScrollMarks();
    }
    if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();restoreHistory(-1);}
    if(e.ctrlKey&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();restoreHistory(1);}
  });


  // ============================================================
  // DESKTOP 2.0 - PAINÉIS E PROCESSO
  // ============================================================
  function getRemovedVolume(){
    const sim=state.stockSim;if(!sim)return 0;
    const b=stockBounds();let vol=0;
    for(let i=0;i<sim.top.length;i++)vol+=(b.zTop-sim.top[i])*sim.dx*sim.dy;
    return Math.max(0,vol); // mm³
  }

  function processMetrics(){
    const s=state.stats||buildProgramStats();
    const material=state.materialLibrary[config.material]||state.materialLibrary.aluminum;
    const tools=[...new Set(state.segments.map(x=>x.toolNumber).filter(Boolean))];
    const perTool=tools.map(n=>{
      const t=state.toolLibrary[n]||{};
      const segs=state.segments.filter(x=>x.toolNumber===n&&x.type!=='rapid'&&x.type!=='event');
      const len=segs.reduce((a,x)=>a+(x.length||0),0);
      const rpm=segs.length?segs.reduce((a,x)=>a+(x.spindleRPM||0)*(x.length||1),0)/Math.max(1,len):0;
      const feed=segs.length?segs.reduce((a,x)=>a+(x.feed||0)*(x.length||1),0)/Math.max(1,len):0;
      const vc=rpm&&t.diameter?Math.PI*t.diameter*rpm/1000:0;
      const fz=rpm&&t.flutes?feed/(rpm*t.flutes):0;
      return {n,t,rpm,feed,vc,fz};
    });
    const volume=getRemovedVolume(),cutMin=Math.max(.001,s.cutDistance/Math.max(1,s.avgFeed||1));
    const massG=(volume/1000)*material.density;
    let loadSum=0,loadN=0;
    state.segments.forEach(seg=>{
      if(seg.type==='rapid'||seg.type==='event'||seg.type==='dwell')return;
      const t=state.toolLibrary[seg.toolNumber]||{};
      const depth=Math.max(0,Math.min(config.stkZ,stockBounds().zTop-Math.min(seg.start.z,seg.end.z)));
      const depthRatio=depth/Math.max(.1,t.diameter||6);
      const fz=(seg.spindleRPM&&t.flutes)?seg.feed/(seg.spindleRPM*t.flutes):0;
      const feedRatio=fz/Math.max(.001,material.chipLoad);
      loadSum+=Math.min(2,depthRatio)*Math.min(2,feedRatio);loadN++;
    });
    const loadIndex=loadN?loadSum/loadN:0;
    return {material,perTool,volume,mrr:volume/1000/cutMin,massG,loadIndex};
  }

  function renderProduction(){
    const ms=document.getElementById('materialSelect');
    ms.innerHTML=Object.entries(state.materialLibrary).map(([k,v])=>`<option value="${k}"${config.material===k?' selected':''}>${v.name}</option>`).join('');
    const m=state.materialLibrary[config.material];
    document.getElementById('materialSummary').innerHTML=`<b>${m.name}</b><span>Densidade ${m.density} g/cm³ • Vc ref. ${m.recommendedVc} m/min • Fz ref. ${m.chipLoad} mm/dente</span>`;
    const p=processMetrics();
    const rows=p.perTool.map(x=>`<div class="pro-card"><b>T${x.n} ${x.t.name||''}</b><span>RPM ${x.rpm.toFixed(0)} • F ${x.feed.toFixed(0)} • Vc ${x.vc.toFixed(1)} m/min • Fz ${x.fz.toFixed(3)} mm/dente</span></div>`).join('');
    document.getElementById('productionMetrics').innerHTML=
      `<div class="pro-card"><b>Volume removido</b><span>${(p.volume/1000).toFixed(2)} cm³</span></div>`+
      `<div class="pro-card"><b>MRR aproximado</b><span>${p.mrr.toFixed(2)} cm³/min</span></div>`+
      `<div class="pro-card"><b>Massa removida</b><span>${p.massG.toFixed(1)} g</span></div>`+
      `<div class="pro-card"><b>Índice de carga</b><span>${p.loadIndex.toFixed(2)} ${p.loadIndex>1.2?'⚠ agressivo':'aprox.'}</span></div>`+rows;
    const nums=[...new Set(state.segments.map(x=>x.toolNumber).filter(Boolean))];
    document.getElementById('toolFilters').innerHTML=nums.map(n=>`<label class="adv-chip"><input type="checkbox" data-tool-vis="${n}" ${state.toolVisibility[n]===false?'':'checked'}> T${n}</label>`).join('');
    document.getElementById('snapshotInfo').textContent=`${state.snapshots.length} snapshot(s) nesta sessão.`;
  }

  function renderMachine(){
    const g=document.getElementById('workOffsetsGrid');
    g.innerHTML=Object.keys(config.workOffsets).map(k=>{
      const o=config.workOffsets[k];
      return `<div class="pro-card"><b>${k}</b><div class="adv-grid">
        <label class="adv-field">X<input data-wo="${k}" data-axis="x" type="number" step=".001" value="${o.x}"></label>
        <label class="adv-field">Y<input data-wo="${k}" data-axis="y" type="number" step=".001" value="${o.y}"></label>
        <label class="adv-field">Z<input data-wo="${k}" data-axis="z" type="number" step=".001" value="${o.z}"></label>
      </div></div>`;
    }).join('');
    advSafeZ.value=config.safeZ;g28x.value=config.home28.x;g28y.value=config.home28.y;g28z.value=config.home28.z;
    g30x.value=config.home30.x;g30y.value=config.home30.y;g30z.value=config.home30.z;
    optionalStop.value=config.optionalStopEnabled?'1':'0';
  }

  function fixtureRow(f={},idx){
    return `<div class="adv-row" data-fixture="${idx}">
      <label class="adv-field">Nome<input data-f="name" value="${f.name||`Fixture ${idx+1}`}"></label>
      <label class="adv-field">X<input data-f="x" type="number" value="${f.x||0}"></label>
      <label class="adv-field">Y<input data-f="y" type="number" value="${f.y||0}"></label>
      <label class="adv-field">Z<input data-f="z" type="number" value="${f.z||0}"></label>
      <label class="adv-field">W<input data-f="w" type="number" value="${f.w||20}"></label>
      <label class="adv-field">D<input data-f="d" type="number" value="${f.d||20}"></label>
      <label class="adv-field">H<input data-f="h" type="number" value="${f.h||20}"></label>
    </div>`;
  }
  function renderSafety(){
    fixtureRows.innerHTML=state.fixtures.map(fixtureRow).join('');
    breakTool.value=state.conditionalBreak.toolChange?'1':'0';
    breakStop.value=state.conditionalBreak.programStop?'1':'0';
    breakDepth.value=state.conditionalBreak.depthZ;breakDepthOn.value=state.conditionalBreak.depthEnabled?'1':'0';
    const hits=analyzeCollisions();
    collisionSummary.innerHTML=`<div class="pro-card"><b>Colisões potenciais</b><span>${hits.length}</span></div>`+
      `<div class="pro-card"><b>Safe Z</b><span>${config.safeZ} mm</span></div>`;
  }

  function renderRecentFiles(){
    const rec=JSON.parse(localStorage.getItem('gcsRecent')||'[]');
    state.recentFiles=rec;
    recentFilesList.innerHTML=rec.length?rec.map((r,i)=>`<div class="drawer-item" data-recent="${i}"><b>${r.name}</b><span>${new Date(r.time).toLocaleString()}</span></div>`).join('')
      :'<div class="pro-card"><span>Nenhum arquivo recente neste navegador.</span></div>';
  }
  function rememberRecent(name,content){
    let rec=JSON.parse(localStorage.getItem('gcsRecent')||'[]').filter(x=>x.name!==name);
    rec.unshift({name,content,time:Date.now()});rec=rec.slice(0,8);localStorage.setItem('gcsRecent',JSON.stringify(rec));
  }

  function buildReport(){
    const s=state.stats||buildProgramStats(),p=processMetrics();
    const issues=state.analysis||[];
    reportBody.innerHTML=`<div class="pro-grid">
      <div class="pro-card"><b>Arquivo</b><span>${state.currentFileName}</span></div>
      <div class="pro-card"><b>Tempo estimado</b><span>${fmtTime(s.time)}</span></div>
      <div class="pro-card"><b>Distância total</b><span>${s.distance.toFixed(1)} mm</span></div>
      <div class="pro-card"><b>Material</b><span>${p.material.name}</span></div>
      <div class="pro-card"><b>Volume removido</b><span>${(p.volume/1000).toFixed(2)} cm³</span></div>
      <div class="pro-card"><b>MRR</b><span>${p.mrr.toFixed(2)} cm³/min</span></div>
      <div class="pro-card"><b>Work Offset</b><span>${state.activeWorkOffset}</span></div>
      <div class="pro-card"><b>Avisos / erros</b><span>${issues.length}</span></div>
    </div>
    <h4 style="font-family:var(--mono);color:var(--accent-green)">ANÁLISE</h4>
    ${issues.length?issues.map(x=>`<div class="drawer-item severity-${x.severity||'warn'}"><b>L${x.line}</b><span>${x.text}</span></div>`).join(''):'<p>Sem ocorrências.</p>'}`;
  }
  function printReport(){
    buildReport();const w=window.open('','_blank');
    if(!w){htmlAlert('O navegador bloqueou a janela de impressão.','Relatório');return;}
    w.document.write(`<html><head><title>Relatório - ${state.currentFileName}</title><style>body{font:13px Arial;padding:24px}h1{font-size:20px}.card{margin:8px 0}.issue{margin:5px 0}</style></head><body>
      <h1>G-Code Studio — Relatório de Simulação</h1><p>Wtec Sistemas • 2026</p>
      <div class="card"><b>Arquivo:</b> ${state.currentFileName}</div>
      <div class="card"><b>Tempo:</b> ${fmtTime(state.stats?.time||0)}</div>
      <div class="card"><b>Material:</b> ${(state.materialLibrary[config.material]||{}).name||config.material}</div>
      <div class="card"><b>Volume removido:</b> ${(getRemovedVolume()/1000).toFixed(2)} cm³</div>
      <h2>Análise</h2>${(state.analysis||[]).map(x=>`<div class="issue">L${x.line}: ${x.text}</div>`).join('')||'Sem ocorrências.'}
      </body></html>`);w.document.close();w.focus();w.print();
  }

  // Dialogs
  document.querySelectorAll('[data-close-adv]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeAdv).close()));
  btnMachine.addEventListener('click',()=>{renderMachine();machineDialog.showModal();});
  btnSafety.addEventListener('click',()=>{renderSafety();safetyDialog.showModal();});
  btnProduction.addEventListener('click',()=>{renderProduction();productionDialog.showModal();});
  btnEditorPlus.addEventListener('click',()=>{renderRecentFiles();editorPlusDialog.showModal();});

  btnApplyMachine.addEventListener('click',()=>{
    document.querySelectorAll('[data-wo]').forEach(el=>config.workOffsets[el.dataset.wo][el.dataset.axis]=Number(el.value)||0);
    config.safeZ=Number(advSafeZ.value)||0;
    config.home28={x:Number(g28x.value)||0,y:Number(g28y.value)||0,z:Number(g28z.value)||0};
    config.home30={x:Number(g30x.value)||0,y:Number(g30y.value)||0,z:Number(g30z.value)||0};
    config.optionalStopEnabled=optionalStop.value==='1';runParse();machineDialog.close();
  });

  btnAddFixture.addEventListener('click',()=>{state.fixtures.push({name:`Fixture ${state.fixtures.length+1}`,x:0,y:0,z:0,w:20,d:20,h:20});renderSafety();});
  btnApplySafety.addEventListener('click',()=>{
    const f=[];
    document.querySelectorAll('[data-fixture]').forEach(row=>{
      const o={};row.querySelectorAll('[data-f]').forEach(el=>o[el.dataset.f]=el.dataset.f==='name'?el.value:Number(el.value)||0);f.push(o);
    });
    state.fixtures=f;state.conditionalBreak.toolChange=breakTool.value==='1';state.conditionalBreak.programStop=breakStop.value==='1';
    state.conditionalBreak.depthEnabled=breakDepthOn.value==='1';state.conditionalBreak.depthZ=Number(breakDepth.value)||0;runParse();safetyDialog.close();
  });

  materialSelect.addEventListener('change',()=>{config.material=materialSelect.value;renderProduction();});
  productionDialog.addEventListener('change',e=>{if(e.target.matches('[data-tool-vis]')){state.toolVisibility[e.target.dataset.toolVis]=e.target.checked;drawCanvas();}});
  btnSnapshot.addEventListener('click',()=>{
    if(!state.stockSim)return;state.snapshots.push({top:new Float32Array(state.stockSim.top),playIndex:state.playIndex,virtualTime:state.virtualTime});
    renderProduction();
  });
  btnRestoreSnapshot.addEventListener('click',()=>{
    const s=state.snapshots[state.snapshots.length-1];if(!s||!state.stockSim)return;
    state.stockSim.top.set(s.top);state.playIndex=s.playIndex;state.virtualTime=s.virtualTime;drawCanvas();updatePlaybackUI();
  });
  btnReport.addEventListener('click',()=>{buildReport();reportDialog.showModal();});
  btnPrintReport.addEventListener('click',printReport);btnPrintReportInside.addEventListener('click',printReport);

  btnFindNext.addEventListener('click',()=>{
    const q=findText.value;if(!q)return;const start=codeEl.selectionEnd;
    let i=codeEl.value.indexOf(q,start);if(i<0)i=codeEl.value.indexOf(q);
    if(i>=0){codeEl.focus();codeEl.setSelectionRange(i,i+q.length);}
  });
  btnReplaceOne.addEventListener('click',()=>{if(codeEl.selectionStart!==codeEl.selectionEnd){codeEl.setRangeText(replaceText.value);renderHighlight();runParse();pushHistory();}});
  btnReplaceAll.addEventListener('click',()=>{const q=findText.value;if(!q)return;codeEl.value=codeEl.value.split(q).join(replaceText.value);renderHighlight();runParse();pushHistory();});
  btnGotoLine.addEventListener('click',()=>scrollToLine(Math.max(1,Number(gotoLine.value)||1)));
  recentFilesList.addEventListener('click',e=>{const row=e.target.closest('[data-recent]');if(!row)return;const r=state.recentFiles[Number(row.dataset.recent)];if(!r)return;
    codeEl.value=r.content;state.currentFileName=r.name;filename.textContent=r.name;renderHighlight();runParse();fitView();editorPlusDialog.close();
  });
  btnDiffFile.addEventListener('click',()=>diffFileInput.click());
  diffFileInput.addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;const other=await readFileText(f);
    const a=codeEl.value.split(/\r?\n/),b=other.split(/\r?\n/);let changed=0,added=0,removed=0;
    const max=Math.max(a.length,b.length);for(let i=0;i<max;i++){if(a[i]===undefined)added++;else if(b[i]===undefined)removed++;else if(a[i]!==b[i])changed++;}
    diffSummary.textContent=`${f.name}: ${changed} linha(s) alterada(s), ${added} adicionada(s), ${removed} removida(s).`;
  });

  function setPlaybackIndex(index){
    if(!state.segments.length) return;
    stopPlay();
    state.playIndex=Math.max(0,Math.min(state.segments.length-1,index));
    state.selectedLine=state.segments[state.playIndex]?.line??null;
    state.virtualTime=state.cumulativeTimes[state.playIndex-1]||0;
    rebuildStockTo(state.playIndex,'normal');
    updatePlaybackUI();
    updateMachineHud();
    drawCanvas();
  }

  function stepPlaybackLine(direction){
    if(!state.segments.length) return;
    const currentLine=state.segments[state.playIndex]?.line;
    let index=state.playIndex+direction;
    while(index>=0 && index<state.segments.length && state.segments[index].line===currentLine) index+=direction;
    setPlaybackIndex(index);
  }

  btnStepPrev.addEventListener('click',()=>setPlaybackIndex(state.playIndex-1));
  btnStepNext.addEventListener('click',()=>setPlaybackIndex(state.playIndex+1));

  chkShowRapid.addEventListener('change',()=>{state.showRapid=chkShowRapid.checked;drawCanvas();});
  chkShowCut.addEventListener('change',()=>{state.showCut=chkShowCut.checked;drawCanvas();});
  chkDepthMap.addEventListener('change',()=>{state.depthMap=chkDepthMap.checked;drawCanvas();});
  chkXray.addEventListener('change',()=>{state.xray=chkXray.checked;drawCanvas();});
  projectionMode.addEventListener('change',()=>{state.projectionMode=projectionMode.value;fitView();});
  sectionAxis.addEventListener('change',()=>{state.sectionAxis=sectionAxis.value;sectionSlider.style.display=state.sectionAxis==='none'?'none':'block';drawCanvas();});
  sectionSlider.addEventListener('input',()=>{state.sectionValue=Number(sectionSlider.value)/100;drawCanvas();});

  document.querySelectorAll('.camera-preset').forEach(b=>b.addEventListener('click',()=>{
    const m={iso:[45,35.264],top:[0,90],bottom:[0,-90],front:[0,0],back:[180,0],left:[90,0],right:[270,0]}[b.dataset.cam];
    setOrbitAnglesKeepCenter(m[0]*Math.PI/180,m[1]*Math.PI/180);fitView();
  }));
  btnSaveCamera.addEventListener('click',()=>localStorage.setItem('gcsCamera',JSON.stringify({a:state.isoAzimuth,e:state.isoElevation,p:state.projectionMode})));
  btnRestoreCamera.addEventListener('click',()=>{const c=JSON.parse(localStorage.getItem('gcsCamera')||'null');if(c){state.isoAzimuth=c.a;state.isoElevation=c.e;state.projectionMode=c.p||'ortho';projectionMode.value=state.projectionMode;fitView();}});

  function updateMachineHud(){
    if(!state.segments.length){machineHud.style.display='none';return;}
    const seg=state.segments[Math.min(state.playIndex,state.segments.length-1)],t=state.toolLibrary[seg.toolNumber]||{};
    machineHud.style.display=state.viewPlane==='ISO'?'block':'none';
    if(state.jobType==='print3d'){
      machineHud.innerHTML=`<b>IMPRESSÃO 3D</b> • ${seg.extruding?'Extrudindo':(seg.retracting?'Retração':'Travel')}<br>
        F ${Number(seg.feed||0).toFixed(0)} mm/min • ΔE ${Number(seg.extrusionDelta||0).toFixed(4)}<br>
        Layer ${seg.printLayer>=0?seg.printLayer:'?'} • ${seg.printFeature||'UNKNOWN'}<br>
        Z ${Number(currentPlaybackPosition().z||0).toFixed(3)} • ${state.projectionMode==='perspective'?'Perspectiva':'Axonométrica'}`;
    }else{
      machineHud.innerHTML=`<b>USINAGEM CNC</b> • ${seg.workOffset||state.activeWorkOffset} • T${seg.toolNumber||'-'} ${t.name||''}<br>
        F ${Number(seg.feed||0).toFixed(0)} mm/min • S ${seg.spindleRPM||0} rpm • Coolant ${seg.coolant||'off'}<br>
        ${seg.comp||'G40'} • ${state.projectionMode==='perspective'?'Perspectiva':'Axonométrica'}`;
    }
  }

  /* ============================================================
     PARSER UPDATE, PLAYBACK & DRAWERS
  ============================================================ */
  function runParse(){
    const source=codeEl.value;
    if(config.simAdaptive){
      const lineCount=(source.match(/\n/g)||[]).length+1;
      if(lineCount>100000){config.simArcTolerance=.25;config.simArcMaxSteps=768;}
      else if(lineCount>50000){config.simArcTolerance=.15;config.simArcMaxSteps=1536;}
      else if(lineCount>15000){config.simArcTolerance=.08;config.simArcMaxSteps=3072;}
      else{config.simArcTolerance=.05;config.simArcMaxSteps=4096;}
      state.simQualityLabel=lineCount>100000?'ULTRA LEVE':lineCount>50000?'LEVE':lineCount>15000?'OTIMIZADA':'PRECISA';
    }
    applyDetectedJobType(source);
    const parsed = parseGCode(source);
    if(state.jobType==='cnc'){
      for(const seg of parsed.segments){
        if((seg.type==='cut'||seg.type==='arc') && !seg.spindle && Math.min(seg.start.z,seg.end.z)<0) parsed.warnings.push({line:seg.line,severity:'warn',text:'Corte abaixo de Z0 com spindle desligado.'});
        if(seg.type==='rapid' && Math.min(seg.start.z,seg.end.z)<(config.safeZ??0)-1e-6) parsed.warnings.push({line:seg.line,severity:'warn',text:'G0 abaixo do Safe Z configurado.'});
        if(Math.max(Math.abs(seg.start.x),Math.abs(seg.end.x))>(config.limits?.x||Infinity)||Math.max(Math.abs(seg.start.y),Math.abs(seg.end.y))>(config.limits?.y||Infinity)) parsed.warnings.push({line:seg.line,severity:'error',text:'Movimento excede limites XY da máquina.'});
        if(seg.feed>20000) parsed.warnings.push({line:seg.line,severity:'warn',text:'Avanço muito alto (> 20000 mm/min).'});
      }
    }
    state.segments = parsed.segments;
    state.geometryVersion = (state.geometryVersion||0) + 1; // invalida o cache de geometria WebGL (buildWebGLLines)
    if(typeof webgl3d!=='undefined') webgl3d.depositKey='';
    state.renderGeometry = parsed.segments.map((seg, index) => ({
      index,
      type: seg.type,
      line: seg.line,
      feed: seg.feed,
      points: seg.type === 'arc' ? [seg.start, ...(seg.points||[])] : [seg.start, seg.end]
    }));
    state.bbox = parsed.bbox;
    state.parsedTools = parsed.tools;
    state.limitViolations = [];
    state.playIndex = 0;
    state.stockQuality='normal';
    resetStockSimulation();
    // Pré-análise de movimentos problemáticos. A UI continua a mesma;
    // apenas alimentamos o painel de avisos existente.
    const extraWarnings = [];
    parsed.segments.forEach((seg, idx) => {
      const pts = seg.type==='arc' ? [seg.start, ...seg.points] : [seg.start, seg.end];
      let len=0;
      for(let i=1;i<pts.length;i++) len += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y, pts[i].z-pts[i-1].z);
      seg.length = len;
      if(len > Math.max(config.limX,config.limY,config.limZ)*4){
        extraWarnings.push({line:seg.line,text:`Movimento muito longo na linha ${seg.line} (${len.toFixed(1)}mm). Verifique G90/G91 e unidades.`});
      }
    });
    parsed.warnings.push(...extraWarnings);
    buildProgramStats();
    analyzeProgram(parsed);
    buildXYZSeries();

    const overflow = parsed.bbox.minX < 0 || parsed.bbox.minY < 0 || parsed.bbox.minZ < -config.limZ ||
      parsed.bbox.maxX > config.limX || parsed.bbox.maxY > config.limY || parsed.bbox.maxZ > config.limZ;
    els.statLimitStatus.textContent = overflow ? 'EXCEDIDO!' : 'OK';
    els.statLimitStatus.style.color = overflow ? 'var(--accent-red)' : 'var(--accent-green)';

    els.statBBox.textContent = `${(parsed.bbox.maxX-parsed.bbox.minX).toFixed(0)}x${(parsed.bbox.maxY-parsed.bbox.minY).toFixed(0)}x${(parsed.bbox.maxZ-parsed.bbox.minZ).toFixed(0)}mm`;
    els.statBBox.title=`Qualidade da simulação: ${state.simQualityLabel||'PRECISA'} · tolerância arco ${config.simArcTolerance} mm`; 
    
    updateScrollMarks();
    
    els.statToolCount.textContent = parsed.tools.length;
    document.getElementById('toolsDrawer').innerHTML = parsed.tools.length 
      ? parsed.tools.map(t => `<div class="drawer-item" onclick="scrollToLine(${t.line})"><b>Linha ${t.line}:</b> <span>${t.raw}</span></div>`).join('')
      : '<div style="padding:8px 12px; color:var(--text-faint)">Nenhuma troca de ferramenta (M6) detectada.</div>';

    els.statWarnCount.textContent = state.analysis.length;
    document.getElementById('warnsDrawer').innerHTML = state.analysis.length
      ? state.analysis.map(w => `<div class="drawer-item severity-${w.severity||'warn'}" onclick="scrollToLine(${w.line||1})"><b>${(w.severity||'warn').toUpperCase()}:</b> <span>${w.text}</span></div>`).join('')
      : '<div style="padding:8px 12px; color:var(--text-faint)">Nenhum erro ou aviso detectado.</div>';

    const zSlider = document.getElementById('zSliceSlider');
    zSlider.min = parsed.bbox.minZ; zSlider.max = parsed.bbox.maxZ; zSlider.value = parsed.bbox.maxZ;
    state.zMaxFilter = parsed.bbox.maxZ;

    els.scrub.max = Math.max(0, state.segments.length-1);
    updatePlaybackUI(); updateMachineHud(); drawCanvas();
  }

  window.scrollToLine = (line) => {
    const lineH = 20;
    instantScrollEditor((line - 3) * lineH);
    codeEl.focus();
    const lines = codeEl.value.split('\n');
    let pos = 0;
    for(let i=0; i<line-1 && i<lines.length; i++) pos += lines[i].length + 1;
    const lineLen = lines[line-1] ? lines[line-1].length : 0;
    codeEl.setSelectionRange(pos, pos + lineLen);
    updateCursorHighlight();
  };

  document.getElementById('btnToggleTools').addEventListener('click', () => {
    const d = document.getElementById('toolsDrawer');
    d.classList.toggle('open');
    document.getElementById('warnsDrawer').classList.remove('open');
  });

  document.getElementById('btnToggleWarns').addEventListener('click', () => {
    const d = document.getElementById('warnsDrawer');
    d.classList.toggle('open');
    document.getElementById('toolsDrawer').classList.remove('open');
  });

  // Rola o editor de forma instantânea (ignora o scroll-behavior:smooth do CSS),
  // usado pelo acompanhamento da simulação para não conflitar com scrolls
  // em andamento quando os ticks chegam rápido (velocidades altas).
  function instantScrollEditor(top){
    const prevBehavior = editorScrollEl.style.scrollBehavior;
    editorScrollEl.style.scrollBehavior = 'auto';
    editorScrollEl.scrollTop = Math.max(0, top);
    gutterEl.scrollTop = editorScrollEl.scrollTop;
    editorScrollEl.style.scrollBehavior = prevBehavior || '';
  }

  // Atualização do Playback + Auto-Scroll da caixa de texto
  function updatePlaybackUI(){
    els.scrub.value = state.playIndex;
    els.playIdx.textContent = `${state.playIndex+1}/${state.segments.length}`;
    document.getElementById('timeStatus').textContent=`${fmtTime(state.virtualTime)} / ${fmtTime(state.totalTime)}`;
    if(state.segments[state.playIndex]){
      const lineNum = state.segments[state.playIndex].line;
      playHighlightEl.style.display = 'block';
      playHighlightEl.style.top = (10 + (lineNum-1)*20) + 'px';

      const lineH = 20;
      const lineTop = 10 + (lineNum - 1) * lineH;
      const viewHeight = editorScrollEl.clientHeight;
      const currentScroll = editorScrollEl.scrollTop;

      if (lineTop < currentScroll + 20 || lineTop > currentScroll + viewHeight - 40) {
        instantScrollEditor(lineTop - viewHeight / 2);
      }
    }
  }

  function togglePlay(){ state.playing ? stopPlay() : startPlay(); }

  async function advanceSequence(){
    if(!state.sequencePlaying || !state.fileQueue.length) return false;

    const nextIndex = state.fileQueueIndex + 1;
    if(nextIndex >= state.fileQueue.length){
      state.sequencePlaying = false;
      state.fileQueue = [];
      state.fileQueueIndex = -1;
      state.multiFileMode = null;
      return false;
    }

    state.fileQueueIndex = nextIndex;
    return await loadProgramFile(state.fileQueue[nextIndex], {startPlayback:true});
  }

  function startPlay(){
    if(!state.segments.length)return;
    state.playing=true;
    state.stockQuality='preview';
    document.getElementById('btnPlay').textContent='⏸';
    if(state.playTimer){cancelAnimationFrame(state.playTimer);state.playTimer=null;}
    if(state.playIndex<=0) state.virtualTime=0;
    else state.virtualTime=state.cumulativeTimes[Math.max(0,state.playIndex-1)]||0;
    state.playClockLast=performance.now();
    state.playUiLast=0;
    if(state.playIndex>0) rebuildStockTo(state.playIndex,'preview'); else resetStockSimulation();
    state.playTimer=requestAnimationFrame(stepPlay);
  }

  function stopPlay(){
    state.playing=false;
    document.getElementById('btnPlay').textContent='▶';
    if(state.playTimer)cancelAnimationFrame(state.playTimer);state.playTimer=null;
    refineStockAfterPlayback();updatePlaybackUI();
  }

  async function stepPlay(now){
    if(!state.playing)return;
    now=Number.isFinite(now)?now:performance.now();
    const dt=Math.max(0,(now-state.playClockLast)/1000);
    state.playClockLast=now;
    state.virtualTime+=dt*state.playSpeed;

    while(state.playIndex<state.segments.length-1 &&
          state.virtualTime>=(state.cumulativeTimes[state.playIndex]||0)){
      state.playIndex++;
      const curSeg=state.segments[state.playIndex];
      const line=curSeg?.line;
      if(line && state.breakpoints.has(line)){
        stopPlay();await htmlAlert(`Breakpoint atingido na linha ${line}.`,'Breakpoint');break;
      }
      if(curSeg){
        const prev=state.segments[state.playIndex-1];
        if(state.conditionalBreak.toolChange && prev && curSeg.toolNumber!==prev.toolNumber){
          stopPlay();await htmlAlert(`Troca para T${curSeg.toolNumber} na linha ${line}.`,'Troca de ferramenta');break;
        }
        if(state.conditionalBreak.depthEnabled && curSeg.end?.z<=state.conditionalBreak.depthZ){
          stopPlay();await htmlAlert(`Profundidade condicional atingida: Z${curSeg.end.z.toFixed(3)}.`,'Breakpoint Z');break;
        }
        if(curSeg.type==='event'){
          if(curSeg.event==='M0' || (curSeg.event==='M1'&&config.optionalStopEnabled)){
            stopPlay();await htmlAlert(`${curSeg.event} na linha ${line}.`,'Parada do programa');break;
          }
          if(curSeg.event==='M30'){
            /*
             * Em reprodução de vários arquivos "como um só", cada M30
             * marca apenas o fim lógico daquele arquivo original.
             * Não deve encerrar o conjunto combinado nem avançar o
             * playIndex para o último segmento.
             *
             * Fora do modo combinado, mantém o comportamento CNC normal:
             * M30 encerra o programa atual.
             */
            if(state.multiFileMode === 'combined'){
              continue;
            }

            state.virtualTime = state.totalTime;
            state.playIndex = state.segments.length - 1;
            break;
          }
        }
      }
    }

    if(state.virtualTime>=state.totalTime || state.playIndex>=state.segments.length-1){
      state.playIndex=Math.max(0,state.segments.length-1);
      state.virtualTime=state.totalTime;
      if(state.playTimer)cancelAnimationFrame(state.playTimer);state.playTimer=null;state.playing=false;
      if(state.sequencePlaying){
        const advanced=await advanceSequence();
        if(advanced)return;
      }
      document.getElementById('btnPlay').textContent='▶';
      refineStockAfterPlayback();
    }
    // O canvas acompanha o refresh real do monitor (60/120/144 Hz). A UI textual é
    // atualizada em frequência menor para não gastar layout/scroll a cada frame.
    if(!state.playUiLast || now-state.playUiLast>=50){updatePlaybackUI();state.playUiLast=now;}
    drawCanvas();
    if(state.playing)state.playTimer=requestAnimationFrame(stepPlay);
  }

  document.getElementById('speedSelect').addEventListener('change', (e) => {
    state.playSpeed = parseFloat(e.target.value);
    if(state.playing) startPlay();
  });

  // Checkbox Overlays
  ['chkShowGrid', 'chkHeatmap', 'chkShowStock', 'chkShowLimits', 'stockViewMode'].forEach(id => {
    document.getElementById(id).addEventListener('change', drawCanvas);
  });

  // Snippets
  document.getElementById('btnSnipHeader').addEventListener('click', () => {
    codeEl.value = "G21 G90 G17 G40 G49\n" + codeEl.value;
    renderHighlight(); runParse(); fitView();
  });
  document.getElementById('btnSnipRetract').addEventListener('click', () => {
    codeEl.value += "\nG0 Z" + config.limZ;
    renderHighlight(); runParse(); fitView();
  });
  document.getElementById('btnSnipFooter').addEventListener('click', () => {
    codeEl.value += "\nM5 M9\nG0 X0 Y0\nM30\n";
    renderHighlight(); runParse(); fitView();
  });

  // Modais
  window.closeDialogs = () => document.querySelectorAll('.dialog-overlay').forEach(d => d.classList.remove('open'));
  document.getElementById('btnDlgShift').addEventListener('click', () => document.getElementById('dlgShift').classList.add('open'));
  document.getElementById('btnDlgScale').addEventListener('click', () => document.getElementById('dlgScale').classList.add('open'));
  document.getElementById('btnDlgRotate').addEventListener('click', () => document.getElementById('dlgRotate').classList.add('open'));
  document.getElementById('btnDlgLimits').addEventListener('click', () => document.getElementById('dlgLimits').classList.add('open'));
  document.getElementById('btnDlgStock').addEventListener('click', () => document.getElementById('dlgStock').classList.add('open'));

  document.getElementById('btnSaveLimits').addEventListener('click', () => {
    config.limX = parseFloat(document.getElementById('limX').value);
    config.limY = parseFloat(document.getElementById('limY').value);
    config.limZ = parseFloat(document.getElementById('limZ').value);
    closeDialogs(); runParse(); fitView();
  });
  document.getElementById('btnSaveStock').addEventListener('click', () => {
    config.stkX = parseFloat(document.getElementById('stkX').value);
    config.stkY = parseFloat(document.getElementById('stkY').value);
    config.stkZ = parseFloat(document.getElementById('stkZ').value);
    config.stkZOrigin = document.getElementById('stkZOrigin').value;
    resetStockSimulation();
    state.playIndex = 0;
    updatePlaybackUI();
    closeDialogs(); fitView();
  });

  // Ocultar/reexibir o menu de opções da área de visualização
  document.getElementById('overlayHeader').addEventListener('click', () => {
    document.getElementById('canvasOverlay').classList.toggle('collapsed');
  });

  // Planos de Visualização
  document.getElementById('planeSeg').addEventListener('click', (e) => {
    if(e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#planeSeg button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.viewPlane = e.target.dataset.plane;
    const isIso = state.viewPlane === 'ISO';
    document.getElementById('isoRotateBox').style.display = isIso ? 'block' : 'none';
    document.getElementById('xyzChartToggleLabel').style.display = isIso ? 'flex' : 'none';
    xyzChartWrap.style.display = (isIso && document.getElementById('chkShowXYZChart').checked) ? 'flex' : 'none';
    fitView();
  });

  function updateRotationReadout(){
    const azDeg = ((state.isoAzimuth * 180/Math.PI) % 360 + 360) % 360;
    const elDeg = state.isoElevation * 180/Math.PI;
    document.getElementById('azimuthVal').textContent = Math.round(azDeg) + '°';
    document.getElementById('elevationVal').textContent = Math.round(elDeg) + '°';
    document.getElementById('azimuthSlider').value = azDeg;
    document.getElementById('elevationSlider').value = elDeg;
  }

  document.getElementById('azimuthSlider').addEventListener('input', (e) => {
    state.isoAzimuth = parseFloat(e.target.value) * Math.PI/180;
    updateRotationReadout();
    drawCanvas();
  });
  document.getElementById('elevationSlider').addEventListener('input', (e) => {
    state.isoElevation = parseFloat(e.target.value) * Math.PI/180;
    updateRotationReadout();
    drawCanvas();
  });
  document.getElementById('btnResetRotation').addEventListener('click', () => {
    state.isoAzimuth = Math.PI/4;
    state.isoElevation = Math.atan(1/Math.sqrt(2));
    updateRotationReadout();
    fitView();
  });

  document.getElementById('zSliceSlider').addEventListener('input', (e) => {
    state.zMaxFilter = parseFloat(e.target.value);
    document.getElementById('zSliceVal').textContent = state.zMaxFilter.toFixed(1) + 'mm';
    drawCanvas();
  });

  document.getElementById('btnResetZSlice').addEventListener('click', () => {
    state.zMaxFilter = state.bbox ? state.bbox.maxZ : Infinity;
    const zs=document.getElementById('zSliceSlider');
    if(state.bbox) zs.value=state.bbox.maxZ;
    document.getElementById('zSliceVal').textContent = isFinite(state.zMaxFilter) ? state.zMaxFilter.toFixed(1)+'mm' : 'MAX';
    drawCanvas();
  });

  document.getElementById('btnFit').addEventListener('click', fitView);
  document.getElementById('btnPlay').addEventListener('click', togglePlay);
  document.getElementById('btnStop').addEventListener('click', () => {
    state.sequencePlaying = false;
    state.fileQueue = [];
    state.fileQueueIndex = -1;
    state.multiFileMode = null;
    stopPlay();
    state.playIndex=0;
    state.stockQuality='normal';
    resetStockSimulation();
    updatePlaybackUI();
    drawCanvas();
  });

  els.scrub.addEventListener('input', (e) => {
    state.playIndex = parseInt(e.target.value);
    // Scrubbing usa a malha rápida para manter o arraste responsivo.
    state.stockQuality='preview';
    if(state.playIndex<=0) resetStockSimulation();
    updatePlaybackUI();
    drawCanvas();
  });

  els.scrub.addEventListener('change', () => {
    if(!state.playing) refineStockAfterPlayback();
  });

  let historyTimer=null, parseInputTimer=null;
  codeEl.addEventListener('input', () => {
    renderHighlight();
    clearTimeout(parseInputTimer); parseInputTimer=setTimeout(runParse,90);
    clearTimeout(historyTimer); historyTimer=setTimeout(pushHistory,250);
    clearTimeout(state.autosaveTimer);state.autosaveTimer=setTimeout(()=>localStorage.setItem('gcsAutosave',JSON.stringify({name:state.currentFileName,code:codeEl.value,time:Date.now()})),500);
  });
  editorScrollEl.addEventListener('scroll', () => { gutterEl.scrollTop = editorScrollEl.scrollTop; });

  // Init
  // O backend gráfico já foi detectado na inicialização do renderer acima.
  updateGraphicsStatus();
  const saved=JSON.parse(localStorage.getItem('gcsAutosave')||'null');
  codeEl.value = saved?.code || SAMPLE_GCODE;
  if(saved?.name){state.currentFileName=saved.name;document.getElementById('filename').textContent=saved.name;}
  pushHistory();
  renderHighlight(); runParse(); updateRotationReadout(); setTimeout(fitView, 60);
// fechamento do escopo movido para o fim após os módulos PRO/Productivity


/* ===== PRODUCTIVITY SUITE ENGINE ===== */
function prodReadJson(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}}
function prodEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch])}
const prod={workspace:localStorage.getItem('gcs_workspace')||'cnc',singleBlock:false,feedOverride:100,spindleOverride:100,snaps:prodReadJson('gcs_snaps',{"end":true,"mid":true,"center":true,"intersection":false,"perp":false,"tangent":false,"angle":90}),history:[],recent:prodReadJson('gcs_recent',[])};
function prodHist(msg){prod.history.unshift({t:new Date().toLocaleTimeString(),msg});prod.history=prod.history.slice(0,30);renderProdHistory()}
function renderProdHistory(){const e=document.getElementById('actionHistory');if(!e)return;e.innerHTML=prod.history.map(x=>`<div class="prod-item"><span>${prodEscape(x.t)}</span><span class="grow">${prodEscape(x.msg)}</span></div>`).join('')||'<div class="prod-small">Sem ações nesta sessão.</div>'}
const prodDialog=document.getElementById('prodDialog');document.getElementById('btnProductivity').onclick=()=>{prodRefresh();prodDialog.showModal()};document.getElementById('prodClose').onclick=()=>prodDialog.close();
document.querySelectorAll('.prod-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.prod-tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.prod-page').forEach(x=>x.classList.toggle('active',x.dataset.pgpage===b.dataset.pg));if(b.dataset.pg==='ops')renderQueue();if(b.dataset.pg==='storage')renderRecent();});
function applyWorkspace(ws){prod.workspace=ws;localStorage.setItem('gcs_workspace',ws);wsSelect.value=ws;pws.value=ws;const ep=document.querySelector('.editor-pane'),vp=document.querySelector('.view-pane'),chart=document.getElementById('xyzChartWrap');if(ws==='cnc'){ep.style.display='flex';vp.style.display='flex'}else if(ws==='print'){ep.style.display='none';vp.style.display='flex';document.getElementById('chkShowXYZChart').checked=true;chart.style.display='flex'}else if(ws==='cad'){document.getElementById('btnCad2D')?.click()}else if(ws==='inspect'){ep.style.display='none';vp.style.display='flex';document.getElementById('btnMeasure')?.click()}prodHist('Workspace '+ws)}
wsSelect.onchange=()=>applyWorkspace(wsSelect.value);pwsApply.onclick=()=>applyWorkspace(pws.value);
btnSingleBlock.onclick=()=>{prod.singleBlock=!prod.singleBlock;btnSingleBlock.classList.toggle('primary',prod.singleBlock);btnSingleBlock.textContent=prod.singleBlock?'Single Block ON':'Single Block';prodHist('Single Block '+(prod.singleBlock?'ativado':'desativado'))};
feedOverride.oninput=()=>{prod.feedOverride=+feedOverride.value;feedOverrideVal.textContent=prod.feedOverride+'%'};spindleOverride.oninput=()=>{prod.spindleOverride=+spindleOverride.value;spindleOverrideVal.textContent=prod.spindleOverride+'%'};
document.getElementById('btnStepNext').addEventListener('click',()=>{if(prod.singleBlock){state.isPlaying=false;updatePlayBtn()}});
calcFeedBtn.onclick=()=>{let f=(+calcFlutes.value||1)*(+calcRpm.value||0)*(+calcChip.value||0);calcFeedOut.textContent=f.toFixed(0)+' mm/min';calcFeed.value=f.toFixed(0)};
calcChipBtn.onclick=()=>{let c=(+calcFeed.value||0)/Math.max(1,(+calcFlutes.value||1)*(+calcRpm.value||1));calcChipOut.textContent=c.toFixed(4)+' mm/dente';calcChip.value=c.toFixed(4)};
calcPowerBtn.onclick=()=>{let p=(+calcMrr.value||0)*(+calcMat.value||1)*12;calcPowerOut.textContent=p.toFixed(0)+' W aprox.'};
function setupHtml(){const t=Object.values(state.toolLibrary||{}),o=camQueue;return `<!doctype html><meta charset="utf-8"><title>Setup Sheet</title><style>body{font:14px Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px}</style><h1>${prodEscape(setupJob.value||'Projeto CNC')}</h1><p>Operador: ${prodEscape(setupOperator.value||'—')}</p><p>Arquivo: ${prodEscape(state.currentFileName||'—')} · Tempo estimado: ${prodEscape(fmtTime(state.totalTime||0))}</p><h2>Ferramentas</h2><table><tr><th>ID</th><th>Nome</th><th>Ø</th><th>Tipo</th></tr>${t.map(x=>`<tr><td>T${prodEscape(x.number)}</td><td>${prodEscape(x.name)}</td><td>${prodEscape(x.diameter)}</td><td>${prodEscape(x.type)}</td></tr>`).join('')}</table><h2>Operações CAM</h2><table><tr><th>#</th><th>Nome</th><th>Objetos</th><th>Tipo</th><th>Ferramenta</th><th>Z</th></tr>${o.map((x,i)=>`<tr><td>${i+1}</td><td>${prodEscape(x.name)}</td><td>${camOpEntityIds(x).length}</td><td>${prodEscape(x.fields?.cadOperation)}</td><td>T${prodEscape(x.fields?.cadToolNumber)}</td><td>${prodEscape(x.fields?.cadDepth)}</td></tr>`).join('')}</table>`}
setupPreview.onclick=()=>{setupOut.innerHTML=setupHtml().replace(/<style>[\s\S]*?<\/style>/,'').replace(/<!doctype html>|<meta[^>]+>|<title>.*?<\/title>/g,'')};
setupDownload.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([setupHtml()],{type:'text/html'}));a.download='setup_sheet.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
snapApply.onclick=()=>{document.querySelectorAll('.snapopt').forEach(x=>prod.snaps[x.value]=x.checked);prod.snaps.angle=+snapAngle.value;localStorage.setItem('gcs_snaps',JSON.stringify(prod.snaps));prodHist('Snaps atualizados')};
function renderQueue(){const box=queueList;if(!box)return;box.innerHTML=camQueue.map((o,i)=>`<div class="prod-item"><input type="checkbox" ${o.enabled===false?'':'checked'} data-qen="${i}"><span class="grow">${i+1}. ${prodEscape(o.name)} · ${camOpEntityIds(o).length} objeto(s) · ${prodEscape(o.fields?.cadOperation)} · T${prodEscape(o.fields?.cadToolNumber)}</span><button data-qup="${i}">↑</button><button data-qdn="${i}">↓</button></div>`).join('')||'<div class="prod-small">Sem operações CAM.</div>';box.querySelectorAll('[data-qen]').forEach(e=>e.onchange=()=>{camQueue[+e.dataset.qen].enabled=e.checked;cadCommitHistory();gcsAutosaveFull()});box.querySelectorAll('[data-qup]').forEach(b=>b.onclick=()=>{let i=+b.dataset.qup;if(i)[camQueue[i-1],camQueue[i]]=[camQueue[i],camQueue[i-1]];cadCommitHistory();gcsAutosaveFull();renderQueue()});box.querySelectorAll('[data-qdn]').forEach(b=>b.onclick=()=>{let i=+b.dataset.qdn;if(i<camQueue.length-1)[camQueue[i+1],camQueue[i]]=[camQueue[i],camQueue[i+1]];cadCommitHistory();gcsAutosaveFull();renderQueue()});queueTime.textContent=camQueue.map((o,i)=>`${i+1}. ${o.name}: ~${Math.max(1,Math.abs(+o.fields?.cadDepth||1))*2} min`).join(' · ')||'Sem operações CAM.'}
queueGroupTool.onclick=()=>{camQueue.sort((a,b)=>String(a.fields?.cadToolNumber).localeCompare(String(b.fields?.cadToolNumber)));cadCommitHistory();gcsAutosaveFull();renderQueue()};queueSmart.onclick=()=>{const rank={drill:0,pocket:1,inside:2,follow:3,outside:4};camQueue.sort((a,b)=>String(a.fields?.cadToolNumber).localeCompare(String(b.fields?.cadToolNumber))||(rank[a.fields?.cadOperation]??9)-(rank[b.fields?.cadOperation]??9));cadCommitHistory();gcsAutosaveFull();renderQueue()};queueToggleAll.onclick=()=>{let on=camQueue.some(o=>o.enabled===false);camQueue.forEach(o=>o.enabled=on);cadCommitHistory();gcsAutosaveFull();renderQueue()};
cmpRun.onclick=async()=>{const f=cmpFile.files[0];if(!f)return;const other=await f.text(),a=codeEl.value.split(/\r?\n/),b=other.split(/\r?\n/);let diff=0,max=Math.max(a.length,b.length);for(let i=0;i<max;i++)if((a[i]||'').trim()!==(b[i]||'').trim())diff++;cmpOut.textContent=`Atual: ${a.length} linhas · Comparado: ${b.length} linhas · Diferenças: ${diff} (${(100*diff/Math.max(1,max)).toFixed(1)}%)`};
let _fpsFrames=0,_fpsLast=performance.now(),_fps=0;function prodFpsLoop(t){_fpsFrames++;if(t-_fpsLast>1000){_fps=_fpsFrames*1000/(t-_fpsLast);_fpsFrames=0;_fpsLast=t;benchFps.textContent=_fps.toFixed(0);benchMoves.textContent=(state.segments||[]).length.toLocaleString();if(performance.memory)benchMem.textContent=(performance.memory.usedJSHeapSize/1048576).toFixed(0)+' MB';benchMeter.style.width=Math.min(100,_fps/60*100)+'%'}requestAnimationFrame(prodFpsLoop)}requestAnimationFrame(prodFpsLoop);
benchRun.onclick=()=>{let t=performance.now(),sum=0;for(let i=0;i<500000;i++)sum+=Math.sin(i*.001);let dt=performance.now()-t;benchOut.textContent=`CPU JS: ${dt.toFixed(1)} ms · WebGL2: ${!!window.WebGL2RenderingContext} · movimentos: ${(state.segments||[]).length}`};
benchWorker.onclick=()=>{try{const blob=new Blob([`onmessage=e=>{let s=0;for(let i=0;i<2e6;i++)s+=Math.sqrt(i);postMessage(s)}`],{type:'text/javascript'}),w=new Worker(URL.createObjectURL(blob)),t=performance.now();w.onmessage=()=>{benchOut.textContent=`Web Worker OK: ${(performance.now()-t).toFixed(1)} ms`;perfChip.textContent='Parser: worker ready';w.terminate()};w.postMessage(1)}catch(e){benchOut.textContent='Worker indisponível: '+e.message}};
function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open('gcs_v10',1);r.onupgradeneeded=()=>r.result.createObjectStore('snap');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
dbSave.onclick=async()=>{try{let db=await openDb(),tx=db.transaction('snap','readwrite');tx.objectStore('snap').put({code:codeEl.value,camQueue,cad:cad.entities,time:Date.now()},'last');tx.oncomplete=()=>{dbOut.textContent='Snapshot salvo no IndexedDB.';dbChip.textContent='Storage: IndexedDB';prodHist('Snapshot IndexedDB salvo')}}catch(e){dbOut.textContent='Erro IndexedDB: '+e.message}};
dbLoad.onclick=async()=>{try{let db=await openDb(),tx=db.transaction('snap','readonly'),r=tx.objectStore('snap').get('last');r.onsuccess=()=>{if(!r.result)return;codeEl.value=r.result.code||'';camQueue=camNormalizeQueue(r.result.camQueue);if(r.result.cad)cad.entities=r.result.cad;cadSetSelection([]);cadCommitHistory();renderHighlight();runParse();cadRender();camQueueRender();dbOut.textContent='Snapshot recuperado.';prodHist('Snapshot IndexedDB recuperado')}}catch(e){dbOut.textContent='Erro IndexedDB: '+e.message}};
function renderRecent(){recentList.innerHTML=prod.recent.map(x=>`<div class="prod-item"><span class="grow">${prodEscape(x.name)}</span><span>${prodEscape(new Date(x.t).toLocaleString())}</span></div>`).join('')||'<div class="prod-small">Sem recentes.</div>'}
function addRecent(name){prod.recent=[{name,t:Date.now()},...prod.recent.filter(x=>x.name!==name)].slice(0,10);localStorage.setItem('gcs_recent',JSON.stringify(prod.recent))}
function prodRefresh(){pws.value=prod.workspace;wsSelect.value=prod.workspace;document.querySelectorAll('.snapopt').forEach(x=>x.checked=!!prod.snaps[x.value]);snapAngle.value=prod.snaps.angle||90;renderProdHistory();renderQueue();renderRecent()}
const _oldSaveBtn=document.getElementById('btnSave');_oldSaveBtn?.addEventListener('click',()=>addRecent(state.currentFileName||'programa.tap'));

})();
