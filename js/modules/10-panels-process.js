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


