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


