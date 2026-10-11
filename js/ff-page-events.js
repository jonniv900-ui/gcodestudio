/* FlowForge WebStudio - isolated page lifecycle events.
 * Deliberately does not modify the existing executor, component events or
 * navigation implementation. It only augments the generated runtime.
 */
(function(){
  'use strict';

  function ensurePages(){
    try {
      const pages = typeof window.ffEnsurePages === 'function' ? window.ffEnsurePages() : [];
      if (!Array.isArray(pages)) return [];
      pages.forEach(p=>{
        if(!p.events || typeof p.events !== 'object') p.events={};
        if(typeof p.events.onload !== 'string') p.events.onload=String(p.events.onload||'');
        if(typeof p.events.onshow !== 'string') p.events.onshow=String(p.events.onshow||'');
      });
      return pages;
    } catch(e) { console.error('[FlowForge page events] ensure',e); return []; }
  }

  function runtimeSource(pages){
    const handlers=(pages||[]).map(p=>{
      const e=p.events||{};
      return `${JSON.stringify(String(p.id))}:{onload:async function(event){\n${String(e.onload||'')}\n},onshow:async function(event){\n${String(e.onshow||'')}\n}}`;
    }).join(',\n');

    return `
/* FlowForge isolated page lifecycle runtime */
window.__FLOWFORGE_PAGE_HANDLERS={${handlers}};
window.__FLOWFORGE_PAGE_STATE__=window.__FLOWFORGE_PAGE_STATE__||{loaded:{}};
(function(){
  const state=window.__FLOWFORGE_PAGE_STATE__;
  function activeId(){
    const p=[...document.querySelectorAll('.ff-page')].find(x=>!x.hidden&&!x.classList.contains('hidden'));
    return p ? p.dataset.pageId : null;
  }
  async function run(id,type){
    id=String(id||'');
    const h=window.__FLOWFORGE_PAGE_HANDLERS && window.__FLOWFORGE_PAGE_HANDLERS[id];
    if(!h) return;
    const page=(window.__FLOWFORGE_PAGES__||[]).find(p=>String(p.id)===id)||{id:id};
    const target=document.querySelector('.ff-page[data-page-id="'+CSS.escape(id)+'"]');
    const event={type:type,pageId:id,page:page,target:target||null};
    try{
      if(type==='load'){
        if(state.loaded[id]) return;
        state.loaded[id]=true;
        await h.onload(event);
      }else{
        await h.onshow(event);
      }
    }catch(error){ console.error('[FlowForge page '+type+']',error); }
  }
  window.FFPageEvents={runLoad:id=>run(id,'load'),runShow:id=>run(id,'show')};

  const original=window.FlowForgeNavigate;
  if(typeof original==='function' && !original.__ffPageEventsWrapped){
    const wrapped=function(value){
      const before=activeId();
      const result=original.apply(this,arguments);
      if(result){
        const after=activeId();
        const id=after||String(value||'');
        if(String(id)!==String(before||'')) Promise.resolve().then(()=>run(id,'show'));
      }
      return result;
    };
    wrapped.__ffPageEventsWrapped=true;
    window.FlowForgeNavigate=wrapped;
    window.ffNavigate=wrapped;
  }

  function initial(){
    const id=activeId() || String((window.__FLOWFORGE_PAGES__||[])[0]?.id||'');
    if(!id) return;
    Promise.resolve().then(()=>run(id,'load')).then(()=>run(id,'show'));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initial,{once:true});
  else initial();
  window.addEventListener('hashchange',()=>{const id=activeId();if(id)run(id,'show');});
  window.addEventListener('popstate',()=>{const id=activeId();if(id)run(id,'show');});
})();
`;
  }

  // Patch the exported HTML generator only. The original editor/runtime code
  // remains untouched.
  function installGenerator(){
    if(typeof window.generated!=='function' || window.generated.__ffPageEvents) return false;
    const original=window.generated;
    const wrapped=function(){
      const pages=ensurePages();
      let html=original.apply(this,arguments);
      const src=runtimeSource(pages);
      const marker='</script>\\n</body>';
      if(html.includes(marker)) html=html.replace(marker,()=>src+marker);
      else if(html.includes('</script>\n</body>')) html=html.replace('</script>\n</body>',()=>src+'</script>\n</body>');
      else if(html.includes('</body>')) html=html.replace('</body>',()=>'<script>'+src.replace(/<\\\/script>/g,'<\\/script>')+'</script></body>');
      return html;
    };
    wrapped.__ffPageEvents=true;
    window.generated=wrapped;
    return true;
  }

  // UI is deliberately lightweight and independent of the component action editor.
  function installPagePanel(){
    const empty=document.querySelector('#actionEmpty');
    const picker=document.querySelector('#projectPageTop');
    if(!empty || !picker) return;
    if(!document.querySelector('#ffPageEventsPanel')){
      const panel=document.createElement('div');
      panel.id='ffPageEventsPanel';
      panel.className='ff-page-event-panel';
      panel.innerHTML='<h3>Eventos da Página</h3><small class="hint">OnLoad executa uma vez ao abrir a página. OnShow executa sempre que ela é exibida.</small><label>OnLoad<textarea id="ffPageOnLoad" rows="7"></textarea></label><label>OnShow<textarea id="ffPageOnShow" rows="7"></textarea></label><button id="ffPageEventsApply" class="wide" type="button">✓ Aplicar eventos da página</button>';
      empty.parentNode.insertBefore(panel,empty.nextSibling);
      const sync=()=>{
        const pages=ensurePages();
        const p=pages.find(x=>String(x.id)===String(picker.value))||pages[0];
        if(!p)return;
        document.querySelector('#ffPageOnLoad').value=p.events.onload||'';
        document.querySelector('#ffPageOnShow').value=p.events.onshow||'';
      };
      picker.addEventListener('change',sync);
      document.querySelector('#ffPageEventsApply').addEventListener('click',()=>{
        const pages=ensurePages(),p=pages.find(x=>String(x.id)===String(picker.value))||pages[0];
        if(!p)return;
        p.events.onload=document.querySelector('#ffPageOnLoad').value;
        p.events.onshow=document.querySelector('#ffPageOnShow').value;
        if(typeof window.updateCode==='function') window.updateCode();
      });
      sync();
    }
  }

  function boot(){
    installGenerator();
    installPagePanel();
  }
  addEventListener('DOMContentLoaded',boot,{once:true});
  setTimeout(boot,0);
  setTimeout(boot,100);
})();
