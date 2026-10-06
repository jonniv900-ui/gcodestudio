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
  let cadRenderRaf=0;
  function cadRenderScheduled(){
    if(cadRenderRaf)return;
    cadRenderRaf=requestAnimationFrame(()=>{cadRenderRaf=0;cadRender()});
  }
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
  cadSvg.addEventListener('pointermove',ev=>{let raw=cadScreen(ev);document.getElementById('cadStatus').textContent=`X ${raw.x.toFixed(3)} · Y ${raw.y.toFixed(3)} mm`;if(cad.pan){cad.panX=cad.pan.px+ev.clientX-cad.pan.x;cad.panY=cad.pan.py+ev.clientY-cad.pan.y;cadView();return}let p=cadSnapP(raw,cad.drawing?.start||cad.drawing?.points?.at(-1));if(cad.drag){const dx=p.x-cad.drag.last.x,dy=p.y-cad.drag.last.y;cad.entities.filter(x=>cad.drag.ids.includes(x.id)).forEach(e=>cadMove(e,dx,dy));cad.drag.last=p;cadRenderScheduled();return}if(cad.marquee){cad.marquee.end=raw;cadRenderScheduled();return}if(cad.drawing){cad.drawing.end=p;cadRenderScheduled()}});
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


