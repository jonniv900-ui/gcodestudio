  // ============================================================
  // PROJETO GCS + AUTOSAVE COMPLETO
  // ============================================================
  const GCS_CAM_FIELDS=['cadOperation','cadToolDiameter','cadToolNumber','cadAllowance','cadFinishPass','cadStepover','cadSafeZ','cadDepth','cadStepDown','cadFeed','cadPlunge','cadSpindle','cadOptimize','cadRetractEach','cadEntry','cadLeadIn','cadLeadLen','cadTabsCount','cadTabWidth','cadTabHeight','cadPeck','cadSpindleDelay'];
  function gcsProjectObject(){const cam={};GCS_CAM_FIELDS.forEach(id=>cam[id]=document.getElementById(id)?.value);return{format:'GCODE_STUDIO_PROJECT',version:4,savedAt:new Date().toISOString(),name:state.currentFileName,code:codeEl.value,cad:{entities:cad.entities,nextId:cad.nextId,grid:cad.grid},cam,camQueue,machineProfile:document.getElementById('cadMachineProfile').value,config:{stock:config.stock,limits:config.limits,safeZ:config.safeZ,rapidRate:config.rapidRate,workOffsets:config.workOffsets},view:{plane:state.viewPlane,azimuth:state.isoAzimuth,elevation:state.isoElevation,projection:state.projectionMode}}}
  function gcsApplyProject(p){if(!p||p.format!=='GCODE_STUDIO_PROJECT')throw new Error('Projeto GCS inválido');codeEl.value=p.code||'';state.currentFileName=p.name||'projeto.tap';filename.textContent=state.currentFileName;if(p.cad){cad.entities=Array.isArray(p.cad.entities)?p.cad.entities:[];cad.nextId=p.cad.nextId||cad.entities.length+1;cad.grid=p.cad.grid||10}cadSetSelection([]);if(p.cam)GCS_CAM_FIELDS.forEach(id=>{if(p.cam[id]!=null&&document.getElementById(id))document.getElementById(id).value=p.cam[id]});camQueue=camNormalizeQueue(p.camQueue);if(p.machineProfile&&window.GCS_CAM_PROFILES?.[p.machineProfile])document.getElementById('cadMachineProfile').value=p.machineProfile;if(p.config){if(p.config.stock)Object.assign(config.stock,p.config.stock);if(p.config.limits)Object.assign(config.limits,p.config.limits);if(p.config.safeZ!=null)config.safeZ=p.config.safeZ;if(p.config.rapidRate)config.rapidRate=p.config.rapidRate;if(p.config.workOffsets)config.workOffsets=p.config.workOffsets}if(p.view){state.isoAzimuth=p.view.azimuth??state.isoAzimuth;state.isoElevation=p.view.elevation??state.isoElevation;state.projectionMode=p.view.projection||state.projectionMode}cadCommitHistory();renderHighlight();runParse();cadRender();camQueueRender();cadFit();fitView();cadUpdateCamSummary()}
  function gcsAutosaveFull(){try{localStorage.setItem('gcsProjectAutosaveV1',JSON.stringify(gcsProjectObject()))}catch(e){console.warn('Autosave projeto:',e)}}
  let gcsAutosaveTimer=null;
  function gcsScheduleAutosave(){
    if(document.hidden)return;
    clearTimeout(gcsAutosaveTimer);
    gcsAutosaveTimer=setTimeout(gcsAutosaveFull,1200);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)gcsScheduleAutosave()});
  gcsScheduleAutosave();
  document.getElementById('cadSaveProject').addEventListener('click',()=>cadDownload('projeto.gcs',JSON.stringify(gcsProjectObject(),null,2),'application/json'));
  document.getElementById('cadOpenProject').addEventListener('click',()=>document.getElementById('cadProjectInput').click());
  document.getElementById('cadProjectInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{gcsApplyProject(JSON.parse(await f.text()))}catch(err){alert('Não foi possível abrir o projeto: '+err.message)}e.target.value=''});
  document.getElementById('cadRecoverProject').addEventListener('click',()=>{try{const p=JSON.parse(localStorage.getItem('gcsProjectAutosaveV1')||'null');if(!p)return alert('Nenhum autosave disponível.');gcsApplyProject(p)}catch(e){alert('Autosave inválido.')}});





