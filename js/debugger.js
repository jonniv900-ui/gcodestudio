// FlowForge WebStudio v0.13.0 — Integrated Debugger
(function(){
 const $=s=>document.querySelector(s), state={logs:[],errors:[],events:[],paused:false};
 function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
 function row(kind,args){return `<div class="dbgRow dbg-${kind}"><small>${new Date().toLocaleTimeString()}</small><span>${args.map(x=>esc(typeof x==='object'?JSON.stringify(x):x)).join(' ')}</span></div>`}
 function render(){
  $('#dbgConsole').innerHTML=state.logs.map(x=>row(x.kind,x.args)).join('')||'<em>Sem mensagens.</em>';
  $('#dbgErrors').innerHTML=state.errors.map(x=>row('error',x.args)).join('')||'<em>Sem erros.</em>';
  $('#dbgEvents').innerHTML=state.events.map(x=>row('event',x.args)).join('')||'<em>Nenhum evento disparado.</em>';
  $('#dbgErrorCount').textContent=state.errors.length;$('#dbgState').textContent=state.paused?'Pausado':'Executando';
 }
 function inspect(){
  const w=$('#preview')?.contentWindow;if(!w)return;
  try{
   const vars={};Object.keys(w).filter(k=>/^ff|contador|score|nome|ativo/i.test(k)).slice(0,100).forEach(k=>{try{let v=w[k];if(['string','number','boolean'].includes(typeof v))vars[k]=v}catch(_){}});
   $('#dbgVars').innerHTML=Object.entries(vars).map(([k,v])=>`<div class="dbgKV"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')||'<em>Nenhuma variável pública detectada.</em>';
   const comps=[...w.document.querySelectorAll('.ff-component')].map(el=>{let c=el.querySelector('[data-ff-control],input,button,textarea,select,img,video')||el;return {name:c.id||el.id||el.dataset.flowId||'(sem nome)',value:'value'in c?c.value:(c.textContent||'').trim().slice(0,100),visible:getComputedStyle(el).display!=='none'}});
   $('#dbgComponents').innerHTML=comps.map(c=>`<div class="dbgKV"><b>${esc(c.name)}</b><span>${esc(c.value)} ${c.visible?'':'(oculto)'}</span></div>`).join('')||'<em>Sem componentes.</em>';
  }catch(e){state.errors.push({args:['Falha ao inspecionar:',e.message]});render()}
 }
 function inject(){
  const f=$('#preview'),w=f?.contentWindow;if(!w)return;
  try{
   if(w.__ffDebuggerInstalled)return;w.__ffDebuggerInstalled=true;
   ['log','info','warn','error'].forEach(k=>{const orig=w.console[k].bind(w.console);w.console[k]=(...a)=>{orig(...a);parent.postMessage({__ffdbg:1,type:'console',kind:k,args:a.map(safe)},'*')}});
   w.addEventListener('error',e=>parent.postMessage({__ffdbg:1,type:'error',args:[e.message,`${e.filename||''}:${e.lineno||0}:${e.colno||0}`]},'*'));
   w.addEventListener('unhandledrejection',e=>parent.postMessage({__ffdbg:1,type:'error',args:['Promise rejeitada',safe(e.reason)]},'*'));
   w.document.addEventListener('click',e=>trace('click',e),true);w.document.addEventListener('input',e=>trace('input',e),true);w.document.addEventListener('change',e=>trace('change',e),true);
   function trace(type,e){let el=e.target.closest?.('[id],.ff-component');parent.postMessage({__ffdbg:1,type:'event',args:[type,el?.id||el?.dataset?.flowId||el?.tagName||'']},'*')}
   function safe(v){try{return typeof v==='object'?JSON.parse(JSON.stringify(v)):String(v)}catch(_){return String(v)}}
   w.console.info('[FlowForge Debugger] conectado');
  }catch(e){state.errors.push({args:['Falha ao conectar debugger:',e.message]});render()}
 }
 addEventListener('message',e=>{let d=e.data;if(!d?.__ffdbg)return;if(state.paused&&d.type!=='error')return;if(d.type==='console')state.logs.push({kind:d.kind,args:d.args});else if(d.type==='error')state.errors.push({args:d.args});else if(d.type==='event')state.events.push({args:d.args});if(state.logs.length>500)state.logs.shift();if(state.events.length>500)state.events.shift();render()});
 addEventListener('DOMContentLoaded',()=>{
  $('#debugBtn').onclick=()=>{document.querySelector('[data-tab="preview"]').click();$('#debuggerPanel').hidden=false;$('#preview').srcdoc=window.FlowForgeImageAssets?.resolveHtml?.(window.generated())??window.generated();$('#dbgState').textContent='Iniciando...'};
  $('#preview').addEventListener('load',()=>{if(!$('#debuggerPanel').hidden){inject();inspect();render()}});
  $('#dbgClose').onclick=()=>$('#debuggerPanel').hidden=true;$('#dbgClear').onclick=()=>{state.logs=[];state.errors=[];state.events=[];render()};
  $('#dbgRefresh').onclick=inspect;$('#dbgPause').onclick=()=>{state.paused=true;render()};$('#dbgResume').onclick=()=>{state.paused=false;render()};
  document.querySelectorAll('[data-dbg-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-dbg-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.dbgView').forEach(x=>x.hidden=true);$('#dbg'+b.dataset.dbgTab[0].toUpperCase()+b.dataset.dbgTab.slice(1)).hidden=false;if(['vars','components'].includes(b.dataset.dbgTab))inspect()});
 });
 window.FlowForgeDebugger={state,inspect,render};
})();