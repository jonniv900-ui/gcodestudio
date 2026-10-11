const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TOOL_GROUPS={
'Básicos':[['label','T','Label'],['heading','H','Heading'],['button','▣','Button'],['link','↗','Link'],['image','▧','Image'],['picturebox','▧','PictureBox'],['icon','★','Icon'],['divider','—','Divider'],['spacer','↕','Spacer'],['panel','▣','Panel'],['groupbox','▤','GroupBox'],['flexpanel','↔','FlexPanel'],['gridpanel','▦','GridPanel'],['stackpanel','☷','StackPanel'],['scrollpanel','↕','ScrollPanel']],
'Formulários':[['input','▭','TextBox'],['textarea','▤','TextArea'],['checkbox','☑','CheckBox'],['radio','◉','Radio'],['switch','◐','Switch'],['select','⌄','Select'],['combobox','▾','ComboBox'],['listbox','☷','ListBox'],['range','━','Slider'],['date','▦','Date'],['time','◷','Time'],['file','⇧','File Upload'],['form','≡','Form']],
'Layout':[['container','□','Container'],['section','▥','Section'],['card','▱','Card'],['row','↔','Row/Flex'],['columns','▥','Columns/Grid'],['hero','◆','Hero']],
'Navegação':[['header','▰','Header'],['navbar','☰','Barra de navegação'],['footer','▔','Footer'],['bottomnav','⌑','Bottom Nav'],['tabs','▤','Tabs'],['tabcontrol','▤','TabControl'],['drawer','☰','Drawer'],['bottomsheet','▔','Bottom Sheet'],['sidebar','☰','Sidebar'],['toolbar','━','Toolbar'],['breadcrumb','›','Breadcrumb'],['pagination','•••','Pagination'],['pagenav','▣','Page Navigation'],['fab','＋','FAB']],
'Dados':[['list','☷','List'],['table','▦','Table'],['datagrid','▦','DataGrid'],['chart','▥','Chart'],['calendar','▦','Calendar'],['listview','☷','ListView'],['treeview','⌘','TreeView'],['statcard','▣','Stat Card'],['rating','★','Rating'],['timeline','↕','Timeline'],['stepper','●','Stepper'],['badge','●','Badge'],['progress','▬','ProgressBar'],['spinner','◌','Spinner'],['accordion','≣','Accordion']],
'Feedback':[['alert','!','Alert'],['modalbox','▣','Modal'],['toast','▰','Toast']],
'Mídia / Web':[['video','▶','Video'],['audio','♫','Audio'],['camera','◉','Camera'],['fileupload','↥','File Upload'],['colorpicker','◉','Color Picker'],['avatar','●','Avatar'],['modal','□','Modal'],['toast','▱','Toast'],['tooltip','?','Tooltip'],['carousel','▧','Carousel'],['iframe','◎','iFrame/Web'],['canvas','◇','Canvas'],['map','⌖','Map'],['qrcode','▦','QR Code']],
'GAMES':[['gamecanvas','▣','Game Canvas'],['sprite','◆','Sprite'],['spritesheet','▦','Sprite Sheet'],['collisionarea','▢','Collision Area'],['keyboardinput','⌨','Keyboard Input'],['gamepadinput','🎮','Gamepad Input'],['gametimer','◷','Game Timer'],['scorelabel','★','Score Label'],['healthbar','♥','Health Bar'],['joystick','⊕','Virtual Joystick']],
'Não Visuais':[['timer','◷','Timer'],['http','⇄','HTTP / API'],['websocket','⌁','WebSocket'],['storage','▤','LocalStorage'],['geolocation','⌖','Geolocation'],['notification','◉','Notification'],['clipboard','▣','Clipboard'],['network','⌁','Network Status'],['vibration','〰','Vibration']],
'FlowForge Components':[['battery','▰','Battery Indicator'],['thermometer','♨','Thermometer Gauge'],['led','●','LED Indicator'],['sevenseg','88','7 Segment'],['dotmatrix','⠿','Dot Matrix'],['sparkline','⌁','Sparkline'],['valuecard','▣','Value Card'],['statuscard','◉','Status Card'],['glasspanel','◇','Glass Panel'],['gradientbutton','▰','Gradient Button'],['iconbutton','★','Icon Button'],['mobilelist','☷','Mobile List']]
};
let project,selected=null,undoStack=[],future=[];const uid=()=>globalThis.crypto?.randomUUID?.()||('ff-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
const FF_NAME_RE=/^[A-Za-z_$][\w$]*$/;
function sanitizeName(value,fallback='component'){let s=String(value??'').trim().replace(/[^A-Za-z0-9_$]+/g,'_').replace(/^[^A-Za-z_$]+/,'');return s||fallback}
function uniqueName(kind='component',base){let items=ffItems?.()||project?.pages?.[project?.active||0]?.items||[],root=sanitizeName(base||kind,kind||'component');if(!items.some(x=>x.name===root))return root;let i=2;while(items.some(x=>x.name===root+'_'+i))i++;return root+'_'+i}
function ensureProjectNames(p){const all=(p?.pages||[]).flatMap(page=>page.items||[]),used=new Set();all.forEach(x=>{let base=sanitizeName(x.name,x.kind||'component'),name=base,i=2;while(used.has(name)){name=base+'_'+i++;}x.name=name;used.add(name);});}
window.sanitizeName=sanitizeName;window.uniqueName=uniqueName;window.FF_NAME_RE=FF_NAME_RE;
function fresh(type='app'){const page={id:uid(),name:type==='landing'?'Landing':'Home',items:[]};const p={version:'0.13.0',name:'Meu Projeto',projectVersion:'1.0.0',icon:'',favicon:'',headerLogo:'',themeColor:'#20242a',type,framework:'none',designerMode:'framework',titlebar:{name:'titlebar1',text:'FlowForge webstudio 0.6 Beta',height:'52px',bg:'#20242a',color:'#ffffff',showMenu:true,autoStyle:true},pages:[page],active:0,activePage:page.id}; if(type!=='app') ensureSiteChrome(p); return p;}
function ensureSiteChrome(p){
 if(!p||!Array.isArray(p.pages))return;
 const isSite=p.type==='site'||p.type==='landing';
 const layout=p.siteLayout||{};
 const nav=layout.navigation||((isSite)?'navbar':'none');
 p.pages.forEach((page)=>{
   page.items??=[];
   const hasAuto=k=>page.items.some(x=>x.ffSystem==='siteChrome'&&x.kind===k);
   const hasManual=k=>page.items.some(x=>x.ffSystem!=='siteChrome'&&x.kind===k);
   // A project WITHOUT a wizard layout (hand-made or older, e.g. the layout examples) whose page already has its own
   // header/footer manages its own layout: no automatic chrome there (it would overlap the page's own blocks).
   const selfManaged=!p.siteLayout&&(hasManual('header')||hasManual('footer'));
   // Remove only the automatic chrome when the project type/layout no longer uses it (or the page manages itself).
   page.items=page.items.filter(x=>{
     if(x.ffSystem!=='siteChrome')return true;
     if(selfManaged)return false;
     if(x.kind==='header')return isSite && layout.header!==false;
     if(x.kind==='footer')return isSite && layout.footer!==false;
     if(['navbar','bottomnav','tabs','tabcontrol','drawer','sidebar','toolbar','breadcrumb','pagination','pagenav'].includes(x.kind))return nav===x.kind;
     return true;
   });
   const auto={visible:true,enabled:true,ffSystem:'siteChrome',frameworkStyle:layout.frameworkStyle!==false,events:{}};
   if(isSite && layout.header!==false && !selfManaged && !hasManual('header') && !hasAuto('header'))page.items.unshift({id:uid(),kind:'header',name:'siteHeader',text:p.name||'Minha Marca',x:0,y:0,width:'100%',height:'72px',bg:'#111827',color:'#ffffff',...auto});
   if(nav!=='none' && !selfManaged && !hasManual(nav) && !hasAuto(nav)){
     const y=isSite?72:52, h=(nav==='bottomnav'||nav==='toolbar')?60:52;
     page.items.splice(Math.min(1,page.items.length),0,{id:uid(),kind:nav,name:'siteNavigation',text:'Navegação',x:0,y,width:'100%',height:h+'px',bg:'#1f2937',color:'#ffffff',...auto});
   }
   if(isSite && layout.footer!==false && !selfManaged && !hasManual('footer') && !hasAuto('footer'))page.items.push({id:uid(),kind:'footer',name:'siteFooter',text:'',x:0,y:900,width:'100%',height:'90px',bg:'#111827',color:'#ffffff',...auto});
 });
}
function snapshot(){undoStack.push(JSON.stringify(project));if(undoStack.length>80)undoStack.shift();future=[]}
const META={header:['Minha Marca',1200,72],pagenav:['Navegação de páginas',260,44],combobox:['Selecione',200,44],listbox:['Item 1\nItem 2\nItem 3',220,120],label:['Texto',120,40],heading:['Título',220,52],button:['Botão',120,44],link:['Link',100,36],image:['Imagem',180,120],picturebox:['PictureBox',220,160],icon:['★',64,64],divider:['',240,16],spacer:['',120,48],input:['Digite aqui',180,44],textarea:['Texto',220,90],checkbox:['Opção',150,40],radio:['Opção',150,40],switch:['Ativar',150,40],select:['Selecione',180,44],range:['',180,40],date:['',180,44],time:['',180,44],file:['',220,44],form:['Formulário',280,180],container:['Container',260,180],section:['Seção',320,180],card:['Card',240,140],row:['Row / Flex',300,100],columns:['Columns / Grid',320,140],hero:['Seu grande título',340,150],navbar:['Minha Marca',360,56],bottomnav:['Home   Buscar   Perfil',360,60],tabs:['Aba 1   Aba 2   Aba 3',300,48],tabcontrol:['Abas',340,190],drawer:['Menu',250,300],bottomsheet:['Bottom Sheet',340,160],sidebar:['Sidebar',240,300],toolbar:['Toolbar',360,50],footer:['Rodapé',400,70],breadcrumb:['Home / Página',260,40],pagination:['‹  1  2  3  ›',220,44],fab:['+',58,58],list:['Item 1',240,120],table:['Tabela',300,130],datagrid:['DataGrid',360,180],chart:['Gráfico',320,180],calendar:['Calendário',300,240],listview:['ListView',300,180],treeview:['TreeView',300,190],statcard:['Indicador',220,120],rating:['★★★★★',220,60],timeline:['Timeline',260,220],stepper:['Etapas',320,80],badge:['Novo',90,38],progress:['',240,32],spinner:['',60,60],accordion:['Clique para expandir',280,90],alert:['Mensagem de alerta',280,64],modalbox:['Título do modal',300,150],video:['Vídeo',300,170],audio:['Áudio',300,54],camera:['Câmera',300,190],fileupload:['Enviar arquivo',280,70],colorpicker:['Cor',160,60],avatar:['Avatar',100,100],modal:['Modal',340,220],toast:['Mensagem',280,70],tooltip:['Dica',180,60],carousel:['Carousel',340,200],timer:['Timer',1,1],http:['HTTP',1,1],websocket:['WebSocket',1,1],storage:['Storage',1,1],geolocation:['Geolocation',1,1],notification:['Notification',1,1],clipboard:['Clipboard',1,1],network:['Network',1,1],vibration:['Vibration',1,1],iframe:['Web / iFrame',300,180],canvas:['Canvas',300,180],map:['Mapa',300,180],qrcode:['QR',160,160],iframe:['Web / iFrame',300,180],canvas:['Canvas',300,180],map:['Mapa',300,180],battery:['78%',180,54],thermometer:['24 °C',90,180],led:['Online',120,42],sevenseg:['12:34',180,72],dotmatrix:['HELLO',220,70],sparkline:['Uso',220,90],valuecard:['1.234',220,110],statuscard:['Sistema OK',240,100],glasspanel:['Glass Panel',260,150],gradientbutton:['Continuar',180,48],iconbutton:['★',56,56],mobilelist:['Item principal',280,150]};
const DEFAULT_EVENT={header:'click',button:'click',link:'click',fab:'click',navbar:'click',bottomnav:'click',tabs:'click',tabcontrol:'click',drawer:'click',bottomsheet:'click',sidebar:'click',toolbar:'click',footer:'click',pagination:'click',pagenav:'change',accordion:'toggle',input:'input',textarea:'input',select:'change',combobox:'change',listbox:'change',checkbox:'change',radio:'change',switch:'change',range:'input',date:'change',time:'change',file:'change',fileupload:'change',form:'submit',image:'click',picturebox:'click',icon:'click',card:'click',list:'click',table:'click',datagrid:'click',chart:'click',calendar:'change',listview:'click',treeview:'click',statcard:'click',rating:'change',timeline:'click',stepper:'change',badge:'click',alert:'click',modalbox:'click',toast:'click',video:'play',audio:'play',camera:'click',colorpicker:'change',avatar:'click',modal:'click',tooltip:'click',carousel:'change',timer:'tick',http:'response',websocket:'message',storage:'change',geolocation:'change',notification:'click',clipboard:'change',network:'change',vibration:'start',iframe:'load',canvas:'click',map:'click',qrcode:'click',label:'click',heading:'click',container:'click',section:'click',row:'click',columns:'click',hero:'click',divider:'click',spacer:'click',battery:'click',thermometer:'click',led:'click',sevenseg:'click',dotmatrix:'click',sparkline:'click',valuecard:'click',statuscard:'click',glasspanel:'click',gradientbutton:'click',iconbutton:'click',mobilelist:'click'};
function defaultEvent(kind){return FlowForgeRegistry?.get(kind)?.event||DEFAULT_EVENT[kind]||'click'}
function toolDefaults(kind){
 let m=META[kind]||[kind,140,50],def=FlowForgeRegistry?.get(kind)?.defaults||{},n=project.pages[project.active].items.filter(i=>i.kind===kind).length+1,name=def.name||kind+n;
 if(project.pages[project.active].items.some(i=>i.name===name))name=kind+n;
 let w=def.width??m[1],h=def.height??m[2];
 return {id:uid(),kind,name,text:def.text??m[0],x:def.x??24,y:def.y??24,width:(typeof w==='number'?w+'px':w),height:(typeof h==='number'?h+'px':h),bg:def.bg??'#ffffff',color:def.color??'#222222',src:def.src??(['picturebox','audio','video'].includes(kind)?'':undefined),fit:def.fit??'contain',visible:def.visible!==false,enabled:def.enabled!==false,...def,name,width:(typeof w==='number'?w+'px':w),height:(typeof h==='number'?h+'px':h),...(kind==='listbox'||kind==='combobox'||kind==='select'?{items:Array.isArray(def.items)?def.items:['Item 1','Item 2','Item 3']}:{}) ,events:{[defaultEvent(kind)]:`// ${name}: ação padrão\n`}};
}
function ffRenderToolsI18n(){renderTools($('#toolSearch')?.value||'')}
function renderTools(filter=''){let box=$('#tools');box.innerHTML='';const TI=window.FlowForgeToolI18n;Object.entries(TOOL_GROUPS).forEach(([group,tools])=>{if(group==='Navegação'&&project?.type==='app')return;let matches=tools.filter(t=>{if(['header','navbar','footer'].includes(t[0]) && project?.type==='app')return false;return TI?TI.matches(filter,group,t[0],t[2]):(t[2]+' '+group).toLowerCase().includes(filter.toLowerCase())});if(!matches.length)return;let h=document.createElement('div');h.className='toolGroup';h.textContent=TI?TI.group(group):group;box.append(h);matches.forEach(([kind,icon,name])=>{const label=TI?TI.name(kind,name):name;let b=document.createElement('button');b.className='tool';b.dataset.kind=kind;b.title=label;b.innerHTML=`<span class="toolIcon">${icon}</span><span class="toolLabel"></span>`;b.lastElementChild.textContent=label;b.onclick=()=>addItem(kind);b.ondblclick=e=>{e.preventDefault();addItem(kind);};b.draggable=true;b.dataset.flowKind=kind;b.ondragstart=e=>{window.ffPaletteDragKind=kind;e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/plain',kind);try{e.dataTransfer.setData('application/x-flowforge-kind',kind)}catch(_){}};b.ondragend=()=>{window.ffPaletteDragKind=null};box.append(b)})})}
function renderTopPagePicker(){const sel=$('#projectPageTop');if(!sel)return;ffEnsurePages();sel.innerHTML=(project.pages||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');sel.value=project.activePage||project.pages?.[0]?.id||'';}
function renderPages(){$('#pages').innerHTML='';project.pages.forEach((p,i)=>{let d=document.createElement('div');d.className='pageItem '+(i===project.active?'active':'');let nm=document.createElement('span');nm.textContent=p.name;d.append(nm);d.onclick=()=>{project.active=i;project.activePage=p.id;selected=null;render()};let ren=document.createElement('button');ren.className='pageRenameBtn';ren.textContent='✎';ren.title='Renomear página';ren.onclick=e=>{e.stopPropagation();let n=prompt('Novo nome da página',p.name);if(n&&n.trim())ffRenamePage(p.id,n)};d.append(ren);if(project.pages.length>1){let del=document.createElement('button');del.className='pageDelBtn';del.textContent='×';del.title='Excluir página';del.onclick=e=>{e.stopPropagation();ffDeletePage(p.id)};d.append(del)}$('#pages').append(d)})}
function ffFrameworkChrome(kind){
 const fw=project.framework||'none';
 const map={
  none:{header:'ff-fw-none-header',footer:'ff-fw-none-footer'},
  bootstrap:{header:'navbar navbar-expand-lg bg-body-tertiary border-bottom',footer:'border-top bg-body-tertiary'},
  bulma:{header:'section py-4 has-background-light',footer:'footer py-5'},
  pico:{header:'container-fluid',footer:'container-fluid'},
  tailwind:{header:'border-b bg-slate-900 text-white',footer:'border-t bg-slate-900 text-white'},
  materialize:{header:'blue-grey darken-4 white-text',footer:'page-footer blue-grey darken-4'},
  foundation:{header:'top-bar',footer:'grid-x grid-padding-x align-middle'},
  uikit:{header:'uk-section uk-section-muted uk-padding-small',footer:'uk-section uk-section-secondary uk-padding-small'},
  semantic:{header:'ui secondary segment',footer:'ui inverted vertical segment'}
 };
 return map[fw]?.[kind]||map.none[kind];
}
function ffHeaderLogoSrc(){
 const v=String(project.headerLogo||'');
 if(v.startsWith('asset://')){const a=(project.assets||[]).find(x=>String(x.id)===v.slice(8));return String(a?.data||'');}
 return v;
}
function ffHeaderLogoMarkup(){
 const src=ffHeaderLogoSrc();
 return src?`<img class="ff-header-logo" src="${esc(src)}" alt="Logo" loading="eager">`:'';
}
function ffFrameworkChromeMarkup(kind,t){
 const fw=project.framework||'none', label=esc(t||project.name||'Minha Marca');
 if(kind==='header'){
  if(fw==='bootstrap')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="container-fluid"><a class="navbar-brand fw-semibold ff-header-brand" href="#">${ffHeaderLogoMarkup()}<span>${label}</span></a></div></header>`;
  if(fw==='bulma')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="container"><h1 class="title is-4 mb-0 ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></h1></div></header>`;
  if(fw==='pico')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><nav><ul><li class="ff-header-brand">${ffHeaderLogoMarkup()}<strong>${label}</strong></li></ul></nav></header>`;
  if(fw==='tailwind')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="mx-auto w-full max-w-7xl px-6 py-4"><div class="text-xl font-semibold ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></div></div></header>`;
  if(fw==='materialize')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="container"><span class="brand-logo ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></span></div></header>`;
  if(fw==='foundation')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="top-bar-left"><ul class="menu"><li class="menu-text ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></li></ul></div></header>`;
  if(fw==='uikit')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="uk-container"><h1 class="uk-heading-small uk-margin-remove ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></h1></div></header>`;
  if(fw==='semantic')return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="ui container"><div class="ui large header ff-header-brand">${ffHeaderLogoMarkup()}<span>${label}</span></div></div></header>`;
  return `<header class="ff-real-header ${ffFrameworkChrome('header')}"><div class="ff-header-brand">${ffHeaderLogoMarkup()}<strong>${label}</strong></div></header>`;
 }
 if(fw==='bootstrap')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="container-fluid"></div></footer>`;
 if(fw==='bulma')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="content has-text-centered"></div></footer>`;
 if(fw==='pico')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><small></small></footer>`;
 if(fw==='tailwind')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="mx-auto w-full max-w-7xl px-6 py-5 text-sm"></div></footer>`;
 if(fw==='materialize')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="container"></div></footer>`;
 if(fw==='foundation')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="cell auto"></div></footer>`;
 if(fw==='uikit')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="uk-container"></div></footer>`;
 if(fw==='semantic')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="ui container"></div></footer>`;
 return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"></footer>`;
}
function ffNavLabel(pg){return esc(String(pg?.name||'').replace(/_/g,' '));}
function ffRealContent(x,exportMode=false){
 const t=esc(x.text||'');
 const opts=Array.isArray(x.options)?x.options:['Item 1','Item 2','Item 3'];
 switch(x.kind){
  case'header': return ffFrameworkChromeMarkup('header',t);
  case'navbar': {const pages=project.pages||[];return `<nav class="ff-real-navbar" aria-label="Navegação principal">${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</nav>`;}
  case'bottomnav': {const pages=project.pages||[];return `<nav class="ff-real-bottomnav" aria-label="Navegação de páginas">${pages.map((pg,i)=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.bottomPage(this,'${esc(pg.id)}')"><span>${i===0?'⌂':i===1?'⌕':'•'}</span><small>${ffNavLabel(pg)}</small></button>`).join('')}</nav>`;}
  case'tabs': {const pages=project.pages||[];return `<div class="ff-real-tabs ff-page-tabs" data-value="0"><div class="ff-tab-buttons">${pages.map((pg,i)=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div></div>`;}
  case'tabcontrol': {const pages=project.pages||[];return `<div class="ff-real-tabs ff-page-tabs" data-value="0"><div class="ff-tab-buttons">${pages.map((pg,i)=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div></div>`;}
  case'drawer': {const pages=project.pages||[];return `<aside class="ff-real-drawer ff-real-drawer-collapsible"><button type="button" onclick="FlowForgeUI.toggleDrawer(this)">☰ ${t}</button><div class="ff-drawer-body">${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div></aside>`;}
  case'sidebar': {const pages=project.pages||[];return `<aside class="ff-real-sidebar" aria-label="Navegação de páginas"><div class="ff-sidebar-title">${t||'Navegação'}</div><nav class="ff-sidebar-nav">${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</nav></aside>`;}
  case'bottomsheet': {const pages=project.pages||[];return `<section class="ff-real-bottomsheet"><button type="button" onclick="FlowForgeUI.toggleSheet(this)">▲ ${t}</button><div class="ff-sheet-body" hidden>${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div></section>`;}
  case'toolbar': {const pages=project.pages||[];return `<div class="ff-real-toolbar" aria-label="Navegação de páginas">${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div>`;}
  case'footer': {const pages=project.pages||[];const links=pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('');const fw=project.framework||'none';if(fw==='bootstrap')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="container-fluid d-flex flex-wrap justify-content-end align-items-center gap-2"><div class="d-flex gap-2">${links}</div></div></footer>`;if(fw==='bulma')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="content has-text-centered"><div class="buttons is-centered">${links}</div></div></footer>`;if(fw==='pico')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><nav><ul><li><small></small></li></ul><ul>${links}</ul></nav></footer>`;if(fw==='tailwind')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-3 px-6 py-5 text-sm"><div class="flex flex-wrap gap-2">${links}</div></div></footer>`;if(fw==='materialize')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="container"><div class="right">${links}</div></div></footer>`;if(fw==='foundation')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="cell auto"></div><div class="cell shrink"><ul class="menu">${pages.map(pg=>`<li><button type="button" data-page-id="${esc(pg.id)}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button></li>`).join('')}</ul></div></footer>`;if(fw==='uikit')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="uk-container uk-flex uk-flex-between uk-flex-middle uk-flex-wrap"><div class="uk-flex uk-flex-wrap uk-grid-small" uk-grid>${links}</div></div></footer>`;if(fw==='semantic')return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}"><div class="ui container"><div class="ui secondary menu">${links}</div></div></footer>`;return `<footer class="ff-real-footer ${ffFrameworkChrome('footer')}" aria-label="Navegação de páginas">${links}</footer>`;}
  case'breadcrumb': {const pages=project.pages||[];return `<nav class="ff-real-breadcrumb" aria-label="Navegação de páginas">${pages.map((pg,i)=>`${i?' <span>›</span> ':''}<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</nav>`;}
  case'pagination': {const pages=project.pages||[];const active=project.activePage;return `<nav class="ff-real-pagination" aria-label="Navegação de páginas"><button type="button" aria-label="Página anterior" onclick="FlowForgeUI.page(this,-1)">‹</button>${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===active?'active':''}" aria-current="${pg.id===active?'page':'false'}" onclick="FlowForgeUI.page(this,0)">${ffNavLabel(pg)}</button>`).join('')}<button type="button" aria-label="Próxima página" onclick="FlowForgeUI.page(this,1)">›</button></nav>`;}
  case'pagenav': {const pages=project.pages||[];return `<select class="ff-page-nav" aria-label="Navegação de páginas" onchange="FlowForgeUI.goPage(this,this.value)">${pages.map(pg=>`<option value="${esc(pg.id)}"${pg.id===project.activePage?' selected':''}>${ffNavLabel(pg)}</option>`).join('')}</select>`;}
  case'fab': {const pages=project.pages||[];return `<div class="ff-real-fabnav"><button type="button" class="ff-real-fab" aria-label="Abrir páginas" onclick="FlowForgeUI.toggleFab(this)">+</button><div class="ff-fab-menu" hidden>${pages.map(pg=>`<button type="button" data-page-id="${esc(pg.id)}" class="${pg.id===project.activePage?'active':''}" onclick="FlowForgeUI.goPage(this,'${esc(pg.id)}')">${ffNavLabel(pg)}</button>`).join('')}</div></div>`;}
  case'list':case'listview':case'mobilelist': return `<div class="ff-real-list">${opts.map((o,i)=>`<button type="button" data-index="${i}" onclick="FlowForgeUI.selectItem(this)"><b>${esc(o)}</b><small>${i===0?t:''}</small><span>›</span></button>`).join('')}</div>`;
  case'table':case'datagrid': return `<div class="ff-real-table-wrap"><table class="ff-real-table"><thead><tr><th>Nome</th><th>Status</th><th>Valor</th></tr></thead><tbody><tr><td>Item A</td><td>Ativo</td><td>120</td></tr><tr><td>Item B</td><td>Pendente</td><td>85</td></tr></tbody></table></div>`;
  case'chart': return `<canvas class="ff-real-chart" width="640" height="320" data-ff-chart="true"></canvas>`;
  case'calendar': return `<div class="ff-real-calendar"><input type="date" value="${esc(x.value||'')}" onchange="this.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{value:this.value}}))"><div class="ff-calendar-hint">Selecione uma data</div></div>`;
  case'treeview': return `<details class="ff-real-tree" open><summary>Projeto</summary><details><summary>Página inicial</summary><button>Conteúdo</button></details><details><summary>Assets</summary><button>Imagens</button></details><details><summary>Scripts</summary><button>JavaScript</button></details></details>`;
  case'statcard':case'valuecard':case'statuscard': return `<article class="ff-real-card"><small>${t}</small><strong>${esc(x.value??'1.284')}</strong><button type="button" onclick="this.dispatchEvent(new CustomEvent('action',{bubbles:true,detail:'card'}))">Detalhes</button></article>`;
  case'rating': return `<div class="ff-real-rating" role="radiogroup" aria-label="Avaliação">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" aria-checked="false" data-value="${n}" onclick="FlowForgeUI.rate(this,${n})">★</button>`).join('')}</div>`;
  case'timeline': return `<ol class="ff-real-timeline"><li><button type="button" onclick="FlowForgeUI.selectItem(this)">Início</button></li><li><button type="button" onclick="FlowForgeUI.selectItem(this)">Desenvolvimento</button></li><li><button type="button" onclick="FlowForgeUI.selectItem(this)">Publicação</button></li></ol>`;
  case'stepper': return `<div class="ff-real-stepper" data-step="1"><button type="button" onclick="FlowForgeUI.step(this,-1)">‹</button><b data-step-label>1</b><span>de 3</span><button type="button" onclick="FlowForgeUI.step(this,1)">›</button></div>`;
  case'accordion': return `<details class="ff-real-accordion"><summary>${t}</summary><div><p>Conteúdo do accordion.</p></div></details>`;
  case'modalbox':case'modal': return `<dialog class="ff-real-dialog"><form method="dialog"><h3>${t}</h3><p>Conteúdo da janela modal.</p><button value="close">Fechar</button></form></dialog>`;
  case'toast': return `<div class="ff-real-toast" role="status"><span>${t}</span><button type="button" onclick="this.parentElement.hidden=true">×</button></div>`;
  case'tooltip': return `<button type="button" class="ff-real-tooltip" title="${t}">${t}</button>`;
  case'carousel': return `<div class="ff-real-carousel" data-index="0"><button type="button" onclick="FlowForgeUI.carousel(this,-1)">‹</button><div class="ff-carousel-slides"><div>Slide 1</div><div hidden>Slide 2</div><div hidden>Slide 3</div></div><button type="button" onclick="FlowForgeUI.carousel(this,1)">›</button></div>`;
  case'fileupload': return `<label class="ff-real-upload">↥ ${t||'Selecionar arquivo'}<input type="file"${x.multiple?' multiple':''}></label>`;
  case'colorpicker': return `<input type="color" value="${esc(x.value||'#4285f4')}" style="width:100%;height:100%">`;
  case'battery': return `<meter min="0" max="100" value="${Number(x.value??78)}" style="width:100%"></meter>`;
  case'thermometer': return `<input type="range" min="-50" max="100" value="${Number(x.value??24)}" oninput="this.nextElementSibling.textContent=this.value+' °C'"><output>${Number(x.value??24)} °C</output>`;
  case'led': return `<button type="button" class="ff-real-led" aria-pressed="false" onclick="FlowForgeUI.toggleLed(this)"><i></i><span>${t}</span></button>`;
  case'sevenseg': return `<output class="ff-real-sevenseg">${t}</output>`;
  case'dotmatrix': return `<output class="ff-real-dotmatrix">${t}</output>`;
  case'sparkline': return `<canvas class="ff-real-sparkline" width="320" height="100" data-ff-sparkline="true"${x.values?` data-values="${esc(String(x.values))}"`:''}></canvas>`;
  case'glasspanel': return `<section class="ff-real-glass"><h3>${t}</h3><p>Conteúdo do painel.</p></section>`;
  case'gradientbutton': return `<button type="button" class="ff-real-gradient">${t}</button>`;
  case'iconbutton': return `<button type="button" class="ff-real-iconbutton" aria-label="${t}">${t}</button>`;
  default:return null;
 }
}
function content(x,exportMode=false){const chromeKinds=['header','navbar','bottomnav','tabs','tabcontrol','drawer','bottomsheet','sidebar','toolbar','breadcrumb','pagination','pagenav','footer'];if(chromeKinds.includes(x.kind)){let realChrome=ffRealContent(x,exportMode);if(realChrome!==null)return realChrome;}let reg=FlowForgeRegistry?.get(x.kind);if(reg?.render){try{return reg.render({item:x,exportMode,project,esc})}catch(err){console.error('[FlowForge render]',x.kind,err)}}let real=ffRealContent(x,exportMode);if(real!==null)return real;let t=esc(x.text),fw=project.framework||'none',F=window.FlowForgeFrameworks?.[fw]||window.FlowForgeFrameworks?.none||{},btn=F.button||'',inp=F.input||'',sel=F.select||'',ta=F.textarea||'',fileCls=F.file||'',badgeCls=F.badge||'',alertCls=F.alert||'',cardCls=F.card||'';switch(x.kind){case'button':{/* custom colors live on the wrapper; the inner <button> would hide them with the browser default */const bs=(x.bg&&String(x.bg).toLowerCase()!=='#ffffff'?`background:${esc(x.bg)};`:'')+(x.color&&String(x.color).toLowerCase()!=='#222222'?`color:${esc(x.color)};`:'');return `<button class="${btn}"${bs?` style="${bs}"`:''} data-ff-control="true">${t}</button>`}case'input':return `<input class="${inp}" placeholder="${t}">`;case'textarea':return `<textarea class="${ta}" placeholder="${t}"></textarea>`;case'image':return x.src?`<img src="${esc(x.src)}" alt="${t}" style="display:block;width:100%;height:100%;object-fit:${x.fit||'cover'};border-radius:${x.borderRadius||0}px"${x.lazy?' loading="lazy"':''}>`:`<div class="ph">▧<small>${t||'Imagem'}</small></div>`;
case'picturebox':return `<img${x.src?` src="${esc(x.src)}"`:''} alt="${t}" style="display:block;width:100%;height:100%;object-fit:${x.fit||'contain'}">`;case'checkbox':return `<label><input type="checkbox"> ${t}</label>`;case'radio':return `<label><input type="radio"> ${t}</label>`;case'switch':return `<label class="sw"><input type="checkbox" role="switch"><i></i>${t}</label>`;case'select':case'combobox':{let opts=Array.isArray(x.items)?x.items:(Array.isArray(x.options)?x.options:[t||'Opção 1','Opção 2','Opção 3']);return `<select class="${sel}">${opts.map((o,i)=>{let it=(o&&typeof o==='object')?o:{text:String(o),value:o};return `<option value="${esc(it.value??it.text??'')}">${esc(it.text??it.value??'')}</option>`}).join('')}</select>`;}case'listbox':{let opts=Array.isArray(x.items)?x.items:(Array.isArray(x.options)?x.options:['Item 1','Item 2','Item 3']);return `<select multiple class="${sel}" size="${Math.min(8,Math.max(3,opts.length))}">${opts.map(o=>{let it=(o&&typeof o==='object')?o:{text:String(o),value:o};return `<option value="${esc(it.value??it.text??'')}">${esc(it.text??it.value??'')}</option>`}).join('')}</select>`;}case'range':return `<input type="range">`;case'date':return `<input type="date" class="${inp}">`;case'time':return `<input type="time" class="${inp}">`;case'fileupload':case'file':return `<input type="file" class="${fileCls}">`;case'form':return `<b>${t}</b><br><input placeholder="Nome"><br><button>Enviar</button>`;case'pagenav':return `<select class="ff-page-nav" aria-label="Navegação de páginas" onchange="FlowForgeUI.goPage(this,this.value)">${(project.pages||[]).map(pg=>`<option value="${esc(pg.id)}"${pg.id===project.activePage?' selected':''}>${ffNavLabel(pg)}</option>`).join('')}</select>`;case'link':{let h=x.targetPage?`#/page/${esc((project.pages||[]).find(p=>p.id===x.targetPage)?.slug||x.targetPage)}`:(x.href||'#');return `<a href="${esc(h)}">${t}</a>`;}case'label':{let s='';if(x.fontFamily)s+=`font-family:${x.fontFamily};`;if(x.fontSize)s+=`font-size:${x.fontSize}px;`;if(x.bold)s+='font-weight:bold;';if(x.italic)s+='font-style:italic;';if(x.underline)s+='text-decoration:underline;';if(x.multiline)s+='white-space:pre-wrap;';let body=x.allowHtml?String(x.text??''):esc(x.text);return s?`<span style="${s}">${body}</span>`:body}
case'heading':{let s='';if(x.fontFamily)s+=`font-family:${x.fontFamily};`;if(x.fontSize)s+=`font-size:${x.fontSize}px;`;if(x.italic)s+='font-style:italic;';if(x.underline)s+='text-decoration:underline;';return `<h2${s?` style="${s}"`:''}>${t}</h2>`}
case'divider':return `<hr>`;case'navbar':return `<div class="ff-nav"><b>${t}</b><span>☰</span></div>`;case'bottomnav':return `<div class="ff-nav"><span>⌂ Home</span><span>⌕ Buscar</span><span>☺ Perfil</span></div>`;case'tabs':return `<div class="ff-nav"><b>Aba 1</b><span>Aba 2</span><span>Aba 3</span></div>`;case'tabcontrol':return `<div class="ff-tabcontrol"><nav><b>Aba 1</b><span>Aba 2</span><span>＋</span></nav><section>Conteúdo da aba selecionada</section></div>`;case'drawer':return `<div class="ff-drawer"><b>${t}</b><span>⌂ Início</span><span>▦ Projetos</span><span>⚙ Configurações</span></div>`;case'bottomsheet':return `<div class="ff-bottomsheet"><i></i><b>${t}</b><p>Conteúdo deslizante para interfaces mobile.</p></div>`;case'sidebar':return `<div class="ff-drawer"><b>${t}</b><span>⌂ Início</span><span>▦ Conteúdo</span><span>⚙ Ajustes</span></div>`;case'toolbar':return `<div class="ff-nav"><button>＋</button><button>✎</button><button>↥</button><span>${t}</span></div>`;case'footer':return `<div class="ff-footer">${t} • 2026</div>`;case'breadcrumb':return `<span>${t}</span>`;case'pagination':return `<div class="ff-nav"><span>‹</span><b>1</b><span>2</span><span>3</span><span>›</span></div>`;case'fab':return `<button class="ff-fab ${btn}">+</button>`;case'list':return `<ul class="ff-list"><li>${t}</li><li>Item 2</li><li>Item 3</li></ul>`;case'table':return `<table><tr><th>Nome</th><th>Valor</th></tr><tr><td>Item</td><td>123</td></tr><tr><td>Outro</td><td>456</td></tr></table>`;case'datagrid':return `<table class="ff-datagrid"><tr><th>Nome</th><th>Status</th><th>Valor</th></tr><tr><td>Item A</td><td>Ativo</td><td>120</td></tr><tr><td>Item B</td><td>Pendente</td><td>85</td></tr></table>`;case'chart':return `<div class="ff-chart"><i style="height:35%"></i><i style="height:62%"></i><i style="height:48%"></i><i style="height:82%"></i><i style="height:68%"></i></div>`;case'calendar':return `<div class="ff-calendar"><b>${t}</b><div>DOM SEG TER QUA QUI SEX SÁB</div><p>1 2 3 4 5 6 7<br>8 9 10 11 12 13 14<br>15 16 17 18 19 20 21<br>22 23 24 25 26 27 28</p></div>`;case'listview':return `<div class="ff-listview"><span>Item 1</span><span>Item 2</span><span>Item 3</span></div>`;case'treeview':return `<div class="ff-treeview">▾ Projeto<br>　├ Página inicial<br>　├ Assets<br>　└ Scripts</div>`;case'statcard':return `<div class="ff-statcard"><small>${t}</small><b>1.284</b><em>+12,4%</em></div>`;case'rating':return `<div class="ff-rating">★★★★★</div>`;case'timeline':return `<div class="ff-timeline"><p>● Início</p><p>● Desenvolvimento</p><p>● Publicação</p></div>`;case'stepper':return `<div class="ff-stepper"><b>1</b><i></i><b>2</b><i></i><b>3</b></div>`;case'badge':return `<span class="ff-badge ${badgeCls}">${t}</span>`;case'progress':{let min=Number(x.min??0),max=Number(x.max??100),val=Math.max(min,Math.min(max,Number(x.value??50))),pct=max>min?((val-min)/(max-min))*100:0;return `<div class="ff-progress ${fw==='bootstrap'?'progress':''}" role="progressbar" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${val}"><i class="${fw==='bootstrap'?'progress-bar':''}" style="width:${pct}%;background:${x.barColor||'#22c55e'}"></i>${x.showText!==false?`<span>${Math.round(pct)}%</span>`:''}</div>`}case'spinner':return `<div class="ff-spinner ${fw==='bootstrap'?'spinner-border':''}"></div>`;case'accordion':return `<details><summary>${t}</summary><p>Conteúdo do accordion.</p></details>`;case'alert':return `<div class="${alertCls}">${t}</div>`;case'modalbox':return `<div class="ff-modal"><b>${t}</b><p>Conteúdo do modal</p><button>OK</button></div>`;case'toast':return `<div class="ff-modal">${t}</div>`;case'hero':return `<div class="ff-hero">${t}<small style="display:block;font-size:13px;font-weight:400">Subtítulo da seção principal</small></div>`;case'video':{let a=x.autoplay?' autoplay':'';let l=x.loop?' loop':'';let m=x.muted?' muted':'';let c=x.controls!==false?' controls':'';let po=x.poster?` poster="${esc(x.poster)}"`:'';let src=x.src?` src="${esc(x.src)}"`:'';let v=Number.isFinite(Number(x.volume))?` data-ff-volume="${Math.max(0,Math.min(1,Number(x.volume)))}"`:'';return `<video${src}${c}${a}${l}${m}${po}${v} playsinline preload="metadata" style="display:block;width:100%;height:100%;object-fit:${x.fit||'contain'};background:#111"></video>`;}case'audio':{let a=x.autoplay?' autoplay':'';let l=x.loop?' loop':'';let m=x.muted?' muted':'';let c=x.controls!==false?' controls':'';let src=x.src?` src="${esc(x.src)}"`:'';let v=Number.isFinite(Number(x.volume))?` data-ff-volume="${Math.max(0,Math.min(1,Number(x.volume)))}"`:'';return `<audio${src}${c}${a}${l}${m}${v} preload="metadata" style="display:block;width:100%;height:100%"></audio>`;}case'camera':return exportMode ? `<video playsinline${x.autoplay!==false?' autoplay':''}${x.muted!==false?' muted':''} style="width:100%;height:100%;object-fit:${x.fit||'cover'};background:#111"></video>` : `<div class="ff-camera-design"><span>◉</span><small>${t}<br>${x.facingMode||'environment'} • ativa no Preview</small></div>`;case'fileupload':return `<label class="ff-upload">↥ ${t}<input type="file"></label>`;case'colorpicker':return `<input type="color" value="#4285f4" style="width:100%;height:100%">`;case'avatar':return `<div class="ff-avatar">👤</div>`;case'modal':return `<div class="ff-modal"><b>${t}</b><p>Conteúdo da janela modal</p><button>OK</button></div>`;case'toast':return `<div class="ff-toast">${t}</div>`;case'tooltip':return `<div class="ff-tooltip">${t}</div>`;case'carousel':return `<div class="ff-carousel">‹ <b>${t}</b> ›</div>`;case'timer':case'http':case'websocket':case'storage':case'geolocation':case'notification':case'clipboard':case'network':case'vibration':return `<div class="ff-nonvisual">${t}</div>`;case'iframe':{let u=x.src||x.iframeUrl||'about:blank';return `<iframe src="${esc(u)}" title="${t||'Conteúdo externo'}" loading="${x.lazy?'lazy':'eager'}" style="display:block;width:100%;height:100%;border:0;background:#fff" allowfullscreen></iframe>`;}case'canvas':return `<canvas width="${Math.max(1,parseInt(x.canvasWidth||x.width)||300)}" height="${Math.max(1,parseInt(x.canvasHeight||x.height)||180)}" style="display:block;width:100%;height:100%;background:${x.canvasBackground||'#fff'}" aria-label="${t||'Canvas'}"></canvas>`;case'map':{let lat=Number.isFinite(Number(x.mapLat))?Number(x.mapLat):0,lng=Number.isFinite(Number(x.mapLng))?Number(x.mapLng):0,z=Math.max(1,Math.min(20,Number(x.mapZoom)||13));let delta=Math.max(.0005,180/Math.pow(2,z-1));let bbox=[lng-delta,lat-delta,lng+delta,lat+delta].join('%2C');let u=x.src||`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;return `<iframe src="${esc(u)}" title="${t||'Mapa'}" style="display:block;width:100%;height:100%;border:0;background:#e5e7eb" loading="lazy"></iframe>`;}case'qrcode':{let text=x.textContent??x.qrcodeText??x.text??'';let size=Math.max(64,Math.min(2048,Number(x.qrcodeSize)||160));let u=`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;return `<img src="${u}" alt="QR Code: ${esc(text)}" data-ff-qr-text="${esc(text)}" data-ff-qr-size="${size}" style="display:block;width:100%;height:100%;object-fit:contain;background:#fff">`;}case'battery':return `<div class="ff-battery"><span><i style="width:78%"></i></span><b>${t}</b></div>`;case'thermometer':return `<div class="ff-thermo"><span><i></i></span><b>${t}</b></div>`;case'led':return `<div class="ff-led"><i></i><span>${t}</span></div>`;case'sevenseg':return `<div class="ff-sevenseg">${t}</div>`;case'dotmatrix':return `<div class="ff-dotmatrix">${t}</div>`;case'sparkline':return `<div class="ff-spark"><small>${t}</small><svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="0,24 12,18 25,22 38,9 50,14 63,5 76,12 88,7 100,10"/></svg></div>`;case'valuecard':return `<div class="ff-valuecard"><small>VALOR</small><strong>${t}</strong><span>+12%</span></div>`;case'statuscard':return `<div class="ff-statuscard"><i></i><div><b>${t}</b><small>Funcionando normalmente</small></div></div>`;case'glasspanel':return `<div class="ff-glasspanel"><b>${t}</b><small>Componente customizado</small></div>`;case'gradientbutton':return `<button class="ff-gradientbutton">${t}</button>`;case'iconbutton':return `<button class="ff-iconbutton">${t}</button>`;case'mobilelist':return `<div class="ff-mobilelist"><div><b>${t}</b><small>Descrição do item</small><span>›</span></div><div><b>Segundo item</b><small>Outra opção</small><span>›</span></div></div>`;case'icon':return `<div class="ff-icon">${t}</div>`;default:return t}}

function titlebarContent(t){let fw=project.framework||'none',title=esc(t.text||project.name),menu=t.showMenu?'● ● ●':'';if(fw==='bootstrap')return `<div class="ff-titlebrand"><span class="ff-titleicon">▣</span><b>${title}</b></div><span class="ff-titlemenu">${menu}</span>`;if(fw==='bulma')return `<div class="ff-titlebrand"><b>${title}</b></div><span class="ff-titlemenu">${menu}</span>`;if(fw==='pico')return `<div class="ff-titlebrand"><b>${title}</b></div><span class="ff-titlemenu">${menu}</span>`;return `<b>${title}</b><span>${menu}</span>`}
function ffInitCanvasElement(d,x){if(x.kind!=='canvas')return;const c=d.querySelector('canvas');if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=x.canvasBackground||'#fff';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#cbd5e1';ctx.strokeRect(.5,.5,c.width-1,c.height-1);ctx.fillStyle=x.color||'#334155';ctx.font='14px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(x.text||'Canvas',c.width/2,c.height/2);}
function ffDockStyle(x){const dock=x?.dock||'';const style={};if(!dock)return style;style.position='absolute';if(dock==='top'){style.left='0';style.right='0';style.top=(project?.type==='app' ? ((parseInt(project?.titlebar?.height)||52)) : 0)+'px';style.width='100%';}else if(dock==='bottom'){style.left='0';style.right='0';style.bottom='0';style.width='100%';}else if(dock==='left'){style.left='0';style.top=(project?.type==='app' ? ((parseInt(project?.titlebar?.height)||52)) : 0)+'px';style.bottom='0';}else if(dock==='right'){style.right='0';style.top=(project?.type==='app' ? ((parseInt(project?.titlebar?.height)||52)) : 0)+'px';style.bottom='0';}else if(dock==='fill'){style.left='0';style.right='0';style.top=(project?.type==='app' ? ((parseInt(project?.titlebar?.height)||52)) : 0)+'px';style.bottom='0';style.width='100%';}return style;}
function makeEl(x){let d=document.createElement('div');d.className='component '+x.kind+' ff-kind-'+x.kind;d.dataset.id=x.id;Object.assign(d.style,{left:x.x+'px',top:x.y+'px',width:x.width,height:x.height,background:x.bg||'',color:x.color||'',textAlign:x.textAlign||''},ffDockStyle(x));d.innerHTML=content(x);ffInitCanvasElement(d,x);if(x.kind==='audio'||x.kind==='video'){const media=d.querySelector('audio,video');if(media&&Number.isFinite(Number(x.volume)))media.volume=Math.max(0,Math.min(1,Number(x.volume)));}d.addEventListener('pointerdown',e=>startDrag(e,x,d),true);d.onclick=e=>{e.stopPropagation();if(selected?.id!==x.id)select(x)};d.ondblclick=e=>{e.preventDefault();e.stopPropagation();lastComponentTap={id:null,time:0};openDefaultAction(x)};if(selected?.id===x.id){d.classList.add('selected');['nw','ne','sw','se'].forEach(pos=>{let h=document.createElement('i');h.className='handle '+pos;h.onpointerdown=e=>startResize(e,x,d,pos);d.append(h)})}return d}
function select(x){selected=x;render()}function markSelected(x,d){selected=x;document.querySelectorAll('.component.selected,.app-titlebar.selected').forEach(el=>{el.classList.remove('selected');el.querySelectorAll(':scope > .handle').forEach(h=>h.remove())});d.classList.add('selected');if(x.kind!=='titlebar')['nw','ne','sw','se'].forEach(pos=>{let h=document.createElement('i');h.className='handle '+pos;h.onpointerdown=e=>startResize(e,x,d,pos);d.append(h)});props();$('#selectionInfo').textContent=x.kind==='titlebar'?`${x.name} • TitleBar`:`${x.name}  ${x.x},${x.y}  ${x.width}×${x.height}`}function applyFrameworkChromeDesignerCSS(){
 const id='ff-framework-chrome-designer-css',fw=project.framework||'none';
 const base=`
#stage .ff-real-sidebar{height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:auto;background:#f8fafc;color:#111827;border-right:1px solid rgba(100,116,139,.25)}
#stage .ff-real-sidebar .ff-sidebar-title{flex:0 0 auto;display:block;width:100%;box-sizing:border-box;padding:12px 14px;font-weight:700;border-bottom:1px solid rgba(100,116,139,.2)}
#stage .ff-real-sidebar .ff-sidebar-nav{display:grid;grid-template-columns:1fr;grid-auto-rows:min-content;align-content:start;gap:3px;padding:8px;width:100%;box-sizing:border-box}
#stage .ff-real-sidebar .ff-sidebar-nav button{display:block!important;width:100%!important;box-sizing:border-box;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;white-space:nowrap}
#stage .ff-real-sidebar .ff-sidebar-nav button:hover{background:rgba(100,116,139,.12)}
#stage .ff-real-sidebar .ff-sidebar-nav button.active{background:rgba(59,130,246,.16);font-weight:700}
#stage .ff-real-drawer{height:100%;width:100%;box-sizing:border-box;overflow:auto}
#stage .ff-real-bottomnav{display:flex;justify-content:space-around;align-items:center;height:100%;padding:4px}
#stage .ff-real-navbar{display:flex;align-items:stretch;justify-content:center;gap:4px;width:100%;height:100%;box-sizing:border-box;overflow:auto}
#stage .ff-real-navbar button{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
#stage .ff-real-footer{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;width:100%;height:100%;box-sizing:border-box}
`;
 let css={
  none:base,
  bootstrap:'#stage[data-framework=\"bootstrap\"] .ff-real-header{background:#f8f9fa;color:#212529;border-bottom:1px solid #dee2e6}#stage[data-framework=\"bootstrap\"] .ff-real-header .navbar-brand{color:#212529;text-decoration:none}#stage[data-framework=\"bootstrap\"] .ff-real-footer{background:#f8f9fa;color:#212529;border-top:1px solid #dee2e6}#stage[data-framework=\"bootstrap\"] .ff-real-footer button{color:#0d6efd;background:transparent;border:0}',
  bulma:'#stage[data-framework=\"bulma\"] .ff-real-header{background:#f5f5f5;color:#363636}#stage[data-framework=\"bulma\"] .ff-real-footer{background:#fafafa;color:#363636}#stage[data-framework=\"bulma\"] .ff-real-footer .buttons button{background:transparent;border:1px solid #dbdbdb;color:#363636}',
  pico:'#stage[data-framework=\"pico\"] .ff-real-header{background:var(--pico-background-color,#fff);color:var(--pico-color,#373c44);border-bottom:1px solid var(--pico-muted-border-color,#dfe3e6)}#stage[data-framework=\"pico\"] .ff-real-footer{background:var(--pico-background-color,#fff);color:var(--pico-muted-color,#646b74);border-top:1px solid var(--pico-muted-border-color,#dfe3e6)}',
  tailwind:'#stage[data-framework=\"tailwind\"] .ff-real-header{background:#0f172a;color:#fff;border-bottom:1px solid #334155}#stage[data-framework=\"tailwind\"] .ff-real-footer{background:#0f172a;color:#fff;border-top:1px solid #334155}',
  materialize:'#stage[data-framework=\"materialize\"] .ff-real-header{background:#263238;color:#fff}#stage[data-framework=\"materialize\"] .ff-real-footer{background:#263238;color:#fff}#stage[data-framework=\"materialize\"] .ff-real-footer button{background:transparent;border:0;color:#fff}',
  foundation:'#stage[data-framework=\"foundation\"] .ff-real-header{background:#e6e6e6;color:#0a0a0a}#stage[data-framework=\"foundation\"] .ff-real-footer{background:#e6e6e6;color:#0a0a0a}',
  uikit:'#stage[data-framework=\"uikit\"] .ff-real-header{background:#f8f8f8;color:#333;border-bottom:1px solid #e5e5e5}#stage[data-framework=\"uikit\"] .ff-real-footer{background:#222;color:#fff}',
  semantic:'#stage[data-framework=\"semantic\"] .ff-real-header{background:#f9fafb;color:rgba(0,0,0,.87)}#stage[data-framework=\"semantic\"] .ff-real-footer{background:#1b1c1d;color:#fff}'
 }[fw]||'';
 css=base+css;
 let el=document.getElementById(id);if(!el){el=document.createElement('style');el.id=id;document.head.appendChild(el)}el.textContent=css;
}
function applyFrameworkDesignerCSS(){let id='ff-framework-designer-css',fw=project.framework||'none',mode=project.designerMode||'framework',css=mode==='framework'?(window.FlowForgeFrameworkDesignerCSS?.[fw]||''):'';let el=document.getElementById(id);if(!el){el=document.createElement('style');el.id=id;document.head.appendChild(el)}el.textContent=css}
function render(){renderPages();renderTopPagePicker();project.titlebar??={name:'titlebar1',text:project.name,height:'52px',bg:'#20242a',color:'#ffffff',showMenu:true,autoStyle:true};project.titlebar.autoStyle??=true;project.headerLogo??='';applyFrameworkDesignerCSS();applyFrameworkChromeDesignerCSS();$('#projectName').value=project.name;$('#projectType').value=project.type;$('#framework').value=project.framework||'none';$('#projectHeaderLogoField').style.display=(project.type==='site'||project.type==='landing')?'flex':'none';$('#frameworkTop').value=project.framework||'none';$('#designerMode').value=project.designerMode||'framework';$('#designerModeTop').value=project.designerMode||'framework';let stage=$('#stage');stage.dataset.framework=project.framework||'none';stage.dataset.designerMode=project.designerMode||'framework';stage.dataset.projectType=project.type;stage.innerHTML='';if(project.type==='app' && project.siteLayout?.titlebar!==false){let t=project.titlebar,tb=document.createElement('div');tb.className='app-titlebar'+(selected?.kind==='titlebar'?' selected':'');tb.style.height=t.height;if(!t.autoStyle){tb.style.background=t.bg;tb.style.color=t.color}else{tb.style.background='';tb.style.color=''}tb.innerHTML=titlebarContent(t);tb.onclick=e=>{e.stopPropagation();selected=t;selected.kind='titlebar';render()};stage.append(tb)}project.pages[project.active].items.forEach(x=>{if(x.ffSystem==='siteChrome'&&x.kind==='header'&&(!x.text||x.text==='Minha Marca'))x.text=project.name||'Minha Marca';stage.append(makeEl(x))});props();updateCode();$('#selectionInfo').textContent=selected?(selected.kind==='titlebar'?`${selected.name} • TitleBar`:`${selected.name}  ${selected.x},${selected.y}  ${selected.width}×${selected.height}`):'';window.FFDesignerViewport?.restore?.();window.FFProjectModes?.responsive?.()}

const EVENT_OPTIONS={button:['click','dblclick','mousedown','mouseup','mouseenter','mouseleave','focus','blur'],link:['click','focus','blur'],input:['input','change','focus','blur','keydown','keyup'],textarea:['input','change','focus','blur','keydown','keyup'],select:['change','focus','blur'],checkbox:['change','click'],radio:['change','click'],switch:['change','click'],range:['input','change'],form:['submit','reset'],image:['click','load','error'],picturebox:['click','load','error'],video:['play','pause','ended','timeupdate','volumechange'],audio:['play','pause','ended','timeupdate','volumechange'],file:['change'],fileupload:['change'],camera:['click','camerastart','camerastop','cameraerror'],iframe:['load'],calendar:['change','click'],rating:['change','click'],progress:['change','complete'],tabcontrol:['click'],drawer:['click'],bottomsheet:['click'],timer:['tick','start','stop'],http:['request','response','error'],websocket:['open','message','close','error'],storage:['change'],geolocation:['change','error'],notification:['click','close','error'],network:['change','online','offline'],default:['click','dblclick','mouseenter','mouseleave','focus','blur']};
function eventsFor(kind){let base=EVENT_OPTIONS[kind]||EVENT_OPTIONS.default,def=defaultEvent(kind);return [...new Set([def,...base])]}
function actionLabel(ev){return ({click:'Click',dblclick:'Double Click',change:'Change',input:'Input',submit:'Submit',reset:'Reset',load:'Load',error:'Error',play:'Play',pause:'Pause',ended:'Ended',timeupdate:'Time Update',volumechange:'Volume Change',focus:'Focus',blur:'Blur',keydown:'Key Down',keyup:'Key Up',mousedown:'Mouse Down',mouseup:'Mouse Up',mouseenter:'Mouse Enter',mouseleave:'Mouse Leave',toggle:'Toggle'})[ev]||ev}
function openAction(x,ev){selected=x;x.events??={};if(!(ev in x.events))x.events[ev]=`// ${x.name}: ${ev}\n`;updateCode();activateTab('code');let ta=$('#code'),mark=eventMarker(x,ev),i=ta.value.indexOf(mark);if(i>=0){let fn=ta.value.indexOf('function ',i),brace=ta.value.indexOf('{',fn),start=ta.value.indexOf('\n',brace)+1,end=ta.value.indexOf('\n}',start);ta.focus();ta.setSelectionRange(start,end>start?end:start);ta.scrollTop=Math.max(0,(ta.value.slice(0,start).split('\n').length-6)*21.7);syncCodeHighlight()}$('#selectionInfo').textContent=`${x.name} → ${ev}()`}
function renderActions(){refreshVisualTargets();let empty=$('#actionEmpty'),editor=$('#actionEditor'),list=$('#actionList'),sel=$('#actionEventSelect'),quick=$('#quickActions');if(!empty)return;let valid=selected&&selected.kind!=='titlebar';empty.hidden=valid;editor.hidden=!valid;if(!valid)return;selected.events??={};let options=eventsFor(selected.kind);sel.innerHTML=options.filter(ev=>!(ev in selected.events)).map(ev=>`<option value="${ev}">${actionLabel(ev)} (${ev})</option>`).join('');$('#addActionBtn').disabled=!sel.options.length;list.innerHTML='';Object.keys(selected.events).forEach(ev=>{let row=document.createElement('div');row.className='actionRow';let info=document.createElement('div');info.innerHTML=`<b>${actionLabel(ev)}</b><small>${ev} → ${selected.name}_${ev}()</small>`;let edit=document.createElement('button');edit.type='button';edit.textContent='Código';edit.onclick=()=>openAction(selected,ev);let remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remover ação';remove.onclick=()=>{snapshot();delete selected.events[ev];renderActions();updateCode()};row.append(info,edit,remove);list.append(row)});quick.innerHTML='';[['Abrir ação padrão',()=>openDefaultAction(selected)],['Duplicar componente',duplicate],['Excluir componente',del]].forEach(([txt,fn])=>{let b=document.createElement('button');b.type='button';b.textContent=txt;b.onclick=fn;quick.append(b)})}
const FF_COMMON_PROPS=new Set(['name','text','x','y','width','height','visible','enabled','background','bg','color']);
const FF_FIELD_META={
 src:{label:'Origem (URL)',type:'text'},fit:{label:'Ajuste',type:'select',options:['cover','contain','fill','none']},
 alt:{label:'Texto alternativo',type:'text'},borderRadius:{label:'Borda arredondada (px)',type:'number'},
 lazy:{label:'Carregamento tardio',type:'checkbox'},variant:{label:'Variante',type:'select',options:['primary','secondary','outline','ghost','danger']},
 icon:{label:'Ícone',type:'text'},shadow:{label:'Sombra',type:'checkbox'},placeholder:{label:'Placeholder',type:'text'},
 maxLength:{label:'Tamanho máximo',type:'number'},readOnly:{label:'Somente leitura',type:'checkbox'},
 autoplay:{label:'Reprodução automática',type:'checkbox'},loop:{label:'Repetir',type:'checkbox'},
 volume:{label:'Volume (0-1)',type:'number',min:0,max:1,step:0.1},controls:{label:'Mostrar controles',type:'checkbox'},
 poster:{label:'Imagem de capa (URL)',type:'text'},columns:{label:'Colunas (JSON)',type:'textarea'},
 striped:{label:'Listras',type:'checkbox'},sortable:{label:'Ordenável',type:'checkbox'},pageSize:{label:'Itens por página',type:'number'},
 chartType:{label:'Tipo de gráfico',type:'select',options:['bar','line','pie','doughnut']},values:{label:'Valores (JSON)',type:'textarea'},
 legend:{label:'Mostrar legenda',type:'checkbox'},value:{label:'Valor',type:'number'},min:{label:'Mínimo',type:'number'},
 max:{label:'Máximo',type:'number'},facingMode:{label:'Câmera',type:'select',options:['user','environment']},
 muted:{label:'Mudo',type:'checkbox'},audio:{label:'Capturar áudio',type:'checkbox'},showText:{label:'Mostrar porcentagem',type:'checkbox'},
 barColor:{label:'Cor da barra',type:'color'},size:{label:'Tamanho (px)',type:'number'},open:{label:'Aberto',type:'checkbox'},
 position:{label:'Posição',type:'select',options:['left','right','top','bottom']},overlay:{label:'Overlay',type:'checkbox'},
 activeTab:{label:'Aba ativa (índice)',type:'number'},tabs:{label:'Abas (JSON)',type:'textarea'},
 dock:{label:'Encaixe',type:'select',options:['none','top','bottom','left','right','fill']},
 anchor:{label:'Âncora',type:'select',options:['none','top','bottom','left','right','all']},
 overflow:{label:'Overflow',type:'select',options:['visible','hidden','auto','scroll']},
 direction:{label:'Direção',type:'select',options:['row','column']},
 justify:{label:'Justificar',type:'select',options:['start','center','end','space-between','space-around']},
 align:{label:'Alinhar',type:'select',options:['start','center','end','stretch']},gap:{label:'Espaçamento (px)',type:'number'},
 wrap:{label:'Quebrar linha',type:'checkbox'},rows:{label:'Linhas',type:'number'},interval:{label:'Intervalo (ms)',type:'number',min:10},
 oneShot:{label:'Executar uma vez',type:'checkbox'},url:{label:'URL',type:'text'},
 method:{label:'Método',type:'select',options:['GET','POST','PUT','PATCH','DELETE']},headers:{label:'Cabeçalhos (JSON)',type:'textarea'},
 protocol:{label:'Protocolo',type:'text'},key:{label:'Chave de armazenamento',type:'text'},iframeUrl:{label:'URL do iFrame',type:'text'},mapLat:{label:'Latitude',type:'number',step:0.000001},mapLng:{label:'Longitude',type:'number',step:0.000001},mapZoom:{label:'Zoom',type:'number',min:1,max:20},textContent:{label:'Texto do QR Code',type:'text'},qrcodeSize:{label:'Tamanho do QR',type:'number',min:64,max:2048},
 closeOnBackdrop:{label:'Fechar ao clicar fora',type:'checkbox'},activeIndex:{label:'Índice ativo',type:'number'},
 fontFamily:{label:'Fonte',type:'select',options:['Arial, sans-serif','Georgia, serif','"Courier New", monospace','Verdana, sans-serif','"Segoe UI", sans-serif','"Times New Roman", serif','"Trebuchet MS", sans-serif','cursive']},
 fontSize:{label:'Tamanho da fonte (px)',type:'number',min:6,max:200},
 bold:{label:'Negrito',type:'checkbox'},italic:{label:'Itálico',type:'checkbox'},underline:{label:'Sublinhado',type:'checkbox'},
 textAlign:{label:'Alinhamento',type:'select',options:['left','center','right','justify']}
};
function ffDynamicSchema(kind){
 if(kind==='timer'&&window.FlowForgeTimerSchema)return FlowForgeTimerSchema.filter(f=>f.key!=='name');
 if(kind==='progress'&&window.FlowForgeProgressSchema)return FlowForgeProgressSchema;
 let keys=(window.FlowForgePropertySchema&&window.FlowForgePropertySchema[kind])||(window.FlowForgeRegistry?.get(kind)?.properties)||[];
 return keys.filter(k=>!FF_COMMON_PROPS.has(k)).map(k=>({key:k,...(FF_FIELD_META[k]||{label:k,type:'text'})}));
}
function renderDynamicProps(){
 const c=$('#propDynamic');if(!c)return;
 if(!selected||selected.kind==='titlebar'){c.innerHTML='';return}
 let fields=ffDynamicSchema(selected.kind);if(selected.kind!=='titlebar' && !fields.some(f=>f.key==='dock') && selected.kind!=='timer' && selected.kind!=='http' && selected.kind!=='websocket' && selected.kind!=='storage' && selected.kind!=='geolocation' && selected.kind!=='notification' && selected.kind!=='clipboard' && selected.kind!=='network' && selected.kind!=='vibration') fields=[{key:'dock',label:'Encaixe (Dock)',type:'select',options:['none','top','bottom','left','right','fill']},...fields];
 if(['button','gradientbutton','iconbutton','fab'].includes(selected.kind)) fields=[...fields,{key:'targetPage',label:'Página de destino',type:'page'}];
 if(selected.kind==='link') fields=[...fields,{key:'href',label:'Href',type:'text'},{key:'targetPage',label:'Página de destino',type:'page'}];
 if(['select','combobox','listbox'].includes(selected.kind)) fields=[...fields,{key:'items',label:'Itens (JSON)',type:'textarea'}];
 if(!fields.length && selected.kind!=='header'){c.innerHTML='';return}
 c.innerHTML = fields.length ? '<hr><h3>Propriedades: '+esc(ffKindLabel(selected.kind))+'</h3>'+fields.map(f=>{
  let val=selected[f.key];
  if(f.type==='checkbox')return `<label class="check"><input type="checkbox" data-key="${f.key}" data-type="checkbox"${val?' checked':''}> ${esc(f.label)}</label>`;
  if(f.type==='page'){let opts='<option value="">Nenhuma</option>'+(project.pages||[]).map(pg=>`<option value="${esc(pg.id)}"${String(val??'')===String(pg.id)?' selected':''}>${ffNavLabel(pg)} (#/${esc(pg.slug||pg.id)})</option>`).join('');return `<label>${esc(f.label)}<select data-key="${f.key}" data-type="page">${opts}</select></label>`}
  if(f.type==='select'){let opts=(f.options||[]).map(o=>`<option value="${esc(o)}"${String(val??'')===String(o)?' selected':''}>${esc(o)}</option>`).join('');return `<label>${esc(f.label)}<select data-key="${f.key}" data-type="select">${opts}</select></label>`}
  if(f.type==='textarea'){let tv=val==null?'':(typeof val==='object'?JSON.stringify(val,null,2):val);return `<label>${esc(f.label)}<textarea data-key="${f.key}" data-type="textarea">${esc(tv)}</textarea></label>`}
  if(f.type==='color')return `<label>${esc(f.label)}<input type="color" data-key="${f.key}" data-type="color" value="${esc(val||'#22c55e')}"></label>`;
  if(f.type==='number')return `<label>${esc(f.label)}<input type="number" data-key="${f.key}" data-type="number"${f.min!=null?` min="${f.min}"`:''}${f.max!=null?` max="${f.max}"`:''}${f.step!=null?` step="${f.step}"`:''} value="${val??''}"></label>`;
  return `<label>${esc(f.label)}<input type="text" data-key="${f.key}" data-type="text" value="${esc(val??'')}"></label>`
 }).join('') : '';
 if(selected.kind==='label'){
   const box=$('#labelTextTools'); if(box) box.hidden=false;
   const lm=$('#labelMultiline'),lh=$('#labelAllowHtml'),wb=$('#labelWysiwygOpen');
   if(lm){lm.checked=!!selected.multiline;lm.onchange=()=>{snapshot();selected.multiline=lm.checked;render()};}
   if(lh){lh.checked=!!selected.allowHtml;lh.onchange=()=>{snapshot();selected.allowHtml=lh.checked;render()};}
   if(wb) wb.onclick=()=>{const dlg=$('#labelWysiwygDlg'),ed=$('#labelWysiwygEditor');ed.innerHTML=selected.allowHtml?String(selected.text||''):esc(selected.text||'').replace(/\n/g,'<br>');dlg.showModal();};
 } else { const box=$('#labelTextTools'); if(box) box.hidden=true; }
 if(selected.kind==='header'){
   c.innerHTML += `<hr><h3>Header do Site</h3><div class="assetField"><label>Logo do Header <small>(opcional · Base64)</small></label><div class="assetPickerRow"><input id="headerComponentLogoFile" type="file" accept="image/*,.svg" hidden><button type="button" id="headerComponentLogoPick">Escolher logo</button><button type="button" id="headerComponentLogoAsset">Usar Asset</button><button type="button" id="headerComponentLogoClear">Remover</button></div><div id="headerComponentLogoInfo" class="assetFileInfo"></div></div>`;
   setImageInfo('headerComponentLogoInfo',project.headerLogo,'Nenhum logo definido');
   $('#headerComponentLogoPick').onclick=()=>$('#headerComponentLogoFile').click();
   $('#headerComponentLogoFile').onchange=async e=>{await chooseProjectImage('headerLogo',e.target.files?.[0],'headerComponentLogoInfo');e.target.value='';render();};
   $('#headerComponentLogoAsset').onclick=()=>{openProjectAssetPicker('headerLogo','headerComponentLogoInfo');};
   $('#headerComponentLogoClear').onclick=()=>{snapshot();project.headerLogo='';setImageInfo('headerComponentLogoInfo','', 'Nenhum logo definido');render();};
 }
}
function props(){renderActions();let off=!selected,isTitle=selected?.kind==='titlebar';let auto=$('#pTitleAuto');if(auto){auto.closest('label').style.display=isTitle?'flex':'none';auto.checked=isTitle?(selected.autoStyle!==false):true;}['pName','pText','pX','pY','pWidth','pHeight','pBg','pColor','pVisible','pEnabled','deleteBtn','duplicateBtn'].forEach(id=>$('#'+id).disabled=off);if(!selected){$('#propDynamic').innerHTML='';return}$('#pName').value=selected.name||'';$('#pText').value=selected.text||'';$('#pX').value=isTitle?0:(selected.x??0);$('#pY').value=isTitle?0:(selected.y??0);$('#pWidth').value=isTitle?'100%':(selected.width||'');$('#pHeight').value=selected.height||'';$('#pBg').value=selected.bg||'#ffffff';$('#pColor').value=selected.color||'#222222';$('#pVisible').checked=selected.visible!==false;$('#pEnabled').checked=selected.enabled!==false;['pX','pY','pWidth','deleteBtn','duplicateBtn'].forEach(id=>$('#'+id).disabled=isTitle);$('#pName').disabled=isTitle;renderDynamicProps()}
function snap(v){return $('#snap').checked?Math.round(v/8)*8:Math.round(v)}
let lastComponentTap={id:null,time:0};
function startDrag(e,x,d){
 if(e.button!==undefined&&e.button!==0)return;
 if(e.target.closest?.('.handle'))return;
 e.preventDefault();e.stopPropagation();
 if(selected?.id!==x.id)markSelected(x,d);
 let sx=e.clientX,sy=e.clientY,ox=Number(x.x)||0,oy=Number(x.y)||0,moved=false,pid=e.pointerId;
 const move=ev=>{
   if(ev.pointerId!==pid)return;
   let dx=ev.clientX-sx,dy=ev.clientY-sy;
   if(!moved&&Math.hypot(dx,dy)>3){moved=true;snapshot()}
   if(!moved)return;
   ev.preventDefault();
   x.x=snap(Math.max(0,ox+dx));x.y=snap(Math.max(0,oy+dy));
   d.style.left=x.x+'px';d.style.top=x.y+'px';
   if($('#pX'))$('#pX').value=x.x;if($('#pY'))$('#pY').value=x.y;
 };
 const finish=ev=>{
   if(ev.pointerId!==undefined&&ev.pointerId!==pid)return;
   document.removeEventListener('pointermove',move,true);
   document.removeEventListener('pointerup',finish,true);
   document.removeEventListener('pointercancel',finish,true);
   if(moved){render();return}
   const now=performance.now();
   if(lastComponentTap.id===x.id&&now-lastComponentTap.time<800){lastComponentTap={id:null,time:0};openDefaultAction(x);return}
   lastComponentTap={id:x.id,time:now};
 };
 document.addEventListener('pointermove',move,{capture:true,passive:false});
 document.addEventListener('pointerup',finish,true);
 document.addEventListener('pointercancel',finish,true);
}
function startResize(e,x,d,pos){e.preventDefault();e.stopPropagation();let sx=e.clientX,sy=e.clientY,ow=parseInt(x.width)||100,oh=parseInt(x.height)||40,ox=x.x,oy=x.y;snapshot();d.setPointerCapture(e.pointerId);d.onpointermove=ev=>{let dx=ev.clientX-sx,dy=ev.clientY-sy,nw=ow+(pos.includes('e')?dx:-dx),nh=oh+(pos.includes('s')?dy:-dy);x.width=Math.max(24,snap(nw))+'px';x.height=Math.max(20,snap(nh))+'px';if(pos.includes('w'))x.x=snap(ox+ow-parseInt(x.width));if(pos.includes('n'))x.y=snap(oy+oh-parseInt(x.height));Object.assign(d.style,{width:x.width,height:x.height,left:x.x+'px',top:x.y+'px'})};d.onpointerup=()=>{d.onpointermove=d.onpointerup=null;render()}}
function addItem(kind,x=null,y=null){snapshot();let it=toolDefaults(kind),items=project.pages[project.active].items;if(x==null||y==null){let n=items.length;x=24+(n%8)*16;y=(project.type==='app'?72:160)+(n%10)*16}it.x=snap(x);it.y=snap(y);items.push(it);selected=it;render();let el=document.querySelector(`.component[data-id="${it.id}"]`);el?.scrollIntoView({block:'nearest',inline:'nearest'});$('#selectionInfo').textContent=`Adicionado: ${it.name} • duplo clique abre ${defaultEvent(kind)}()`}
function activateTab(name){$$('#tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));$('#stageWrap').style.display=name==='design'?'block':'none';$('#codeEditor').style.display=name==='code'?'block':'none';$('#blocksEditor').style.display=name==='blocks'?'flex':'none';$('#preview').style.display=name==='preview'?'block':'none';if(name==='blocks')window.FlowForgeBlocks?.render()}
function eventMarker(x,ev){return `// @flow-event:${x.id}:${ev}`}
function openDefaultAction(x){selected=x;let ev=defaultEvent(x.kind);x.events??={};if(!(ev in x.events))x.events[ev]=`// ${x.name}: ação padrão\n`;updateCode();activateTab('code');let ta=$('#code'),mark=eventMarker(x,ev),i=ta.value.indexOf(mark);if(i>=0){let fn=ta.value.indexOf('function ',i),brace=ta.value.indexOf('{',fn),start=ta.value.indexOf('\n',brace)+1,end=ta.value.indexOf('\n}',start);ta.focus();ta.setSelectionRange(start,end>start?end:start);ta.scrollTop=Math.max(0,(ta.value.slice(0,start).split('\n').length-6)*21.7);syncCodeHighlight()}$('#selectionInfo').textContent=`${x.name} → ${ev}()`}
window.generated=generated;
function frameworkHead(){let f=project.framework||'none';if(f==='bootstrap')return '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">';if(f==='bulma')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css">';if(f==='pico')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">';if(f==='tailwind')return '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>';if(f==='materialize')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/materialize-css@1.0.0/dist/css/materialize.min.css">';if(f==='foundation')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/foundation-sites@6.9.0/dist/css/foundation.min.css">';if(f==='uikit')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/uikit@3.23.11/dist/css/uikit.min.css"><script src="https://cdn.jsdelivr.net/npm/uikit@3.23.11/dist/js/uikit.min.js"></script><script src="https://cdn.jsdelivr.net/npm/uikit@3.23.11/dist/js/uikit-icons.min.js"></script>';if(f==='semantic')return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/semantic-ui@2.5.0/dist/semantic.min.css">';return ''}
function resolveProjectImageRef(value){
 const v=String(value||'');
 if(!v.startsWith('asset://'))return v;
 const id=v.slice(8);const a=(project.assets||[]).find(x=>String(x.id)===id);
 return a?.data||'';
}
function generated(){
 const indent=(n)=>'  '.repeat(n);
 const componentHtml=(x,n=0,byParent=null)=>{
   // load/error can fire while the page is still being parsed (e.g. an about:blank iframe), before the script that
    // declares the handlers has run. Those two are guarded so they never throw "... is not defined".
    const events=Object.keys(x.events||{}).map(ev=>(ev==='load'||ev==='error')?` on${ev}="typeof ${x.name}_${ev}==='function'&&${x.name}_${ev}(event)"`:` on${ev}="${x.name}_${ev}(event)"`).join('');
   const targetPage=(project.pages||[]).find(p=>p.id===x.targetPage); const pageNav=x.targetPage?` onclick="FlowForgeNavigate(${JSON.stringify(x.targetPage)})" data-page-target="${esc(x.targetPage)}"`:'';
   // O ID público deve apontar para o elemento interativo real nos controles de formulário/imagem.
   // Assim fileUpload1.files, picturebox1.src, textBox.value etc. funcionam como esperado.
   const direct=['button','fab','gradientbutton','iconbutton','file','fileupload','input','textarea','checkbox','radio','switch','range','date','time','select','combobox','listbox','pagenav','picturebox','image','video','audio','camera','iframe','canvas','map','qrcode','colorpicker'].includes(x.kind);
   let inner=content(x,true);
   const children=(byParent?.get(x.id)||[]).map(c=>componentHtml(c,n+2,byParent)).join('\n');
   const childHost=children?`\n${indent(n+1)}<div class="ff-child-host">${children}\n${indent(n+1)}</div>`:'';
   if(direct){
     const nestedInput=['checkbox','radio','switch','fileupload'].includes(x.kind);
     if(nestedInput) inner=inner.replace(/<input\b/,`<input id="${x.name}"${events}${x.enabled===false?' disabled':''}`);
     else inner=inner.replace(/^<([a-zA-Z0-9]+)/,`<$1 id="${x.name}"${events}${pageNav}${x.enabled===false?' disabled':''}`);
     return `${indent(n)}<div class="ff-component ff-kind-${x.kind}" data-flow-id="${x.id}"\n${indent(n+1)}style="left:${x.x}px; top:${x.y}px; width:${x.width}; height:${x.height}; background:${x.bg}; color:${x.color};${x.dock==='top'?' position:absolute; left:0; right:0; top:0; width:100%;':''}${x.dock==='bottom'?' position:absolute; left:0; right:0; bottom:0; width:100%;':''}${x.dock==='left'?' position:absolute; left:0; top:0; bottom:0;':''}${x.dock==='right'?' position:absolute; right:0; top:0; bottom:0;':''}${x.dock==='fill'?' position:absolute; inset:0; width:100%; height:100%;':''}${x.visible===false?' display:none;':''}">\n${indent(n+1)}${inner}${childHost}\n${indent(n)}</div>`;
   }
   return `${indent(n)}<div id="${x.name}"${pageNav}${x.enabled===false?' aria-disabled="true"':''} class="ff-component ff-kind-${x.kind}" data-flow-id="${x.id}"\n${indent(n+1)}style="left:${x.x}px; top:${x.y}px; width:${x.width}; height:${x.height}; background:${x.bg}; color:${x.color};${x.textAlign?` text-align:${x.textAlign};`:''}${x.dock==='top'?' position:absolute; left:0; right:0; top:0; width:100%;':''}${x.dock==='bottom'?' position:absolute; left:0; right:0; bottom:0; width:100%;':''}${x.dock==='left'?' position:absolute; left:0; top:0; bottom:0;':''}${x.dock==='right'?' position:absolute; right:0; top:0; bottom:0;':''}${x.dock==='fill'?' position:absolute; inset:0; width:100%; height:100%;':''}${x.visible===false?' display:none;':''}${x.enabled===false?' pointer-events:none; opacity:.6;':''}"${events}>\n${indent(n+1)}${inner}${childHost}\n${indent(n)}</div>`;
 };
 const pages=project.pages.map((p,i)=>{
   let lines=[`  <section id="page-${i}" data-page-id="${esc(p.id||String(i))}" class="ff-page"${i?' hidden':''}>`];
   if(project.type==='app' && project.siteLayout?.titlebar!==false){const t=project.titlebar||{text:project.name,height:'52px',bg:'#20242a',color:'#fff',showMenu:true};{const custom=t.autoStyle===false?`;background:${t.bg};color:${t.color}`:'';lines.push(`    <div class="ff-app-titlebar ff-title-${project.framework||'none'}" style="height:${t.height}${custom}">`,`      ${titlebarContent(t)}`,`    </div>`);}}
   lines.push(`    <div class="ff-page-surface">`);
   const byParent=new Map();p.items.forEach(x=>{const k=x.parentId||'__root__';if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(x)});const roots=byParent.get('__root__')||p.items.filter(x=>!x.parentId);roots.forEach(x=>lines.push(componentHtml(x,3,byParent)));
   lines.push(`    </div>`,`  </section>`);
   return lines.join('\n');
 }).join('\n');
 const maxw=project.type==='app'?'390px':'1200px';
 const componentRefs=project.pages.flatMap(p=>p.items).filter(x=>x.ffSystem!=='siteChrome'&&/^[A-Za-z_$][\w$]*$/.test(x.name)).map(x=>`window[${JSON.stringify(x.name)}] = FlowForgeComponent(document.getElementById(${JSON.stringify(x.name)})); const ${x.name} = window[${JSON.stringify(x.name)}];`).join('\n');
 const uiRuntime=`window.FlowForgeUI={
 toggleMenu(b){const m=b.parentElement.querySelector('.ff-real-menu');if(m)m.hidden=!m.hidden;},closeMenu(b){const m=b.closest('.ff-real-menu');if(m)m.hidden=true;},toggleFab(b){const m=b.parentElement.querySelector('.ff-fab-menu');if(m)m.hidden=!m.hidden;},
 goPage(el,value){const ok=window.FlowForgeNavigate?window.FlowForgeNavigate(value):false;if(ok){const root=el.closest('nav')||el.closest('.ff-real-navbar');if(root)root.querySelectorAll('[data-page-id]').forEach(x=>x.classList.toggle('active',x.dataset.pageId===String(value)));const menu=el.closest('.ff-real-menu');if(menu)menu.hidden=true;if(el.tagName==='SELECT')el.value=String(value);}},
 navSelect(b){b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{index:[...b.parentElement.children].indexOf(b)}}));},bottomPage(b,id){const ok=window.FlowForgeNavigate?window.FlowForgeNavigate(id):false;if(ok){b.parentElement.querySelectorAll('[data-page-id]').forEach(x=>x.classList.toggle('active',x===b));b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{pageId:id}}));}},
 tab(b,i){const root=b.closest('.ff-real-tabs'),bs=root.querySelectorAll('.ff-tab-buttons button'),ps=root.querySelectorAll('.ff-tab-panel>div');bs.forEach((x,n)=>x.classList.toggle('active',n===i));ps.forEach((x,n)=>x.hidden=n!==i);root.dataset.value=String(i);b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{index:i,value:i}}));},
 toggleDrawer(b){const r=b.closest('.ff-real-drawer');r.classList.toggle('open');},toggleSheet(b){const r=b.closest('.ff-real-bottomsheet'),body=r.querySelector('.ff-sheet-body');if(body)body.hidden=!body.hidden;r.classList.toggle('open');},
 page(b,direction){const nav=b.closest('.ff-real-pagination'),links=[...nav.querySelectorAll('[data-page-id]')];if(!links.length)return;let i=links.findIndex(x=>x.classList.contains('active'));if(b.dataset.pageId){i=links.indexOf(b);}else{i=Math.max(0,Math.min(links.length-1,i+(direction<0?-1:1)));}const target=links[i];if(target){const id=target.dataset.pageId;if(window.FlowForgeNavigate)window.FlowForgeNavigate(id);links.forEach(x=>{const on=x===target;x.classList.toggle('active',on);x.setAttribute('aria-current',on?'page':'false');});target.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{page:i+1,pageId:id}}));}},
 selectItem(b){const r=b.parentElement;r.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{index:Number(b.dataset.index||0),value:b.textContent.trim()}}));},
 rate(b,n){const r=b.parentElement;r.querySelectorAll('button').forEach((x,i)=>{const on=i<n;x.classList.toggle('selected',on);x.setAttribute('aria-checked',String(i===n-1));});r.dataset.value=String(n);b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{value:n}}));},
 step(b,d){const r=b.closest('.ff-real-stepper');let n=Math.max(1,Math.min(3,Number(r.dataset.step||1)+d));r.dataset.step=String(n);r.querySelector('[data-step-label]').textContent=n;b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{value:n}}));},
 carousel(b,d){const r=b.closest('.ff-real-carousel'),slides=[...r.querySelectorAll('.ff-carousel-slides>div')];let n=Number(r.dataset.index||0)+d;n=(n+slides.length)%slides.length;r.dataset.index=String(n);slides.forEach((x,i)=>x.hidden=i!==n);b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{index:n}}));},
 toggleLed(b){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.classList.toggle('on',on);b.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{value:on}}));},
 sparkline(c){const g=c.getContext('2d');if(!g)return;g.clearRect(0,0,c.width,c.height);g.strokeStyle='currentColor';g.lineWidth=3;let a=String(c.dataset.values||'').split(/[ ,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);if(a.length<2)a=[.35,.2,.55,.42,.8,.5,.7,.45,.9];else{const lo=Math.min(...a),hi=Math.max(...a);a=a.map(v=>hi>lo?(v-lo)/(hi-lo):.5)}g.beginPath();a.forEach((v,i)=>{const x=5+i*(c.width-10)/(a.length-1),y=10+(1-v)*(c.height-20);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();if(!c.__ffSpark){c.__ffSpark=new MutationObserver(()=>FlowForgeUI.sparkline(c));c.__ffSpark.observe(c,{attributes:true,attributeFilter:['data-values']})}},
 init(root=document){root.querySelectorAll('canvas[data-ff-chart]').forEach(c=>{const g=c.getContext('2d');if(!g)return;g.clearRect(0,0,c.width,c.height);g.strokeStyle='#64748b';g.lineWidth=3;const a=[.25,.55,.4,.78,.62,.9,.68];g.beginPath();a.forEach((v,i)=>{const x=30+i*(c.width-60)/(a.length-1),y=25+(1-v)*(c.height-55);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();g.fillStyle='#64748b';a.forEach((v,i)=>{const x=30+i*(c.width-60)/(a.length-1),y=25+(1-v)*(c.height-55);g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.fill()})});root.querySelectorAll('canvas[data-ff-sparkline]').forEach(c=>FlowForgeUI.sparkline(c));root.querySelectorAll('.ff-real-dialog').forEach(d=>{if(d.dataset.autoOpen==='true'&&!d.open)d.showModal()});}
};FlowForgeUI.init();`;
 const pageRuntime=`function FlowForgeNavigate(value){const pages=[...document.querySelectorAll('.ff-page')];let raw=String(value??'');raw=raw.replace(/^#\\/page\\//,'').replace(/^#\\//,'');let target=pages.find(p=>String(p.dataset.pageId)===raw||String(p.id)===raw);if(!target){const meta=window.__FLOWFORGE_PAGES__||[];const m=meta.find(x=>String(x.id)===raw||String(x.slug)===raw||String(x.name)===raw);if(m)target=pages.find(p=>String(p.dataset.pageId)===String(m.id));}if(!target)return false;pages.forEach(p=>{const on=p===target;p.classList.toggle('hidden',!on);p.hidden=!on});const meta=(window.__FLOWFORGE_PAGES__||[]).find(x=>String(x.id)===String(target.dataset.pageId));if(meta&&history&&history.pushState){const route='#/page/'+encodeURIComponent(meta.slug||meta.id);if(location.hash!==route)history.pushState({flowforgePage:meta.id},'',route)}window.scrollTo({top:0,behavior:'smooth'});return true;}window.FlowForgeNavigate=FlowForgeNavigate;window.ffNavigate=FlowForgeNavigate;function ffRouteFromHash(){const h=decodeURIComponent(location.hash||'');if(h.startsWith('#/page/'))FlowForgeNavigate(h.slice(7));}window.addEventListener('hashchange',ffRouteFromHash);window.addEventListener('popstate',ffRouteFromHash);ffRouteFromHash();`;
 const timerBoot=project.pages.flatMap(p=>p.items).filter(x=>x.kind==='timer'&&x.enabled!==false).map(x=>`FlowForgeTimer.start({id:${JSON.stringify(x.id)},name:${JSON.stringify(x.name)},interval:${Number(x.interval)||1000},oneShot:${!!x.oneShot},enabled:true,events:{tick:${x.events&&x.events.tick?JSON.stringify(x.name+'_tick(event)'):'""'}}});`).join('\n');
 const eventCode=project.pages.flatMap(p=>p.items).flatMap(x=>Object.entries(x.events||{}).map(([ev,body])=>`${eventMarker(x,ev)}\nasync function ${x.name}_${ev}(event) {\n${String(body||'').split('\n').map(line=>'    '+line).join('\n')}\n}\n// @flow-event-end:${x.id}:${ev}`)).join('\n\n');
 return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(project.name)}</title>
  <meta name="application-name" content="${esc(project.name)}">
  <meta name="apple-mobile-web-app-title" content="${esc(project.name)}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="theme-color" content="${esc(project.themeColor||'#20242a')}">
  ${project.favicon?`<link rel="icon"${ffLinkType(resolveProjectImageRef(project.favicon))} href="${esc(resolveProjectImageRef(project.favicon))}">`:''}
  ${project.icon?`<link rel="apple-touch-icon" href="${esc(resolveProjectImageRef(project.icon))}">`:''}
  ${project.icon?`<link rel="icon" sizes="192x192"${ffLinkType(resolveProjectImageRef(project.icon))} href="${esc(resolveProjectImageRef(project.icon))}">`:''}
  ${frameworkHead()}
  <style>
    .ff-page.hidden{display:none!important}.ff-kind-listbox select{padding:6px}.ff-page-nav{width:100%;height:100%;padding:8px;border:1px solid #cfd5db;border-radius:6px;background:#fff}.ff-kind-combobox select{width:100%;height:100%}
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .ff-page { position: relative; min-height: 100vh; width: 100%; max-width: ${maxw}; margin: 0 auto; overflow: visible; background: #fff; }
    .ff-page-surface { position: ${project.type==='app'?'absolute':'relative'}; top: 0; left: 0; min-height: 100vh; width: 100%; overflow: visible; }
    .ff-real-header{height:100%;display:flex;align-items:center;padding:0 24px;background:#111827;color:#fff;font-size:22px;font-weight:700}.ff-header-brand{display:flex;align-items:center;gap:12px;min-width:0}.ff-header-logo{display:block;max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain}.ff-real-header .ff-header-logo{flex:0 0 auto} .ff-real-navbar{display:flex !important;align-items:stretch !important;justify-content:center !important;gap:4px !important;width:100% !important;height:100% !important;background:#1f2937 !important;color:#fff !important;padding:6px 16px !important;overflow:auto !important}.ff-real-navbar button{display:inline-flex !important;align-items:center !important;justify-content:center !important;box-sizing:border-box !important;border:0 !important;background:transparent !important;color:#fff !important;padding:8px 16px !important;border-radius:6px !important;cursor:pointer !important;white-space:nowrap !important;font:inherit !important}.ff-real-navbar button:hover,.ff-real-navbar button.active{background:#374151 !important;color:#fff !important}.ff-real-tabs{width:100% !important;height:100% !important;background:transparent !important;color:inherit !important}.ff-tab-buttons{display:flex !important;align-items:stretch !important;gap:0 !important;width:100% !important;height:100% !important;border-bottom:1px solid #ddd !important;background:transparent !important}.ff-tab-buttons button{display:inline-flex !important;align-items:center !important;justify-content:center !important;box-sizing:border-box !important;border:0 !important;border-bottom:2px solid transparent !important;background:transparent !important;color:inherit !important;padding:8px 16px !important;cursor:pointer !important;font:inherit !important;white-space:nowrap !important}.ff-tab-buttons button.active{border-bottom-color:currentColor !important;font-weight:700 !important} .ff-real-footer{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;width:100%;height:100%;background:#111827;color:#fff;padding:14px 20px} .ff-real-footer button{border:0;background:transparent;color:#fff;padding:7px 12px;border-radius:5px;cursor:pointer}.ff-real-footer button:hover,.ff-real-footer button.active{background:#374151}
    .ff-app-titlebar { width:100%; height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; background: #212529; color: #fff; font-weight: 600; position: relative; z-index: 10000; }
    .ff-component { position: absolute; min-width: 24px; min-height: 20px; } .ff-child-host{position:absolute;inset:0;overflow:visible;pointer-events:none}.ff-child-host>.ff-component{pointer-events:auto}
    .ff-component button, .ff-component input, .ff-component textarea, .ff-component select { max-width: 100%; }
    .ff-kind-button > button, .ff-kind-input > input, .ff-kind-textarea > textarea, .ff-kind-select > select, .ff-kind-date > input, .ff-kind-time > input, .ff-kind-range > input { width:100%; height:100%; }
    .ff-kind-checkbox > label, .ff-kind-radio > label { display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; margin: 0; white-space: nowrap; }
    .ff-kind-checkbox input[type="checkbox"], .ff-kind-radio input[type="radio"] { width: 16px; height: 16px; min-width: 16px; margin: 0; flex: 0 0 16px; }
    .ff-kind-switch > .sw { display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; margin: 0; white-space: nowrap; }
  .sw { position: relative; }
  .sw input { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
  .sw i { width: 34px; height: 18px; border-radius: 12px; background: #aaa; display: inline-block; position: relative; flex: none; transition: background .15s; }
  .sw i:after { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: left .15s; }
  .sw input:checked + i { background: #22c55e; }
  .sw input:checked + i:after { left: 18px; }
  .sw input:focus-visible + i { outline: 2px solid #568cff; outline-offset: 2px; }
    .ff-kind-card, .ff-kind-container, .ff-kind-section, .ff-kind-form, .ff-kind-row, .ff-kind-columns { border: 1px solid #ddd; border-radius: 10px; padding: 12px; }
    .ph { width: 100%; height: 100%; display: grid; place-items: center; background: #eee; }
    .ff-nav { display: flex; justify-content: space-around; align-items: center; height: 100%; }
    .ff-progress { height: 12px; background: #ddd; border-radius: 8px; overflow: hidden; }
    .ff-progress i { display: block; width: 65%; height: 100%; background: #777; }
    .ff-component table { border-collapse: collapse; width: 100%; }
    .ff-component td, .ff-component th { border: 1px solid #bbb; padding: 4px; }
    .ff-badge { padding: 3px 8px; border-radius: 10px; background: #555; color: #fff; }
    .ff-fab { border-radius: 50%; width: 100%; height: 100%; }
    .ff-modal { border: 1px solid #bbb; border-radius: 8px; padding: 10px; background: #fff; }
    .ff-title-bootstrap { background:#212529; color:#fff; padding:0 16px; box-shadow:0 2px 5px #0002; }
    .ff-title-bulma { background:#00d1b2; color:#fff; padding:0 1rem; }
    .ff-title-pico { background:#0172ad; color:#fff; padding:0 1rem; border-bottom:1px solid #015f91; }
    .ff-title-none { background:#20242a; color:#fff; padding:0 16px; }
    .ff-titlebrand { display:flex; align-items:center; gap:8px; } .ff-titlemenu{font-size:8px;letter-spacing:3px;opacity:.7}
    .ff-battery{height:100%;display:flex;align-items:center;gap:10px}.ff-battery>span{width:68%;height:24px;border:2px solid currentColor;border-radius:5px;padding:3px;position:relative}.ff-battery>span:after{content:'';position:absolute;right:-6px;top:6px;width:4px;height:8px;background:currentColor;border-radius:0 2px 2px 0}.ff-battery i{display:block;height:100%;background:#22c55e;border-radius:2px}.ff-thermo{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}.ff-thermo>span{width:18px;height:105px;border:3px solid currentColor;border-radius:12px;position:relative;padding:3px;display:flex;align-items:flex-end}.ff-thermo>span:after{content:'';position:absolute;width:30px;height:30px;border-radius:50%;background:#ef4444;bottom:-18px;left:-9px}.ff-thermo i{width:100%;height:62%;background:#ef4444;border-radius:8px}.ff-led{height:100%;display:flex;align-items:center;gap:8px}.ff-led i{width:14px;height:14px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e}.ff-sevenseg{height:100%;display:grid;place-items:center;background:#171717;color:#ff3b30;font:700 34px monospace;letter-spacing:5px;border-radius:8px}.ff-dotmatrix{height:100%;display:grid;place-items:center;background:#111;color:#39ff88;font:700 24px monospace;letter-spacing:6px;border-radius:6px;text-shadow:0 0 8px currentColor}.ff-spark{height:100%;padding:8px;display:flex;flex-direction:column}.ff-spark svg{width:100%;height:100%}.ff-spark polyline{fill:none;stroke:currentColor;stroke-width:2}.ff-valuecard,.ff-statuscard,.ff-glasspanel{height:100%;padding:14px;border-radius:14px}.ff-valuecard{display:flex;flex-direction:column;box-shadow:0 4px 18px #0002}.ff-valuecard strong{font-size:28px}.ff-valuecard span{color:#16a34a}.ff-statuscard{display:flex;align-items:center;gap:12px;box-shadow:0 4px 18px #0002}.ff-statuscard>i{width:14px;height:14px;border-radius:50%;background:#22c55e}.ff-statuscard small,.ff-glasspanel small{display:block;opacity:.65}.ff-glasspanel{background:linear-gradient(135deg,#ffffff80,#ffffff25);backdrop-filter:blur(10px);border:1px solid #ffffff70;box-shadow:0 8px 30px #0002}.ff-gradientbutton,.ff-iconbutton{width:100%;height:100%;border:0;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px}.ff-iconbutton{border-radius:50%;font-size:20px}.ff-mobilelist{height:100%;overflow:hidden;border:1px solid #ddd;border-radius:12px}.ff-mobilelist>div{padding:10px 12px;border-bottom:1px solid #eee;position:relative}.ff-mobilelist small{display:block;opacity:.6}.ff-mobilelist span{position:absolute;right:12px;top:18px;font-size:22px}

    .ff-real-navbar,.ff-real-toolbar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;height:100%;box-sizing:border-box}.ff-real-navbar button,.ff-real-toolbar button,.ff-real-bottomnav button,.ff-real-pagination button,.ff-real-list button,.ff-real-stepper button,.ff-real-carousel>button,.ff-real-rating button,.ff-real-led,.ff-real-iconbutton,.ff-real-gradient{cursor:pointer}.ff-real-menu{position:absolute;right:4px;top:100%;z-index:20;display:grid;background:#fff;border:1px solid #ddd;box-shadow:0 8px 24px #0002}.ff-real-menu button{padding:8px 14px;border:0;background:#fff;text-align:left}.ff-real-bottomnav{display:flex;justify-content:space-around;align-items:center;height:100%;padding:4px}.ff-real-bottomnav button{border:0;background:transparent;display:grid;gap:2px;place-items:center}.ff-real-bottomnav small{font-size:10px}.ff-tab-buttons{display:flex;border-bottom:1px solid #ddd}.ff-tab-buttons button{border:0;background:transparent;padding:8px 12px}.ff-tab-buttons button.active{border-bottom:2px solid currentColor;font-weight:700}.ff-tab-panel{padding:10px}.ff-real-drawer{height:100%;overflow:auto}.ff-real-drawer>button{width:100%;padding:10px;border:0;text-align:left}.ff-drawer-body{display:grid;gap:4px;padding:8px}.ff-drawer-body button{padding:8px;text-align:left}.ff-real-drawer-collapsible:not(.open) .ff-drawer-body{display:none}.ff-real-sidebar{height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:auto;background:var(--ff-nav-bg,#f8fafc);color:var(--ff-nav-color,#111827);border-right:1px solid rgba(100,116,139,.25)}.ff-sidebar-title{flex:0 0 auto;padding:12px 14px;font-weight:700;border-bottom:1px solid rgba(100,116,139,.2)}.ff-sidebar-nav{display:grid;gap:3px;padding:8px}.ff-sidebar-nav button{display:block;width:100%;box-sizing:border-box;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.ff-sidebar-nav button:hover{background:rgba(100,116,139,.12)}.ff-sidebar-nav button.active{background:rgba(59,130,246,.16);font-weight:700}.ff-real-bottomsheet{height:100%;overflow:auto}.ff-real-bottomsheet>button{width:100%;padding:10px;border:0}.ff-sheet-body{padding:10px}.ff-real-pagination{display:flex;gap:4px;justify-content:center;align-items:center}.ff-real-pagination button{border:1px solid #ddd;background:#fff;padding:6px 10px}.ff-real-pagination button.active{font-weight:700;background:#eee}.ff-real-list{display:grid;gap:1px}.ff-real-list button{position:relative;text-align:left;border:0;border-bottom:1px solid #eee;background:#fff;padding:10px 28px 10px 10px}.ff-real-list button small{display:block;opacity:.6}.ff-real-list button span{position:absolute;right:10px;top:12px}.ff-real-list button.selected{background:#eef6ff}.ff-real-table-wrap{overflow:auto}.ff-real-table{border-collapse:collapse;width:100%}.ff-real-table th,.ff-real-table td{border:1px solid #bbb;padding:6px;text-align:left}.ff-real-calendar{display:grid;gap:8px;padding:10px}.ff-real-calendar input{width:100%;box-sizing:border-box}.ff-real-tree details{margin-left:10px;padding:4px}.ff-real-card{height:100%;box-sizing:border-box;padding:14px;display:grid;gap:8px;border:1px solid #ddd;border-radius:12px}.ff-real-card strong{font-size:28px}.ff-real-rating{display:flex;gap:3px;align-items:center;justify-content:center;height:100%}.ff-real-rating button{border:0;background:transparent;font-size:28px;opacity:.35}.ff-real-rating button.selected{opacity:1}.ff-real-timeline{margin:0;padding:12px 28px}.ff-real-timeline li{margin:8px 0}.ff-real-stepper{display:flex;align-items:center;justify-content:center;gap:12px;height:100%}.ff-real-dialog{border:0;border-radius:12px;padding:20px;box-shadow:0 12px 50px #0004}.ff-real-dialog::backdrop{background:#0006}.ff-real-toast{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;background:#222;color:#fff;border-radius:8px}.ff-real-upload{display:grid;place-items:center;height:100%;cursor:pointer;border:1px dashed #999}.ff-real-upload input{display:none}.ff-real-led{display:flex;align-items:center;gap:8px;border:0;background:transparent}.ff-real-led i{width:14px;height:14px;border-radius:50%;background:#aaa}.ff-real-led.on i{background:#22c55e;box-shadow:0 0 10px #22c55e}.ff-real-sevenseg,.ff-real-dotmatrix{display:grid;place-items:center;height:100%;font-family:monospace;font-size:28px}.ff-real-glass{height:100%;box-sizing:border-box;padding:14px;border-radius:14px;background:#ffffff55;backdrop-filter:blur(10px);border:1px solid #ffffff88}.ff-real-gradient{width:100%;height:100%;border:0;border-radius:10px;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6)}.ff-real-iconbutton{width:100%;height:100%;border:0;border-radius:50%;font-size:20px}.ff-real-tooltip{padding:8px;border:1px solid #ccc;background:#fff;border-radius:6px}.ff-real-carousel{display:flex;align-items:center;gap:8px;height:100%}.ff-carousel-slides{flex:1;text-align:center;padding:20px}.ff-real-led:disabled,.ff-real-gradient:disabled,.ff-real-iconbutton:disabled{opacity:.5}
  </style>
</head>
<body>
${pages}

<script>
/* FlowForge WebStudio v0.13.0 */
window.__FLOWFORGE_PAGES__ = ${JSON.stringify(project.pages.map(p=>({id:p.id,name:p.name,slug:p.slug})))};
${pageRuntime}
${uiRuntime}
${window.FlowForgeRuntimeSource||""}
const FlowForgeComponent = (root) => {
  if (!root) return root;
  const wrapper = root.classList?.contains('ff-component') ? root : root.closest?.('.ff-component');
  const kind = [...(wrapper?.classList||[])].find(c=>c.startsWith('ff-kind-'))?.slice(8) || root.tagName?.toLowerCase() || '';
  const semantic = root.classList?.contains('ff-component') ? root.querySelector?.('[data-ff-control],button,input,textarea,select,video,audio,img,iframe,canvas,dialog') : root;
  const isCard = ['statcard','valuecard','statuscard'].includes(kind);
  /* cards: .textContent / .style act on the card label (<small>), not on the decorative "Detalhes" button */
  const target = (isCard && wrapper?.querySelector?.('small')) || semantic || root;
  if(kind==='qrcode' && target?.dataset){
    target.dataset.ffQrText=target.dataset.ffQrText ?? target.alt?.replace(/^QR Code: /,'') ?? '';
    target.dataset.ffQrSize=target.dataset.ffQrSize ?? '160';
  }
  return new Proxy(root,{
    get(obj,prop){
      if(prop==='root') return wrapper||root;
      if(prop==='control') return target;
      if(isCard && prop==='value') return wrapper.querySelector('strong')?.textContent ?? '';
      if(kind==='sparkline' && prop==='dataset') return target.dataset;
      if(kind==='sparkline' && prop==='values') return target.dataset.values || '';
      if(kind==='http' && window.http && ['request','get','post','put','patch','delete'].includes(prop)) return window.http[prop].bind(window.http);
      if(['select','combobox','listbox'].includes(kind) && prop==='items') return Array.from(target.options||[]).map(o=>({text:o.textContent,value:o.value}));
      if(['select','combobox','listbox'].includes(kind) && prop==='selectedIndex') return target.selectedIndex;
      if(['select','combobox','listbox'].includes(kind) && prop==='selectedItem') { const o=target.options?.[target.selectedIndex]; return o?{text:o.textContent,value:o.value,index:target.selectedIndex}:null; }
      if(['select','combobox','listbox'].includes(kind) && ['addItem','removeItem','clearItems'].includes(prop)) {
        if(prop==='addItem') return (text,value)=>{
          const o=document.createElement('option');
          o.textContent=String(text??value??'');
          o.value=String(value??text??'');
          target.appendChild(o);
          if(kind==='listbox')target.size=Math.min(8,Math.max(3,target.options.length));
          target.dispatchEvent(new Event('change',{bubbles:true}));
          return o;
        };
        if(prop==='removeItem') return value=>{
          const i=Array.from(target.options||[]).findIndex(o=>String(o.value)===String(value));
          if(i>=0){target.remove(i);target.dispatchEvent(new Event('change',{bubbles:true}));}
          return i>=0;
        };
        return ()=>{
          target.replaceChildren();
          if(kind==='listbox')target.size=3;
          target.dispatchEvent(new Event('change',{bubbles:true}));
        };
      }
      if(prop==='textContent' || prop==='innerText') {
        if(kind==='qrcode' && prop==='textContent') return target.dataset?.ffQrText ?? '';
        return target[prop];
      }
      if(prop==='value' && 'value' in target) return target.value;
      if(prop==='style') return target.style;
      if(prop==='classList') return target.classList;
      if(prop==='visible') return (wrapper||root).style.display !== 'none';
      if(prop==='enabled') return !((wrapper||root).style.pointerEvents === 'none');
      if(prop==='dock') return (wrapper||root).dataset.ffDock || 'none';
      if((prop==='showModal'||prop==='close'||prop==='requestClose') && typeof target[prop]==='function') return target[prop].bind(target);
      const v=Reflect.get(obj,prop,obj);
      return typeof v==='function'?v.bind(obj):v;
    },
    set(obj,prop,value){
      if(isCard && prop==='value'){ const st=wrapper.querySelector('strong'); if(st) st.textContent=String(value ?? ''); return true; }
      if(kind==='sparkline' && prop==='values'){ target.dataset.values=Array.isArray(value)?value.join(','):String(value ?? ''); return true; }
      if(['select','combobox','listbox'].includes(kind) && prop==='items') { const list=Array.isArray(value)?value:[]; target.innerHTML=''; list.forEach(o=>{const it=(o&&typeof o==='object')?o:{text:String(o),value:o};const opt=document.createElement('option');opt.value=String(it.value??it.text??'');opt.textContent=String(it.text??it.value??'');target.appendChild(opt);}); if(kind==='listbox')target.size=Math.min(8,Math.max(3,list.length||3)); return true; }
      if(['select','combobox','listbox'].includes(kind) && prop==='selectedIndex'){ target.selectedIndex=Number(value)||0; return true; }
      if(['select','combobox','listbox'].includes(kind) && prop==='selectedItem'){ const v=value&&typeof value==='object'?value.value:value; const i=Array.from(target.options||[]).findIndex(o=>String(o.value)===String(v)); if(i>=0)target.selectedIndex=i; return true; }
      if(prop==='textContent' || prop==='innerText'){
        if(kind==='qrcode' && prop==='textContent'){
          const text=String(value??'');
          target.dataset.ffQrText=text;
          const size=Math.max(64,Math.min(2048,Number(target.dataset.ffQrSize)||160));
          target.alt='QR Code: '+text;
          target.src='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text);
          return true;
        }
        target[prop]=value; return true;
      }
      if(prop==='value' && 'value' in target){ target.value=value; return true; }
      if(prop==='qrcodeSize' && kind==='qrcode'){
        const size=Math.max(64,Math.min(2048,Number(value)||160));
        target.dataset.ffQrSize=String(size);
        const text=target.dataset.ffQrText ?? '';
        target.src='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text);
        return true;
      }
      if(['disabled','checked','src'].includes(prop) && prop in target){ target[prop]=value; return true; }
      if(prop==='visible'){ (wrapper||root).style.display = value===false ? 'none' : ''; return true; }
      if(prop==='enabled'){ const el=wrapper||root; const off=value===false; el.style.pointerEvents=off?'none':''; el.style.opacity=off?'.6':''; el.setAttribute('aria-disabled',off?'true':'false'); if('disabled' in target) target.disabled=off; return true; }
      if(prop==='dock'){ const el=wrapper||root; el.dataset.ffDock=String(value||'none'); el.style.position='absolute'; ['top','right','bottom','left'].forEach(k=>el.style[k]=''); el.style.width=''; if(value==='top'){el.style.left='0';el.style.right='0';el.style.top='0';el.style.width='100%';}else if(value==='bottom'){el.style.left='0';el.style.right='0';el.style.bottom='0';el.style.width='100%';}else if(value==='left'){el.style.left='0';el.style.top='0';el.style.bottom='0';}else if(value==='right'){el.style.right='0';el.style.top='0';el.style.bottom='0';}else if(value==='fill'){el.style.left='0';el.style.right='0';el.style.top='0';el.style.bottom='0';el.style.width='100%';el.style.height='100%';}else{el.style.left=(el.dataset.ffX||'')||'';el.style.top=(el.dataset.ffY||'')||'';el.style.width=(el.dataset.ffWidth||'')||'';el.style.height=(el.dataset.ffHeight||'')||'';} return true; }
      return Reflect.set(obj,prop,value,obj);
    }
  });
};

// Inicializa propriedades que não possuem atributo HTML equivalente direto.
document.querySelectorAll('audio[data-ff-volume], video[data-ff-volume]').forEach(el=>{const v=Number(el.dataset.ffVolume);if(Number.isFinite(v))el.volume=Math.max(0,Math.min(1,v));});

${componentRefs}

const FlowForgeCamera=(()=>{const streams=new Map();const el=id=>typeof id==='string'?document.getElementById(id):id;function stop(id){const v=el(id);if(!v)return;const s=streams.get(v)||v.srcObject;if(s?.getTracks)s.getTracks().forEach(t=>t.stop());streams.delete(v);v.srcObject=null;v.dispatchEvent(new Event('camerastop'))}async function start(id,o={}){const v=el(id);if(!v)throw new Error('Camera não encontrada');if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera requer HTTPS ou localhost');stop(v);try{const s=await navigator.mediaDevices.getUserMedia({audio:!!o.audio,video:{facingMode:o.facingMode||'environment',width:o.width?{ideal:+o.width}:undefined,height:o.height?{ideal:+o.height}:undefined}});streams.set(v,s);v.srcObject=s;v.playsInline=true;v.muted=o.muted!==false;await v.play().catch(()=>{});v.dispatchEvent(new CustomEvent('camerastart',{detail:{stream:s}}));return s}catch(error){v.dispatchEvent(new CustomEvent('cameraerror',{detail:{error}}));throw error}}function capture(id,type='image/png',quality=.92){const v=el(id);if(!v?.videoWidth)throw new Error('A câmera ainda não possui imagem');const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL(type,quality)}async function devices(){if(!navigator.mediaDevices?.enumerateDevices)return[];return(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput')}return{start,stop,capture,devices}})();window.FlowForgeCamera=FlowForgeCamera;

const FlowForgeTimer=(()=>{const timers=new Map();const key=t=>t.id||t.name;function stop(t){const k=key(t),h=timers.get(k);if(h){clearInterval(h);clearTimeout(h);timers.delete(k)}}function fire(t){const code=t.events&&(t.events.tick||t.events.Tick)||'';if(!code)return;try{new Function('component','project',code)(t,window.project)}catch(e){console.error('Timer '+t.name,e)}}function start(t){stop(t);if(t.enabled===false)return;let ms=Math.max(10,Number(t.interval)||1000),k=key(t);if(t.oneShot){timers.set(k,setTimeout(()=>{timers.delete(k);fire(t)},ms))}else timers.set(k,setInterval(()=>fire(t),ms))}function stopAll(){timers.forEach(h=>{clearInterval(h);clearTimeout(h)});timers.clear()}addEventListener('beforeunload',stopAll);return{start,stop,restart:start,stopAll}})();
window.FlowForgeTimer=FlowForgeTimer;

const FlowForgeProgress={_bar(id){const outer=typeof id==='string'?document.getElementById(id):id;if(!outer)return null;return outer.classList&&outer.classList.contains('ff-progress')?outer:(outer.querySelector&&outer.querySelector('.ff-progress')||outer)},set(id,value){const el=this._bar(id);if(!el)return;let min=Number(el.dataset.min??el.getAttribute('aria-valuemin')??0),max=Number(el.dataset.max??el.getAttribute('aria-valuemax')??100),v=Math.max(min,Math.min(max,Number(value))),p=max>min?(v-min)/(max-min)*100:0;el.dataset.value=v;el.setAttribute('aria-valuenow',v);const bar=el.querySelector('i');if(bar)bar.style.setProperty('width',p+'%');const t=el.querySelector('span');if(t)t.textContent=Math.round(p)+'%';el.dispatchEvent(new CustomEvent('change',{detail:{value:v,percent:p}}));if(v>=max)el.dispatchEvent(new CustomEvent('complete',{detail:{value:v}}))},increment(id,step=1){const el=this._bar(id);this.set(el,Number(el&&(el.dataset.value??el.getAttribute('aria-valuenow'))||0)+Number(step))}};
window.FlowForgeProgress=FlowForgeProgress;

${timerBoot}

${eventCode}
<\/script>
</body>
</html>`;
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function syntaxHighlight(code){
 // Tokenizador de uma unica passagem. Nao aplica regex sobre o HTML dos spans,
 // evitando corromper o fonte exibido (ex.: class="syn-str" aparecendo no editor).
 const token=/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|<\/?[A-Za-z][^>]*>|\b(?:function|const|let|var|return|if|else|for|while|new|true|false|null|undefined|async|await|class|this|document|window)\b|\b\d+(?:\.\d+)?\b/g;
 let out='', last=0, m;
 while((m=token.exec(code))){
   out+=esc(code.slice(last,m.index));
   const t=m[0]; let cls='';
   if(t.startsWith('//')||t.startsWith('/*')||t.startsWith('<!--')) cls='syn-comment';
   else if(t[0]==='"'||t[0]==="'") cls='syn-str';
   else if(t[0]==='<') cls='syn-tag';
   else if(/^\d/.test(t)) cls='syn-num';
   else cls='syn-key';
   out+='<span class="'+cls+'">'+esc(t)+'</span>';
   last=token.lastIndex;
 }
 return out+esc(code.slice(last))+'\n';
}
function syncCodeHighlight(){let ta=$('#code'),pre=$('#codeHighlight'),nums=$('#codeLines');pre.innerHTML=syntaxHighlight(ta.value);pre.scrollTop=ta.scrollTop;pre.scrollLeft=ta.scrollLeft;if(nums){let n=ta.value.split('\n').length;nums.textContent=Array.from({length:n},(_,i)=>i+1).join('\n');nums.scrollTop=ta.scrollTop}}
function saveEventBodiesFromEditor(){let code=$('#code').value;project.pages.flatMap(p=>p.items).forEach(x=>Object.keys(x.events||{}).forEach(ev=>{let a=code.indexOf(eventMarker(x,ev));if(a<0)return;let fn=code.indexOf('function ',a),brace=code.indexOf('{',fn),endMark=`// @flow-event-end:${x.id}:${ev}`,end=code.indexOf(endMark,brace);if(brace<0||end<0)return;let body=code.slice(brace+1,end).replace(/^\s*\n/,'').replace(/\n\s*}\s*$/,'').split('\n').map(line=>line.startsWith('    ')?line.slice(4):line).join('\n');x.events[ev]=body.replace(/\s+$/,'')+'\n'}))}
function updateCode(){let c=generated();$('#code').value=c;syncCodeHighlight();const pv=$('#preview');if(getComputedStyle(pv).display!=='none')pv.srcdoc=window.FlowForgeImageAssets?.resolveHtml?.(c)??c}
function duplicate(){if(!selected)return;snapshot();let x=JSON.parse(JSON.stringify(selected));x.id=uid();x.name=uniqueName(x.kind,(x.name||x.kind)+'_copy');x.x=(Number(x.x)||0)+16;x.y=(Number(x.y)||0)+16;project.pages[project.active].items.push(x);selected=x;render()}function del(){if(!selected)return;snapshot();let a=project.pages[project.active].items;a.splice(a.findIndex(x=>x.id===selected.id),1);selected=null;render()}


Object.defineProperty(window,'selected',{get:()=>selected,set:v=>selected=v,configurable:true});window.EVENT_OPTIONS=EVENT_OPTIONS;window.defaultEvent=defaultEvent;window.updateCode=updateCode;window.ffItems=ffItems;window.ffSelected=()=>selected;window.FlowForgeRegistry=FlowForgeRegistry;
// -----------------------------------------------------------------------------
// EXEMPLOS DIDÁTICOS
// Cada exemplo é um projeto FlowForge normal. O objetivo é permitir que quem
// ainda não conhece JavaScript abra o evento pelo duplo clique e aprenda lendo.
// -----------------------------------------------------------------------------
function exItem(kind,name,text,x,y,w,h,eventBody){
  const item={id:uid(),kind,name,text,x,y,width:w+'px',height:h+'px',bg:'#ffffff',color:'#222222',events:{}};
  if(eventBody!==undefined)item.events[defaultEvent(kind)]=eventBody;
  return item;
}
function exampleProject(key){
 if(key==='snake')return {"name":"Snake","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"cf631d05-a2b7-42de-a7b4-fe29318fbfe5","name":"Jogo","items":[{"id":"540027b9-9e76-408f-aee3-df6b2f5da016","kind":"heading","name":"snakeTitle","text":"Snake","x":145,"y":18,"width":"100px","height":"40px","bg":"transparent","color":"#111827","events":{}},{"id":"4d016c65-56cd-4415-8a7f-1b2d88d00f8a","kind":"label","name":"snakeStatus","text":"Clique em Iniciar","x":90,"y":60,"width":"210px","height":"32px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"3925ac00-1aaf-4764-b0f9-d0492ae848ca","kind":"textarea","name":"snakeBoard","text":"","x":20,"y":105,"width":"350px","height":"245px","bg":"#0f172a","color":"#86efac","events":{}},{"id":"2ec61ab3-e4cd-4020-9126-7a55a774e68a","kind":"button","name":"snakeUp","text":"↑","x":165,"y":365,"width":"60px","height":"45px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffSnake){let d=window.ffSnake.dir;if(!(0===-d[0]&&-1===-d[1]))window.ffSnake.dir=[0,-1]}"}},{"id":"ab3f86fd-3821-4aee-a7ef-be5c5b80755b","kind":"button","name":"snakeLeft","text":"←","x":95,"y":415,"width":"60px","height":"45px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffSnake){let d=window.ffSnake.dir;if(!(-1===-d[0]&&0===-d[1]))window.ffSnake.dir=[-1,0]}"}},{"id":"3a83dcd6-9d56-4b0c-bfc9-dadee3c2c00a","kind":"button","name":"snakeDown","text":"↓","x":165,"y":415,"width":"60px","height":"45px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffSnake){let d=window.ffSnake.dir;if(!(0===-d[0]&&1===-d[1]))window.ffSnake.dir=[0,1]}"}},{"id":"3cdd280a-d908-43db-8e43-332725893485","kind":"button","name":"snakeRight","text":"→","x":235,"y":415,"width":"60px","height":"45px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffSnake){let d=window.ffSnake.dir;if(!(1===-d[0]&&0===-d[1]))window.ffSnake.dir=[1,0]}"}},{"id":"827eb03c-0008-43e4-974f-fcfc2631777d","kind":"button","name":"snakeStart","text":"Iniciar / Reiniciar","x":105,"y":475,"width":"180px","height":"44px","bg":"#16a34a","color":"#fff","events":{"click":"clearInterval(window.ffSnakeTimer);window.ffSnake={body:[[5,5],[4,5],[3,5]],dir:[1,0],food:[10,5],score:0};const box=document.getElementById('snakeBoard'),st=document.getElementById('snakeStatus');function draw(){let g=Array.from({length:12},()=>Array(16).fill(''));let q=window.ffSnake;q.body.forEach(([x,y],i)=>{if(y>=0&&y<12&&x>=0&&x<16)g[y][x]=i?'●':'◆'});g[q.food[1]][q.food[0]]='★';box.textContent=g.map(r=>r.map(v=>v||'·').join(' ')).join('\\n');st.textContent='Pontos: '+q.score}function tick(){let q=window.ffSnake,h=q.body[0],n=[h[0]+q.dir[0],h[1]+q.dir[1]];if(n[0]<0||n[0]>=16||n[1]<0||n[1]>=12||q.body.some(p=>p[0]===n[0]&&p[1]===n[1])){clearInterval(window.ffSnakeTimer);st.textContent='Fim de jogo — '+q.score+' pontos';return}q.body.unshift(n);if(n[0]===q.food[0]&&n[1]===q.food[1]){q.score++;do{q.food=[Math.floor(Math.random()*16),Math.floor(Math.random()*12)]}while(q.body.some(p=>p[0]===q.food[0]&&p[1]===q.food[1]))}else q.body.pop();draw()}draw();window.ffSnakeTimer=setInterval(tick,180);"}}]}]};
 if(key==='pong')return {"name":"Pong vs IA","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"853c3750-d259-4f29-b451-52de257cbd9e","name":"Jogo","items":[{"id":"e82bcd36-d889-45c4-b123-cabb7e9d2b86","kind":"heading","name":"pongTitle","text":"Pong","x":145,"y":20,"width":"100px","height":"40px","bg":"transparent","color":"#111827","events":{}},{"id":"1a1b70bf-e95f-4f8b-a690-d84ea7311141","kind":"label","name":"pongStatus","text":"Clique em Iniciar","x":85,"y":65,"width":"220px","height":"32px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"4866df9c-71a5-457f-b334-ef15833c6eff","kind":"textarea","name":"pongBoard","text":"","x":35,"y":115,"width":"320px","height":"235px","bg":"#020617","color":"#fff","events":{}},{"id":"ab5d02a3-78d6-4a8a-b512-c667c7b7ccb2","kind":"button","name":"pongUp","text":"▲","x":55,"y":380,"width":"80px","height":"48px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffPong)window.ffPong.p=Math.max(1,window.ffPong.p-2)"}},{"id":"e57de262-b5ce-429b-867e-3ee8fa75a46a","kind":"button","name":"pongDown","text":"▼","x":145,"y":380,"width":"80px","height":"48px","bg":"#334155","color":"#fff","events":{"click":"if(window.ffPong)window.ffPong.p=Math.min(9,window.ffPong.p+2)"}},{"id":"d8d9af38-9ccc-4ab2-89aa-8ba99942552e","kind":"button","name":"pongStart","text":"Iniciar","x":235,"y":380,"width":"100px","height":"48px","bg":"#2563eb","color":"#fff","events":{"click":"clearInterval(window.ffPongTimer);window.ffPong={x:8,y:5,dx:1,dy:1,p:4,cpu:4,score:0};const b=document.getElementById('pongBoard'),st=document.getElementById('pongStatus');function draw(){let q=window.ffPong,g=Array.from({length:11},()=>Array(18).fill(' '));for(let k=-1;k<=1;k++){if(q.p+k>=0&&q.p+k<11)g[q.p+k][0]='█';if(q.cpu+k>=0&&q.cpu+k<11)g[q.cpu+k][17]='█'}g[q.y][q.x]='●';b.textContent=g.map(r=>r.join('')).join('\\n');st.textContent='Rebatidas: '+q.score}function tick(){let q=window.ffPong;q.cpu+=Math.sign(q.y-q.cpu)*.45;q.cpu=Math.max(1,Math.min(9,q.cpu));let nx=q.x+q.dx,ny=q.y+q.dy;if(ny<=0||ny>=10){q.dy*=-1;ny=q.y+q.dy}if(nx<=0){if(Math.abs(q.y-q.p)<=2){q.dx=1;q.score++;nx=1}else{return end()}}if(nx>=17){if(Math.abs(q.y-q.cpu)<=2){q.dx=-1;q.score++;nx=16}else{return end()}}q.x=nx;q.y=ny;draw()}function end(){clearInterval(window.ffPongTimer);st.textContent='Fim — '+window.ffPong.score+' rebatidas'}draw();window.ffPongTimer=setInterval(tick,100);"}}]}]};
 if(key==='breakout')return {"name":"Breakout","projectVersion":"1.1.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"296ac4d4-87ff-4840-83a8-58575a348826","name":"Jogo","items":[{"id":"024ca1b9-4a4a-46d2-afdf-a52538248f33","kind":"heading","name":"breakTitle","text":"Breakout","x":125,"y":18,"width":"140px","height":"40px","bg":"transparent","color":"#111827","events":{}},{"id":"f0127e49-07b3-40a5-9edb-a30c6d143223","kind":"label","name":"breakStatus","text":"Clique em Iniciar","x":85,"y":58,"width":"220px","height":"30px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"45833ef4-d40d-489a-a99e-fd9cb0668b77","kind":"textarea","name":"breakBoard","text":"","x":25,"y":96,"width":"340px","height":"270px","bg":"#0f172a","color":"#f8fafc","events":{}},{"id":"ef55827d-5e71-411b-a05d-ac699c8e5229","kind":"label","name":"breakSpeedLabel","text":"Velocidade: 5","x":35,"y":378,"width":"120px","height":"28px","bg":"transparent","color":"#111827","events":{}},{"id":"ac929cf0-2efa-4506-bdbf-df492aaef51c","kind":"range","name":"breakSpeed","text":"","x":155,"y":378,"width":"190px","height":"28px","bg":"transparent","color":"#111827","min":1,"max":10,"value":5,"events":{"input":"window.ffBreakSpeed=Number(event.target.value);document.getElementById('breakSpeedLabel').textContent='Velocidade: '+window.ffBreakSpeed;"}},{"id":"8fcf5c96-fbd1-4182-a6fa-0010423c24cb","kind":"button","name":"breakStart","text":"Iniciar / Reiniciar","x":95,"y":420,"width":"200px","height":"48px","bg":"#2563eb","color":"#fff","events":{"click":"clearTimeout(window.ffBreakTimer);\nif(window.ffBreakKeyDown) window.removeEventListener('keydown',window.ffBreakKeyDown);\nif(window.ffBreakKeyUp) window.removeEventListener('keyup',window.ffBreakKeyUp);\nwindow.ffBreakSpeed=Number(document.getElementById('breakSpeed').value||5);\nwindow.ffBreak={x:7,y:8,dx:1,dy:-1,p:6,bricks:Array.from({length:24},(_,i)=>i),score:0,left:false,right:false,running:true};\nconst b=document.getElementById('breakBoard'),st=document.getElementById('breakStatus'),speed=document.getElementById('breakSpeed'),sl=document.getElementById('breakSpeedLabel');\nfunction draw(){let q=window.ffBreak,g=Array.from({length:12},()=>Array(16).fill(' '));q.bricks.forEach(i=>g[1+Math.floor(i/8)][i%8*2]='■');for(let i=0;i<4;i++)if(q.p+i<16)g[11][q.p+i]='═';g[q.y][q.x]='●';b.value=g.map(r=>r.join(' ')).join('\\n');st.textContent='Pontos: '+q.score}\nwindow.ffBreakKeyDown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')window.ffBreak.left=true;if(e.key==='ArrowRight')window.ffBreak.right=true}};\nwindow.ffBreakKeyUp=e=>{if(e.key==='ArrowLeft')window.ffBreak.left=false;if(e.key==='ArrowRight')window.ffBreak.right=false};\nwindow.addEventListener('keydown',window.ffBreakKeyDown,{passive:false});window.addEventListener('keyup',window.ffBreakKeyUp);\nspeed.min=1;speed.max=10;speed.value=window.ffBreakSpeed;sl.textContent='Velocidade: '+window.ffBreakSpeed;\nfunction finish(msg){window.ffBreak.running=false;clearTimeout(window.ffBreakTimer);st.textContent=msg}\nfunction tick(){let q=window.ffBreak;if(!q?.running)return;if(q.left)q.p=Math.max(0,q.p-1);if(q.right)q.p=Math.min(12,q.p+1);let nx=q.x+q.dx,ny=q.y+q.dy;if(nx<0||nx>15){q.dx*=-1;nx=q.x+q.dx}if(ny<0){q.dy=1;ny=1}if(ny>=11){if(nx>=q.p&&nx<q.p+4){q.dy=-1;ny=10}else{return finish('Fim — '+q.score+' pontos')}}let bi=q.bricks.find(i=>1+Math.floor(i/8)===ny&&i%8*2===nx);if(bi!==undefined){q.bricks=q.bricks.filter(i=>i!==bi);q.score++;q.dy*=-1;ny=q.y+q.dy;if(!q.bricks.length){draw();return finish('Você venceu!')}}q.x=nx;q.y=ny;draw();let delay=210-(Math.max(1,Math.min(10,window.ffBreakSpeed||5))*18);window.ffBreakTimer=setTimeout(tick,delay)}\ndraw();tick();"}}]}]};
 if(key==='simon')return {"name":"Genius Simon","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"f714c8fb-879e-4c23-83ee-8cb2f8162b06","name":"Jogo","items":[{"id":"9e4138d2-87ba-4331-9538-15f2e896ed5a","kind":"heading","name":"simonTitle","text":"Genius / Simon","x":80,"y":25,"width":"230px","height":"45px","bg":"transparent","color":"#111827","events":{}},{"id":"07581792-5a5c-4689-bc0b-9c7897264dd5","kind":"label","name":"simonStatus","text":"Clique em Iniciar","x":65,"y":80,"width":"260px","height":"35px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"d0c84c12-dbe6-4573-8b77-787ebeae3322","kind":"button","name":"s0","text":"1","x":75,"y":145,"width":"110px","height":"110px","bg":"#ef4444","color":"#fff","events":{"click":"if(!window.ffSimon?.accept)return;const n=0,g=window.ffSimon;ffSimonFlash(n);if(n!==g.seq[g.pos]){g.accept=false;document.getElementById('simonStatus').textContent='Errou! Nível alcançado: '+g.seq.length;return}g.pos++;if(g.pos===g.seq.length){g.accept=false;document.getElementById('simonStatus').textContent='Certo!';setTimeout(ffSimonNext,650)}"}},{"id":"61787420-c613-403e-8a6c-7967ac6f97c7","kind":"button","name":"s1","text":"2","x":205,"y":145,"width":"110px","height":"110px","bg":"#3b82f6","color":"#fff","events":{"click":"if(!window.ffSimon?.accept)return;const n=1,g=window.ffSimon;ffSimonFlash(n);if(n!==g.seq[g.pos]){g.accept=false;document.getElementById('simonStatus').textContent='Errou! Nível alcançado: '+g.seq.length;return}g.pos++;if(g.pos===g.seq.length){g.accept=false;document.getElementById('simonStatus').textContent='Certo!';setTimeout(ffSimonNext,650)}"}},{"id":"afdffcfc-556f-45cb-b351-4a83ed41c692","kind":"button","name":"s2","text":"3","x":75,"y":275,"width":"110px","height":"110px","bg":"#22c55e","color":"#fff","events":{"click":"if(!window.ffSimon?.accept)return;const n=2,g=window.ffSimon;ffSimonFlash(n);if(n!==g.seq[g.pos]){g.accept=false;document.getElementById('simonStatus').textContent='Errou! Nível alcançado: '+g.seq.length;return}g.pos++;if(g.pos===g.seq.length){g.accept=false;document.getElementById('simonStatus').textContent='Certo!';setTimeout(ffSimonNext,650)}"}},{"id":"8220ea1a-d946-4089-9e32-be4b442b03dd","kind":"button","name":"s3","text":"4","x":205,"y":275,"width":"110px","height":"110px","bg":"#eab308","color":"#fff","events":{"click":"if(!window.ffSimon?.accept)return;const n=3,g=window.ffSimon;ffSimonFlash(n);if(n!==g.seq[g.pos]){g.accept=false;document.getElementById('simonStatus').textContent='Errou! Nível alcançado: '+g.seq.length;return}g.pos++;if(g.pos===g.seq.length){g.accept=false;document.getElementById('simonStatus').textContent='Certo!';setTimeout(ffSimonNext,650)}"}},{"id":"63177bce-f2b7-4e83-9ee4-85179a891af5","kind":"button","name":"simonStart","text":"Iniciar / Reiniciar","x":105,"y":420,"width":"180px","height":"45px","bg":"#334155","color":"#fff","events":{"click":"clearTimeout(window.ffSimonTimer);window.ffSimon={seq:[],pos:0,accept:false};window.ffSimonFlash=function(n){const b=document.getElementById('s'+n),old=b.style.opacity;b.style.opacity='.35';setTimeout(()=>b.style.opacity=old||'1',260)};window.ffSimonNext=function(){let g=window.ffSimon;g.seq.push(Math.floor(Math.random()*4));g.pos=0;g.accept=false;document.getElementById('simonStatus').textContent='Observe: nível '+g.seq.length;let i=0;function play(){if(i>=g.seq.length){g.accept=true;document.getElementById('simonStatus').textContent='Sua vez';return}ffSimonFlash(g.seq[i++]);window.ffSimonTimer=setTimeout(play,520)}play()};ffSimonNext();"}}]}]};
 if(key==='memory')return {"name":"Jogo da Memória","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"d363c928-62ce-4b4b-98bf-b4b1dff48c30","name":"Jogo","items":[{"id":"928e7d0d-2e7b-4fbb-b413-efb6f06a9113","kind":"heading","name":"memTitle","text":"Jogo da Memória","x":55,"y":25,"width":"280px","height":"45px","bg":"transparent","color":"#111827","events":{}},{"id":"3b6057fb-354b-4d41-9aa9-23631692414a","kind":"label","name":"memStatus","text":"Clique em Novo jogo","x":75,"y":78,"width":"240px","height":"34px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"bfa6e908-c7fc-4f1b-aa26-6b6b649e4947","kind":"button","name":"m0","text":"?","x":48,"y":135,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m0'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"271c0f0c-ae2f-4f2d-9fb0-d3de8301bcc0","kind":"button","name":"m1","text":"?","x":120,"y":135,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m1'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"6afe2ebc-e420-4caf-a666-872e3354fc55","kind":"button","name":"m2","text":"?","x":192,"y":135,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m2'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"c6edf034-9e43-48b8-902e-0b9f983af43d","kind":"button","name":"m3","text":"?","x":264,"y":135,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m3'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"f46ee390-8dfe-418a-8a2b-c293c07f77e1","kind":"button","name":"m4","text":"?","x":48,"y":217,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m4'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"84e9ec71-834a-4c9f-9b8f-1258e83bc6f7","kind":"button","name":"m5","text":"?","x":120,"y":217,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m5'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"e7bf3215-1206-4e6d-a6e1-2bb6cbadd3c8","kind":"button","name":"m6","text":"?","x":192,"y":217,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m6'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"23242480-d7d4-4617-813c-461c4120ffd4","kind":"button","name":"m7","text":"?","x":264,"y":217,"width":"62px","height":"62px","bg":"#fff","color":"#111","events":{"click":"if(!window.ffMem){window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';}const b=document.getElementById('m7'),g=window.ffMem;if(g.lock||b.dataset.ok||b===g.first)return;b.textContent=b.dataset.v;if(!g.first){g.first=b}else if(g.first.dataset.v===b.dataset.v){b.dataset.ok=g.first.dataset.ok='1';g.first=null;g.pairs++;document.getElementById('memStatus').textContent=g.pairs===4?'Você venceu!':'Par encontrado!'}else{g.lock=true;let a=g.first;g.first=null;setTimeout(()=>{a.textContent=b.textContent='?';g.lock=false;document.getElementById('memStatus').textContent='Tente novamente'},650)}"}},{"id":"e45bdf1d-a820-4452-8e1e-a01a33b88084","kind":"button","name":"memNew","text":"Novo jogo","x":105,"y":320,"width":"180px","height":"44px","bg":"#2563eb","color":"#fff","events":{"click":"window.ffMem={lock:false,first:null,pairs:0};const vals=['🍎','🍌','🍒','🍇','🍎','🍌','🍒','🍇'].sort(()=>Math.random()-.5);document.querySelectorAll('[id^=\"m\"]').forEach((b,i)=>{b.dataset.v=vals[i];b.textContent='?';b.dataset.ok='';});document.getElementById('memStatus').textContent='Encontre os 4 pares';"}}]}]};
 if(key==='guess')return {"name":"Adivinhe o Número","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"998fe2c7-aad9-4a0b-b92e-98caa718d81e","name":"Jogo","items":[{"id":"d3a88ebe-86ef-415a-986e-6687d2fd705a","kind":"heading","name":"guessTitle","text":"Adivinhe o Número","x":45,"y":35,"width":"300px","height":"50px","bg":"transparent","color":"#111827","events":{}},{"id":"0a145fbf-d2ef-4173-849b-eba26a129eca","kind":"label","name":"guessStatus","text":"Clique em Novo jogo","x":55,"y":100,"width":"280px","height":"45px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"cb0e69b2-8dcb-4aa2-91b6-8cc1eae2d747","kind":"input","name":"guessInput","text":"","x":95,"y":170,"width":"200px","height":"44px","bg":"#fff","color":"#111827","events":{}},{"id":"4445a20e-480b-46d3-b043-3f7cfa144aec","kind":"button","name":"guessGo","text":"Tentar","x":95,"y":230,"width":"200px","height":"44px","bg":"#16a34a","color":"#fff","events":{"click":"if(!window.ffSecret){window.ffSecret=1+Math.floor(Math.random()*100);window.ffTries=0;document.getElementById('guessStatus').textContent='Escolhi um número de 1 a 100';document.getElementById('guessInput').value='';}const el=document.getElementById('guessInput'),n=Number(el.value);if(!Number.isInteger(n)||n<1||n>100){document.getElementById('guessStatus').textContent='Digite um número entre 1 e 100';return}window.ffTries++;document.getElementById('guessStatus').textContent=n===window.ffSecret?'Acertou em '+window.ffTries+' tentativas!':n<window.ffSecret?'É maior ↑':'É menor ↓';"}},{"id":"06af216b-0ca7-4fd6-a9fd-2bcf0f433641","kind":"button","name":"guessNew","text":"Novo jogo","x":95,"y":290,"width":"200px","height":"44px","bg":"#2563eb","color":"#fff","events":{"click":"window.ffSecret=1+Math.floor(Math.random()*100);window.ffTries=0;document.getElementById('guessStatus').textContent='Escolhi um número de 1 a 100';document.getElementById('guessInput').value='';"}}]}]};
 if(key==='reaction')return {"name":"Teste de Reflexo","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"44e1ca0c-916f-417b-b868-0d09e43090f9","name":"Jogo","items":[{"id":"7a72bd02-3394-4037-a84f-b083774f3f03","kind":"heading","name":"reactTitle","text":"Teste de Reflexo","x":55,"y":35,"width":"280px","height":"50px","bg":"transparent","color":"#111827","events":{}},{"id":"0d957c19-2ff7-4178-a445-84f8ac61b999","kind":"label","name":"reactStatus","text":"Clique em Começar","x":55,"y":100,"width":"280px","height":"42px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"9e78fa46-d61b-4142-85a1-22940ab234a5","kind":"button","name":"reactBtn","text":"Pronto","x":95,"y":170,"width":"200px","height":"100px","bg":"#64748b","color":"#fff","events":{"click":"const s=document.getElementById('reactStatus'),b=document.getElementById('reactBtn');if(window.ffReactReady){let ms=Math.round(performance.now()-window.ffReactAt);window.ffReactReady=false;s.textContent='Seu tempo: '+ms+' ms';b.textContent='Pronto';b.style.background='#64748b'}else{s.textContent='Queimou! Comece novamente.';clearTimeout(window.ffReactTimer)}"}},{"id":"69a3b84a-1687-4ac3-a5fb-5d85fd47fdb4","kind":"button","name":"reactStart","text":"Começar","x":95,"y":300,"width":"200px","height":"44px","bg":"#2563eb","color":"#fff","events":{"click":"const b=document.getElementById('reactBtn'),s=document.getElementById('reactStatus');clearTimeout(window.ffReactTimer);window.ffReactReady=false;b.textContent='Espere...';b.style.background='#ef4444';s.textContent='Não clique ainda';window.ffReactTimer=setTimeout(()=>{window.ffReactReady=true;window.ffReactAt=performance.now();b.textContent='CLIQUE!';b.style.background='#22c55e';s.textContent='Agora!'},900+Math.random()*2200);"}}]}]};
 if(key==='rps')return {"name":"Pedra Papel Tesoura vs IA","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"1cc2d07b-2513-44f5-919a-238a8c4ac502","name":"Jogo","items":[{"id":"707616a2-8946-4c2a-89ec-bbabf1c279d6","kind":"heading","name":"rpsTitle","text":"Pedra, Papel, Tesoura","x":35,"y":35,"width":"320px","height":"50px","bg":"transparent","color":"#111827","events":{}},{"id":"9dd9492f-c660-4e2b-b9aa-68565e39f821","kind":"label","name":"rpsStatus","text":"Escolha uma jogada","x":35,"y":100,"width":"320px","height":"55px","bg":"#f1f5f9","color":"#111827","events":{}},{"id":"1e4c45fb-aa37-4343-8c4c-3fe8860af5e5","kind":"button","name":"rpsPedra","text":"✊ Pedra","x":40,"y":190,"width":"95px","height":"75px","bg":"#fff","color":"#111","events":{"click":"const p='Pedra',opts=['Pedra','Papel','Tesoura'],cpu=opts[Math.floor(Math.random()*3)];let r=p===cpu?'Empate':(p==='Pedra'&&cpu==='Tesoura'||p==='Papel'&&cpu==='Pedra'||p==='Tesoura'&&cpu==='Papel')?'Você venceu!':'IA venceu!';document.getElementById('rpsStatus').textContent='Você: '+p+' | IA: '+cpu+' — '+r;"}},{"id":"c35ba2f3-92e9-4a80-b54c-a98fdd2494d6","kind":"button","name":"rpsPapel","text":"✋ Papel","x":145,"y":190,"width":"95px","height":"75px","bg":"#fff","color":"#111","events":{"click":"const p='Papel',opts=['Pedra','Papel','Tesoura'],cpu=opts[Math.floor(Math.random()*3)];let r=p===cpu?'Empate':(p==='Pedra'&&cpu==='Tesoura'||p==='Papel'&&cpu==='Pedra'||p==='Tesoura'&&cpu==='Papel')?'Você venceu!':'IA venceu!';document.getElementById('rpsStatus').textContent='Você: '+p+' | IA: '+cpu+' — '+r;"}},{"id":"5684ad6f-4913-46ff-8a25-62a37683477e","kind":"button","name":"rpsTesoura","text":"✌ Tesoura","x":250,"y":190,"width":"95px","height":"75px","bg":"#fff","color":"#111","events":{"click":"const p='Tesoura',opts=['Pedra','Papel','Tesoura'],cpu=opts[Math.floor(Math.random()*3)];let r=p===cpu?'Empate':(p==='Pedra'&&cpu==='Tesoura'||p==='Papel'&&cpu==='Pedra'||p==='Tesoura'&&cpu==='Papel')?'Você venceu!':'IA venceu!';document.getElementById('rpsStatus').textContent='Você: '+p+' | IA: '+cpu+' — '+r;"}}]}]};
 if(key==='tictactoe')return {"name":"Jogo da Velha - Jogador vs IA","projectVersion":"1.0.0","icon":"","favicon":"","themeColor":"#20242a","type":"app","framework":"none","titlebar":true,"active":0,"pages":[{"id":"bd4fa71b-3f06-474d-b3ae-9a0f48d9c741","name":"Jogo","items":[{"id":"678ad250-588c-4126-b9f7-8c33bddb8f99","kind":"heading","name":"titulo","text":"Jogo da Velha","x":45,"y":24,"width":"300px","height":"52px","bg":"transparent","color":"#111827","events":{"click":"// Título do jogo"}},{"id":"d36d7b85-c5c9-419e-84d3-ac52c938bbcf","kind":"label","name":"subtitulo","text":"Jogador (X) × IA (O)","x":70,"y":76,"width":"250px","height":"30px","bg":"transparent","color":"#475569","events":{"click":"// Subtítulo"}},{"id":"59ea68ea-9aa0-42a7-bb42-2f568a4b7175","kind":"label","name":"status","text":"Sua vez — você é X","x":65,"y":112,"width":"260px","height":"36px","bg":"#eef2ff","color":"#312e81","events":{"click":"// Estado da partida"}},{"id":"9eed05e4-547e-4996-a2e8-467f629d5dc9","kind":"button","name":"c0","text":"","x":58,"y":165,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(0);"}},{"id":"40253e3c-a1ff-4202-9985-07e9fc960fb8","kind":"button","name":"c1","text":"","x":148,"y":165,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(1);"}},{"id":"c539760f-21bb-477c-aad5-14ba8a271865","kind":"button","name":"c2","text":"","x":238,"y":165,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(2);"}},{"id":"910d0a01-6458-46d5-8ff0-dd4e1423cd1d","kind":"button","name":"c3","text":"","x":58,"y":255,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(3);"}},{"id":"b5c0a322-0a5f-4ac8-97f4-12fb932ac330","kind":"button","name":"c4","text":"","x":148,"y":255,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(4);"}},{"id":"a8faecfb-eaed-4b2d-a383-4a20b902549e","kind":"button","name":"c5","text":"","x":238,"y":255,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(5);"}},{"id":"6762f402-9192-4820-8d02-34aff17442b8","kind":"button","name":"c6","text":"","x":58,"y":345,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(6);"}},{"id":"73cd0460-16be-4f3d-9540-8674f5c65517","kind":"button","name":"c7","text":"","x":148,"y":345,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(7);"}},{"id":"f47fa5d3-6def-4229-9d15-115305e1e605","kind":"button","name":"c8","text":"","x":238,"y":345,"width":"82px","height":"82px","bg":"#ffffff","color":"#111827","events":{"click":"window.ffTTTMove ||= function(pos){\n  const cells = Array.from({length:9},(_,i)=>document.getElementById('c'+i));\n  const status = document.getElementById('status');\n  const board = cells.map(c => c.dataset.v || '');\n  const win = b => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l => l.every(i => b[i] && b[i]===b[l[0]]));\n  const paint = (b,line) => { cells.forEach((c,i)=>{c.textContent=b[i]||'';c.dataset.v=b[i]||'';c.style.fontSize='42px';c.style.fontWeight='700';c.style.display='grid';c.style.placeItems='center';c.style.cursor=b[i]?'default':'pointer';c.style.background=line?.includes(i)?'#d1fae5':'#ffffff';}); };\n  const finish = b => { let l=win(b); if(l){paint(b,l);status.textContent=(b[l[0]]==='X'?'Você venceu!':'A IA venceu!');return true} if(b.every(Boolean)){paint(b);status.textContent='Empate!';return true} return false; };\n  const score = (b,depth,max) => { let l=win(b); if(l)return b[l[0]]==='O'?10-depth:depth-10;if(b.every(Boolean))return 0;let vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';vals.push(score(b,depth+1,!max));b[i]=''}return max?Math.max(...vals):Math.min(...vals); };\n  if(board[pos] || finish(board)) return;\n  board[pos]='X';paint(board);if(finish(board))return;status.textContent='IA pensando...';\n  let best=-Infinity,choice=-1;for(let i=0;i<9;i++)if(!board[i]){board[i]='O';let v=score(board,0,false);board[i]='';if(v>best){best=v;choice=i}}\n  if(choice>=0)board[choice]='O';paint(board);if(!finish(board))status.textContent='Sua vez — você é X';\n};\nwindow.ffTTTMove(8);"}},{"id":"c90ade2b-faf7-4a7e-b645-1c24bd8b6697","kind":"button","name":"novoJogo","text":"Novo jogo","x":105,"y":445,"width":"180px","height":"46px","bg":"#2563eb","color":"#ffffff","events":{"click":"const cells=Array.from({length:9},(_,i)=>document.getElementById('c'+i));\ncells.forEach(c=>{c.textContent='';c.dataset.v='';c.style.background='#ffffff';c.style.cursor='pointer';});\ndocument.getElementById('status').textContent='Sua vez — você é X';"}}]}]};
  let p=fresh(key==='landing'?'landing':'app'); p.version='0.6.0'; p.framework='none';
  let a=p.pages[0].items;
  if(key==='hello'){
    p.name='01 - Ola Mundo';
    a.push(exItem('heading','titulo1','Meu primeiro App',48,60,290,52));
    a.push(exItem('label','label1','Clique no botão abaixo',70,135,250,40));
    a.push(exItem('button','button1','Dizer Olá',110,205,170,46,`// Esta linha procura o componente chamado label1.\nconst label = document.getElementById('label1');\n\n// textContent troca o texto que aparece na tela.\nlabel.textContent = 'Olá! Você executou seu primeiro JavaScript!';`));
  } else if(key==='counter'){
    p.name='02 - Contador';
    a.push(exItem('heading','titulo1','Contador',125,55,180,52));
    a.push(exItem('label','numero','0',170,135,60,60));
    a.push(exItem('button','somar','+1',65,230,110,46,`// Pegamos o texto atual do componente numero.\nconst visor = document.getElementById('numero');\n\n// Number converte o texto para número. Depois somamos 1.\nconst valor = Number(visor.textContent) + 1;\n\n// Mostramos o novo valor.\nvisor.textContent = valor;`));
    a.push(exItem('button','zerar','Zerar',215,230,110,46,`// Para zerar, basta voltar o texto do visor para 0.\ndocument.getElementById('numero').textContent = '0';`));
  } else if(key==='form'){
    p.name='03 - Formulario Simples';
    a.push(exItem('heading','titulo1','Boas-vindas',65,55,270,52));
    a.push(exItem('label','labelNome','Digite seu nome:',45,135,180,36));
    a.push(exItem('input','nome','Seu nome',45,175,300,44));
    a.push(exItem('button','saudar','Continuar',105,245,180,46,`// querySelector encontra o campo <input> que está dentro de nome.\nconst campo = document.querySelector('#nome input');\n\n// .value contém o que a pessoa digitou.\nconst nomeDigitado = campo.value.trim();\n\n// Se nada foi digitado, mostramos um aviso.\nif (nomeDigitado === '') {\n    alert('Digite seu nome primeiro.');\n    return;\n}\n\n// Caso contrário, mostramos uma saudação.\nalert('Olá, ' + nomeDigitado + '!');`));
  } else if(key==='theme'){
    p.name='04 - Mudar Cor';
    a.push(exItem('heading','titulo1','Trocar aparência',55,65,280,52));
    a.push(exItem('label','mensagem','O botão muda a cor da tela.',55,145,280,40));
    a.push(exItem('button','corAzul','Fundo azul',105,220,180,46,`// document.body representa o corpo inteiro da página.\n// style.background altera sua cor de fundo.\ndocument.body.style.background = '#dbeafe';\n\n// Também podemos mudar a cor de um componente específico.\ndocument.getElementById('mensagem').style.color = '#1d4ed8';`));
  } else if(key==='todo'){
    p.name='05 - Lista de Tarefas';
    a.push(exItem('heading','titulo1','Minhas tarefas',60,45,280,52));
    a.push(exItem('input','novaTarefa','Nova tarefa',35,125,240,44));
    a.push(exItem('button','adicionar','+',290,125,55,44,`// Lemos o texto digitado.\nconst campo = document.querySelector('#novaTarefa input');\nconst texto = campo.value.trim();\nif (texto === '') return;\n\n// A lista visual fica dentro do componente lista1.\nconst lista = document.querySelector('#lista1 ul');\n\n// Criamos um novo <li> (item de lista).\nconst item = document.createElement('li');\nitem.textContent = texto;\nlista.appendChild(item);\n\n// Limpamos o campo para a próxima tarefa.\ncampo.value = '';`));
    a.push(exItem('list','lista1','Aprender FlowForge',35,205,310,150));
  } else if(key==='listboxRuntime'){
    p.name='07 - ListBox em tempo de execução';
    a.push(exItem('heading','titulo1','ListBox dinâmico',55,45,330,52));
    const lb=exItem('listbox','listaCidades','Cidades',55,120,300,150);
    lb.items=[{text:'São Paulo',value:'SP'},{text:'Rio de Janeiro',value:'RJ'}];
    a.push(lb);
    a.push(exItem('input','novaCidade','Nova cidade',55,290,200,44));
    a.push(exItem('button','adicionarCidade','Adicionar',265,290,120,44,`const campo=document.querySelector('#novaCidade input');
const texto=campo.value.trim();
if(!texto)return;
const valor=texto.toLowerCase().replace(/[^a-z0-9]+/g,'_');
listaCidades.addItem(texto,valor);
campo.value='';`));
    a.push(exItem('button','mostrarSelecionado','Mostrar selecionado',55,350,220,44,`const item=listaCidades.selectedItem;
alert(item ? item.text + ' → ' + item.value : 'Selecione um item.');`));
  } else if(key==='landing'){
    p.name='06 - Landing Page'; p.type='landing'; p.framework='bootstrap';
    a.push(exItem('hero','hero1','Seu produto merece destaque',70,55,700,150));
    a.push(exItem('heading','titulo2','Uma página pronta para apresentar sua ideia',90,245,650,60));
    a.push(exItem('label','texto1','Edite textos, cores e componentes visualmente. Depois exporte como HTML.',90,325,650,55));
    a.push(exItem('button','cta','Quero saber mais',90,410,190,48,`// Em uma landing page, o botão pode levar a outra seção ou endereço.\n// Aqui mostramos uma mensagem simples para o exemplo.\nalert('Obrigado pelo interesse!');`));
    a.push(exItem('card','card1','Recurso 1',90,510,210,130));
    a.push(exItem('card','card2','Recurso 2',330,510,210,130));
    a.push(exItem('card','card3','Recurso 3',570,510,210,130));
  }
  if(key==='dashboard'){p.name='Dashboard';p.framework='bootstrap';a.push(exItem('heading','titulo','Dashboard do Sistema',40,30,420,60));a.push(exItem('valuecard','vendas','R$ 12.480',40,115,210,110));a.push(exItem('chart','grafico','Vendas',40,250,440,210));}
  if(key==='gallery'){p.name='Galeria';a.push(exItem('heading','titulo','Galeria de Fotos',40,30,400,55));a.push(exItem('picturebox','foto','Foto selecionada',40,105,430,260));a.push(exItem('button','proxima','Próxima',340,390,130,44));}
  if(key==='player'){p.name='Player';a.push(exItem('heading','titulo','Meu Player',40,30,360,55));a.push(exItem('picturebox','capa','Capa do álbum',90,105,220,220));a.push(exItem('audio','musica','Faixa atual',40,350,320,54));}
  if(key==='login'){p.name='Login';a.push(exItem('heading','titulo','Entrar',70,45,260,55));a.push(exItem('input','email','E-mail',70,125,280,44));a.push(exItem('input','senha','Senha',70,185,280,44));a.push(exItem('button','entrar','Entrar',70,250,280,46));}
  if(key==='timer'){p.name='Cronômetro';a.push(exItem('sevenseg','tempo','00:00',85,80,240,85));a.push(exItem('button','iniciar','Iniciar',60,200,130,44));a.push(exItem('button','zerar','Zerar',220,200,130,44));}
  if(key==='shop'){p.name='Loja';a.push(exItem('heading','titulo','Minha Loja',35,25,400,55));a.push(exItem('card','produto1','Produto A',35,100,200,150));a.push(exItem('card','produto2','Produto B',255,100,200,150));}
  if(key==='finance'){p.name='Finanças';a.push(exItem('heading','titulo','Controle Financeiro',35,25,430,55));a.push(exItem('valuecard','saldo','R$ 4.250',35,100,210,110));a.push(exItem('datagrid','movimentos','Movimentações',35,235,430,190));}
  if(key==='quiz'){p.name='Quiz';a.push(exItem('heading','pergunta','Qual alternativa está correta?',35,40,440,60));a.push(exItem('radio','opcao1','Alternativa A',50,135,260,40));a.push(exItem('radio','opcao2','Alternativa B',50,185,260,40));a.push(exItem('button','responder','Responder',50,250,180,44));}
  return p;
}
const EXAMPLES=[
 ['hello','★','Olá Mundo','Primeiro evento de botão e alteração de texto.'],
 ['counter','＋','Contador','Variáveis, números e dois botões.'],
 ['form','▭','Formulário','Ler um TextBox, validar e mostrar mensagem.'],
 ['theme','◐','Mudar Cor','Alterar estilos com JavaScript.'],
 ['todo','☷','Lista de Tarefas','Criar elementos dinamicamente.'],
 ['listboxRuntime','☷','ListBox em tempo de execução','Adicionar itens e trabalhar com text/value.'],['landing','↥','Landing Page','Exemplo visual com Bootstrap e CTA.'],['dashboard','▥','Dashboard','Painel administrativo com indicadores.'],['gallery','▧','Galeria','PictureBox e navegação.'],['player','♫','Player','Áudio e capa.'],['login','🔐','Login','Formulário de acesso.'],['timer','◷','Cronômetro','Timer e controles.'],['shop','▱','Loja','Cards de produtos.'],['finance','▦','Finanças','Resumo e movimentações.'],['quiz','?','Quiz','Perguntas e respostas.'],['tictactoe','⊞','Jogo da Velha IA','Jogador X contra IA O com estratégia minimax.'],['memory','▦','Jogo da Memória','Encontre os pares e pratique estado, eventos e Timer.'],['guess','#','Adivinhe o Número','Jogo simples com entrada de dados e lógica.'],['reaction','⚡','Teste de Reflexo','Timer aleatório e medição de tempo de reação.'],['rps','✊','Pedra Papel Tesoura','Jogador contra IA com escolha aleatória.'],['snake','●','Snake','Movimento, timer, colisão e pontuação.'],['pong','↕','Pong vs IA','Raquete, bola, colisões e adversário automático.'],['breakout','▦','Breakout','Blocos, colisão, pontuação e controle da raquete.'],['simon','◉','Genius / Simon','Sequências, memória e temporização.']
];
function renderExamples(){
 const box=$('#exampleChoices'); if(!box)return; box.innerHTML='';
 EXAMPLES.forEach(([key,icon,title,desc])=>{const b=document.createElement('button');b.type='button';b.className='exampleCard';b.innerHTML=`<span class="bigicon">${icon}</span><b>${title}</b><small>${desc}</small>`;b.onclick=()=>{project=exampleProject(key);selected=null;undoStack=[];future=[];$('#examplesDlg').close();$('#newDlg').close();render();};box.append(b)});
}
function showExamples(){renderExamples();$('#examplesDlg').showModal()}

$('#toolSearch').oninput=e=>renderTools(e.target.value);$('#stage').onclick=()=>{selected=null;render()};const ffStage=$('#stage');
const ffDragOver=e=>{if(window.ffPaletteDragKind||Array.from(e.dataTransfer?.types||[]).includes('application/x-flowforge-kind')||Array.from(e.dataTransfer?.types||[]).includes('text/plain')){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';ffStage.classList.add('ff-drop-active')}};
const ffDrop=e=>{let kind=window.ffPaletteDragKind||e.dataTransfer?.getData('application/x-flowforge-kind')||e.dataTransfer?.getData('text/plain');if(!kind)return;e.preventDefault();e.stopPropagation();ffStage.classList.remove('ff-drop-active');window.ffPaletteDragKind=null;let r=ffStage.getBoundingClientRect(),x=e.clientX-r.left+ffStage.scrollLeft,y=e.clientY-r.top+ffStage.scrollTop;addItem(kind,x,y)};
ffStage.addEventListener('dragenter',ffDragOver,true);ffStage.addEventListener('dragover',ffDragOver,true);ffStage.addEventListener('drop',ffDrop,true);ffStage.addEventListener('dragleave',e=>{if(!ffStage.contains(e.relatedTarget))ffStage.classList.remove('ff-drop-active')},true);$('#addPage').onclick=()=>{let n=prompt('Nome da página','Página_'+(project.pages.length+1));if(!n)return;ffAddPage(n)};
$('#pTitleAuto').onchange=e=>{if(selected?.kind!=='titlebar')return;snapshot();selected.autoStyle=e.target.checked;project.titlebar=selected;render()};
['pName','pText','pX','pY','pWidth','pHeight','pBg','pColor'].forEach(id=>$('#'+id).onchange=e=>{if(!selected)return;snapshot();let map={pName:'name',pText:'text',pX:'x',pY:'y',pWidth:'width',pHeight:'height',pBg:'bg',pColor:'color'},k=map[id],v=e.target.value;if(k==='x'||k==='y')v=+v;if((k==='width'||k==='height')&&/^\d+$/.test(v))v+='px';if(k==='name'){const oldName=selected.name;v=sanitizeName(v,selected.kind||'component');const taken=ffItems().some(x=>x!==selected&&x.name===v);if(taken)v=uniqueName(selected.kind,v);selected.name=v;if(selected.events)Object.keys(selected.events).forEach(ev=>{if(String(selected.events[ev]||'').startsWith('// '+oldName+':'))selected.events[ev]=String(selected.events[ev]).replace('// '+oldName+':','// '+v+':')});}else selected[k]=v;if(selected.kind==='header'&&selected.ffSystem==='siteChrome'){project.pages.forEach(pg=>pg.items.forEach(it=>{if(it.kind==='header'&&it.ffSystem==='siteChrome')it.text=v;}));}if(selected.kind==='titlebar')project.titlebar=selected;render()});$('#pVisible').onchange=e=>{if(!selected)return;snapshot();selected.visible=e.target.checked;render()};$('#pEnabled').onchange=e=>{if(!selected)return;snapshot();selected.enabled=e.target.checked;render()};$('#propDynamic').onchange=e=>{const k=e.target.dataset.key;if(!k||!selected)return;snapshot();let ty=e.target.dataset.type,v;if(ty==='page')v=e.target.value||'';else if(ty==='checkbox')v=e.target.checked;else if(ty==='number')v=e.target.value===''?undefined:Number(e.target.value);else if(ty==='textarea'){try{v=JSON.parse(e.target.value)}catch{v=e.target.value}}else v=e.target.value;if((k==='options'||k==='items')&&typeof v==='string'){try{v=JSON.parse(v)}catch{}}selected[k]=v;render()};$('#deleteBtn').onclick=del;$('#duplicateBtn').onclick=duplicate;document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='Delete')del();if(e.ctrlKey&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate()}if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('#undoBtn').click()}if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();$('#redoBtn').click()}});
function safeFileName(v){return String(v||'projeto').trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g,'_').replace(/\s+/g,'_')||'projeto'}
/* ---------- Project icon / favicon: always embedded as Base64 ----------
   Raster images are downscaled (icon <= 192 px, favicon <= 64 px) and re-encoded as PNG when needed, so a large
   picture does not bloat every .flowmobile and every exported HTML. SVG and ICO are embedded untouched. */
const FF_IMG_MAX={icon:192,favicon:64,headerLogo:512};
const FF_IMG_LIMIT_FILE=5*1024*1024,FF_IMG_LIMIT_VECTOR=512*1024,FF_IMG_KEEP_BYTES=256*1024;
const FF_IMG_EXT={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon'};
const FF_IMG_FMT={'image/png':'PNG','image/jpeg':'JPEG','image/webp':'WEBP','image/gif':'GIF','image/svg+xml':'SVG','image/x-icon':'ICO','image/vnd.microsoft.icon':'ICO','image/bmp':'BMP','image/avif':'AVIF'};
const FF_IMG_MSG={
 'pt-BR':{invalid:'Imagem inválida',format:'Selecione uma imagem válida (PNG, JPG, WEBP, GIF, SVG ou ICO).',tooBig:'Arquivo muito grande (máximo 5 MB).',vectorBig:'SVG/ICO muito grande (máximo 512 KB).',corrupt:'Imagem inválida ou corrompida.',read:'Não foi possível ler a imagem.',notSquare:'não quadrada',none:'Nenhuma imagem selecionada'},
 en:{invalid:'Invalid image',format:'Select a valid image (PNG, JPG, WEBP, GIF, SVG or ICO).',tooBig:'File too large (maximum 5 MB).',vectorBig:'SVG/ICO too large (maximum 512 KB).',corrupt:'Invalid or corrupted image.',read:'Could not read the image.',notSquare:'not square',none:'No image selected'},
 es:{invalid:'Imagen no válida',format:'Selecciona una imagen válida (PNG, JPG, WEBP, GIF, SVG o ICO).',tooBig:'Archivo demasiado grande (máximo 5 MB).',vectorBig:'SVG/ICO demasiado grande (máximo 512 KB).',corrupt:'Imagen no válida o dañada.',read:'No se pudo leer la imagen.',notSquare:'no cuadrada',none:'Ninguna imagen seleccionada'}
};
function ffImgMsg(k){const l=window.FlowForgeI18n?.getLanguage?.()||'pt-BR';return (FF_IMG_MSG[l]||FF_IMG_MSG['pt-BR'])[k]}
function ffImageMime(file){
 const t=String(file?.type||'').toLowerCase();
 if(/^image\//.test(t))return t==='image/vnd.microsoft.icon'?'image/x-icon':t;
 return FF_IMG_EXT[String(file?.name||'').split('.').pop().toLowerCase()]||'';
}
function ffReadDataUrl(blob){
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error(ffImgMsg('read')));r.readAsDataURL(blob)});
}
function ffLoadImage(src){
 return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(ffImgMsg('corrupt')));i.src=src});
}
/* src: object URL or data URL. keepOriginal() may return the untouched data URL when it is already small enough. */
async function ffFitRaster(src,max,keepOriginal){
 const img=await ffLoadImage(src);const w=img.naturalWidth,h=img.naturalHeight;
 if(!w||!h)throw new Error(ffImgMsg('corrupt'));
 const scale=Math.min(1,max/Math.max(w,h));
 if(scale===1){const kept=await keepOriginal();if(kept)return kept}
 const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
 const c=document.createElement('canvas');c.width=cw;c.height=ch;
 const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,cw,ch);
 return c.toDataURL('image/png');
}
async function readImageAsBase64(file,kind){
 if(!file)return '';
 const mime=ffImageMime(file);
 if(!mime)throw new Error(ffImgMsg('format'));
 if(file.size>FF_IMG_LIMIT_FILE)throw new Error(ffImgMsg('tooBig'));
 const blob=new Blob([file],{type:mime}); /* fixes empty/odd types (e.g. .ico) so the data URL has a real MIME */
 if(/svg|x-icon/.test(mime)){if(file.size>FF_IMG_LIMIT_VECTOR)throw new Error(ffImgMsg('vectorBig'));return ffReadDataUrl(blob)}
 const max=FF_IMG_MAX[kind];
 if(!max)return ffReadDataUrl(blob);
 const url=URL.createObjectURL(blob);
 try{return await ffFitRaster(url,max,async()=>file.size<=FF_IMG_KEEP_BYTES?ffReadDataUrl(blob):null)}
 finally{URL.revokeObjectURL(url)}
}
async function ffFitDataUrl(dataUrl,kind){
 const m=/^data:([^;,]+)/i.exec(String(dataUrl||''));
 if(!m)return dataUrl;
 if(/svg|x-icon|vnd\.microsoft\.icon/i.test(m[1]))return dataUrl;
 const max=FF_IMG_MAX[kind];
 if(!max)return dataUrl;
 return ffFitRaster(dataUrl,max,async()=>dataUrl.length<=FF_IMG_KEEP_BYTES*1.34?dataUrl:null);
}
function ffImgKb(bytes){return bytes<1024?bytes+' B':bytes<1048576?Math.max(1,Math.round(bytes/1024))+' KB':(bytes/1048576).toFixed(1)+' MB'}
/* Short, language-neutral description of a stored value. Never prints the Base64 itself. */
function ffImgBrief(v){
 v=String(v||'');if(!v)return '';
 if(v.startsWith('asset://')){const a=(project.assets||[]).find(x=>String(x.id)===v.slice(8));return a?`Asset: ${a.name}`:'Asset'}
 const m=/^data:([^;,]+)[^,]*,/i.exec(v);
 if(m)return `${FF_IMG_FMT[m[1].toLowerCase()]||m[1]} · ${ffImgKb(Math.round((v.length-m[0].length)*3/4))} · Base64`;
 return '⚠ '+v;
}
function ffImgEmptyText(id,fallback){
 const key={saveProjectIconInfo:'noIcon',saveProjectFaviconInfo:'noFavicon',exportProjectIconInfo:'useSavedIcon',exportProjectFaviconInfo:'useSavedFavicon'}[id];
 return (key&&window.FlowForgeI18n?.t?.(key))||fallback||ffImgMsg('none');
}
function setImageInfo(id,value,emptyText){
 const el=$('#'+id);if(!el)return;
 let row=el.parentElement;
 if(!row||!row.classList.contains('assetInfoRow')){row=document.createElement('div');row.className='assetInfoRow';el.parentElement.insertBefore(row,el);row.appendChild(el)}
 let thumb=row.querySelector('.assetThumb');
 if(!thumb){thumb=document.createElement('img');thumb.className='assetThumb';thumb.alt='';row.insertBefore(thumb,el)}
 const v=String(value||'');
 if(!v){thumb.hidden=true;thumb.removeAttribute('src');el.classList.remove('hasImage');el.textContent=ffImgEmptyText(id,emptyText);return}
 let src=v;
 if(v.startsWith('asset://')){const a=(project.assets||[]).find(x=>String(x.id)===v.slice(8));src=a?.data||''}
 el.classList.add('hasImage');
 const base=ffImgBrief(v);el.textContent=base;
 if(!src){thumb.hidden=true;thumb.removeAttribute('src');return}
 thumb.hidden=false;
 thumb.onload=()=>{const w=thumb.naturalWidth,h=thumb.naturalHeight;if(w&&h)el.textContent=`${base} · ${w}×${h}`+(w!==h?` · ⚠ ${ffImgMsg('notSquare')}`:'')};
 thumb.onerror=()=>{thumb.hidden=true};
 thumb.src=src;
}
/* Re-render all four info lines (also after a language change, which resets their text). */
function ffRefreshProjectImageInfos(){
 if(typeof project==='undefined'||!project)return;
 setImageInfo('saveProjectIconInfo',project.icon);setImageInfo('saveProjectFaviconInfo',project.favicon);setImageInfo('headerLogoInfo',project.headerLogo,'Nenhum logo definido');
 setImageInfo('exportProjectIconInfo',project.icon);setImageInfo('exportProjectFaviconInfo',project.favicon);
}
function ffKindLabel(kind){return window.FlowForgeToolI18n?.kindLabel?.(kind)||kind}
function ffRefreshDynamicI18n(){
  try{if(typeof props==='function'&&typeof project!=='undefined'&&project)props()}catch(e){}
  /* an open drawer (outline / pages / assets) is rebuilt so its rows use the new language */
  try{
    const dr=$('#studioDrawer');
    if(dr&&!dr.hidden&&typeof openStudioDrawer==='function'){
      const ttl=window.FlowForgeUIText?.t($('#drawerTitle').textContent,'pt-BR')||'';
      const mode=ttl==='Árvore do Projeto'?'outline':ttl==='Páginas'?'pages':ttl==='Assets'?'assets':'';
      if(mode)openStudioDrawer(mode);
    }
  }catch(e){}
}
function ffLinkType(u){const m=/^data:([^;,]+)/i.exec(String(u||''));return m?` type="${esc(m[1])}"`:''}
function projectAssetList(){
 return (project.assets||[]).filter(a=>/^image\//i.test(String(a.type||'')) || /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i.test(String(a.name||'')));
}
let ffProjectAssetPickerKind='';
let ffProjectAssetPickerTarget='';
function openProjectAssetPicker(kind,target){
 ffProjectAssetPickerKind=kind;ffProjectAssetPickerTarget=target;
 const dlg=$('#projectAssetPickerDlg'); if(!dlg)return;
 const search=$('#projectAssetSearch'); if(search)search.value='';
 renderProjectAssetPicker();dlg.showModal();
 setTimeout(()=>search?.focus(),0);
}
function renderProjectAssetPicker(){
 const box=$('#projectAssetList');if(!box)return;
 const q=String($('#projectAssetSearch')?.value||'').trim().toLowerCase();
 const list=projectAssetList().filter(a=>!q||String(a.name||'').toLowerCase().includes(q));
 box.innerHTML='';
 if(!list.length){box.innerHTML='<div class="ffProjectAssetEmpty">Nenhuma imagem encontrada nos Assets.</div>';return;}
 const frag=document.createDocumentFragment();
 list.slice(0,100).forEach(a=>{
  const b=document.createElement('button');b.type='button';b.className='ffProjectAssetItem';
  const img=document.createElement('span');img.className='ffAssetIcon';img.textContent='🖼️';img.setAttribute('aria-hidden','true');
  const meta=document.createElement('span');meta.className='ffAssetMeta';
  const name=document.createElement('span');name.className='ffAssetName';name.textContent=a.name||'Asset';
  const type=document.createElement('span');type.className='ffAssetType';type.textContent=`${a.type||'imagem'} · ${Math.ceil((Number(a.size)||0)/1024)} KB`;
  meta.append(name,type);b.append(img,meta);b.onclick=()=>selectProjectAsset(a);frag.appendChild(b);
 });
 box.appendChild(frag);
}
async function selectProjectAsset(a){
 if(!a)return;
 const kind=ffProjectAssetPickerKind,target=ffProjectAssetPickerTarget;
 $('#projectAssetPickerDlg')?.close();
 let value=`asset://${a.id}`;
 try{if(/^data:image\//i.test(String(a.data||'')))value=await ffFitDataUrl(a.data,kind);else if(kind==='headerLogo')throw new Error('O Asset selecionado não possui dados incorporados em Base64.');}
 catch(err){ideMessage(ffImgMsg('invalid'),err?.message||ffImgMsg('read'),'error');return}
 snapshot();project[kind]=value;setImageInfo(target,value);
 if(target.startsWith('saveProject'))updateSaveReview();
}
async function chooseProjectImage(kind,file,infoId){
 if(!file)return;
 try{const data=await readImageAsBase64(file,kind);snapshot();project[kind]=data;setImageInfo(infoId,data);updateSaveReview();}
 catch(err){ideMessage(ffImgMsg('invalid'),err?.message||ffImgMsg('read'),'error');}
}
function bindImageField(fileId,pickId,clearId,infoId,kind,emptyText){
 $('#'+pickId).onclick=()=>$('#'+fileId).click();
 $('#'+fileId).onchange=async e=>{await chooseProjectImage(kind,e.target.files?.[0],infoId);e.target.value=''};
 $('#'+clearId).onclick=()=>{snapshot();project[kind]='';setImageInfo(infoId,'',emptyText);updateSaveReview()};
}
function syncProjectImageFields(){
 project.projectVersion??='1.0.0';project.icon??='';project.favicon??='';project.headerLogo??='';project.themeColor??='#20242a';
 ffRefreshProjectImageInfos();
}
function openSaveDialog(){
 syncProjectImageFields();
 $('#saveProjectName').value=project.name||'Meu Projeto';$('#saveProjectVersion').value=project.projectVersion;
 $('#saveThemeColor').value=project.themeColor;$('#saveFileName').value=safeFileName(project.name)+'.flowmobile';
 updateSaveReview();$('#saveProjectDlg').showModal();
}
function openExportDialog(){
 syncProjectImageFields();
 setImageInfo('exportProjectIconInfo',project.icon,'Usará o ícone salvo no projeto');
 setImageInfo('exportProjectFaviconInfo',project.favicon,'Usará o favicon salvo no projeto');
 $('#exportHtmlFileName').value='index.html';$('#exportHtmlDlg').showModal();
}
function updateSaveReview(){$('#saveReview').innerHTML=`<b>Projeto:</b> ${esc($('#saveProjectName').value)}<br><b>Versão:</b> ${esc($('#saveProjectVersion').value)}<br><b>Arquivo:</b> ${esc($('#saveFileName').value)}<br><b>Ícone:</b> ${esc(ffImgBrief(project.icon)||'não definido')}<br><b>Favicon:</b> ${esc(ffImgBrief(project.favicon)||'não definido')}<br><b>Logo do Header:</b> ${esc(ffImgBrief(project.headerLogo)||'não definido')}`;}
['saveProjectName','saveProjectVersion','saveFileName','saveThemeColor'].forEach(id=>$('#'+id).addEventListener('input',updateSaveReview));
bindImageField('saveProjectIconFile','saveProjectIconPick','saveProjectIconClear','saveProjectIconInfo','icon');
bindImageField('saveProjectFaviconFile','saveProjectFaviconPick','saveProjectFaviconClear','saveProjectFaviconInfo','favicon');
bindImageField('headerLogoFile','headerLogoPick','headerLogoClear','headerLogoInfo','headerLogo','Nenhum logo definido');
$('#headerLogoAssetPick').onclick=()=>openProjectAssetPicker('headerLogo','headerLogoInfo');
bindImageField('exportProjectIconFile','exportProjectIconPick','exportProjectIconClear','exportProjectIconInfo','icon','Usará o ícone salvo no projeto');
bindImageField('exportProjectFaviconFile','exportProjectFaviconPick','exportProjectFaviconClear','exportProjectFaviconInfo','favicon','Usará o favicon salvo no projeto');
$('#saveProjectIconAssetPick').onclick=()=>openProjectAssetPicker('icon','saveProjectIconInfo');
$('#saveProjectFaviconAssetPick').onclick=()=>openProjectAssetPicker('favicon','saveProjectFaviconInfo');
$('#exportProjectIconAssetPick').onclick=()=>openProjectAssetPicker('icon','exportProjectIconInfo');
$('#exportProjectFaviconAssetPick').onclick=()=>openProjectAssetPicker('favicon','exportProjectFaviconInfo');
$('#projectAssetSearch').oninput=renderProjectAssetPicker;
$('#confirmSaveProject').onclick=e=>{e.preventDefault();project.name=$('#saveProjectName').value.trim()||'Meu Projeto';project.projectVersion=$('#saveProjectVersion').value.trim()||'1.0.0';project.themeColor=$('#saveThemeColor').value;let n=$('#saveFileName').value.trim()||safeFileName(project.name)+'.flowmobile';if(!n.toLowerCase().endsWith('.flowmobile'))n+='.flowmobile';$('#saveProjectDlg').close();render();download(n,JSON.stringify(project,null,2),'application/json');};
function buildExportHtml(){
  saveEventBodiesFromEditor();
  const raw=generated();
  return window.FlowForgeImageAssets?.resolveHtml?.(raw) ?? raw;
}
$('#confirmExportHtml').onclick=e=>{
  e.preventDefault();
  const rawName=$('#exportHtmlFileName').value.trim()||'index.html';
  let n=safeFileName(rawName);
  if(!n.toLowerCase().endsWith('.html'))n+='.html';
  $('#exportHtmlDlg').close();
  const html=buildExportHtml();
  saveWithDialog(n,html,'text/html;charset=utf-8');
};
$('#wysCancel').onclick=()=>$('#labelWysiwygDlg').close();
$$('#labelWysiwygDlg [data-cmd]').forEach(b=>b.addEventListener('mousedown',e=>{e.preventDefault();document.execCommand(b.dataset.cmd,false,null)}));
$('#wysFontName').onchange=e=>{document.execCommand('fontName',false,e.target.value);$('#labelWysiwygEditor').focus()};
$('#wysFontSize').onchange=e=>{document.execCommand('fontSize',false,e.target.value);$('#labelWysiwygEditor').focus()};
$('#wysTextColor').oninput=e=>{document.execCommand('foreColor',false,e.target.value);$('#labelWysiwygEditor').focus()};
$('#wysBgColor').oninput=e=>{document.execCommand('hiliteColor',false,e.target.value);$('#labelWysiwygEditor').focus()};
$('#wysLink').onclick=()=>{const u=prompt('URL do link:','https://');if(u)document.execCommand('createLink',false,u)};
$('#wysApply').onclick=()=>{if(!selected||selected.kind!=='label')return;snapshot();const ed=$('#labelWysiwygEditor');selected.text=ed.innerHTML;selected.allowHtml=true;selected.multiline=true;$('#labelWysiwygDlg').close();render()};
$('#projectName').onchange=e=>{snapshot();let old=project.name;project.name=e.target.value;if(project.titlebar&&project.titlebar.text===old)project.titlebar.text=project.name;render()};$('#projectType').onchange=e=>{snapshot();project.type=e.target.value;ensureSiteChrome(project);ffApplyViewport(project.type);render()};function applyFrameworkPreview(){
  const fw=project.framework||'none';
  const stage=$('#stage');
  if(stage){
    stage.dataset.framework=fw;
    stage.dataset.designerMode=project.designerMode||'framework';
  }
  applyFrameworkDesignerCSS();
  $('#framework').value=fw;
  $('#frameworkTop').value=fw;

  // Do not rebuild the stage here. Rebuilding it would recreate every image
  // element and can decode large Base64 assets synchronously.
  const items=[];
  (project.pages||[]).forEach(p=>(p.items||[]).forEach(x=>items.push(x)));
  if(project.type==='app' && project.titlebar){
    const tb=stage?.querySelector('.app-titlebar');
    if(tb){
      tb.innerHTML=titlebarContent(project.titlebar);
      tb.style.height=project.titlebar.height||'52px';
    }
  }

  selected=null;
  stage?.querySelectorAll('.component.selected,.app-titlebar.selected').forEach(el=>{
    el.classList.remove('selected');
    el.querySelectorAll(':scope > .handle').forEach(h=>h.remove());
  });

  let i=0;
  const token=Symbol('framework-update');
  window.__ffFrameworkUpdateToken=token;
  const step=()=>{
    if(window.__ffFrameworkUpdateToken!==token)return;
    const end=Math.min(i+50,items.length);
    for(;i<end;i++){
      const x=items[i];
      // Images are intentionally left untouched. Framework styling does not
      // change their markup, and replacing them would force large image decode.
      if(x.kind==='image'||x.kind==='picturebox')continue;
      const d=stage?.querySelector(`.component[data-id="${CSS.escape(String(x.id))}"]`);
      if(!d)continue;
      d.className='component '+x.kind+' ff-kind-'+x.kind;
      d.innerHTML=content(x);
      ffInitCanvasElement(d,x);
    }
    if(i<items.length)requestAnimationFrame(step);
    else {
      props();
      $('#selectionInfo').textContent='';
    }
  };
  requestAnimationFrame(step);
}
function snapshotFramework(){
  undoStack.push(JSON.stringify({__ffHistoryType:'framework',framework:project.framework||'none'}));
  if(undoStack.length>80)undoStack.shift();
  future=[];
}
function setFramework(v){
  v=v||'none';
  if(project.framework===v)return;
  snapshotFramework();
  project.framework=v;
  applyFrameworkPreview();
}
function setDesignerMode(v){snapshot();project.designerMode=v==='flowforge'?'flowforge':'framework'}$('#framework').onchange=e=>setFramework(e.target.value);$('#frameworkTop').onchange=e=>setFramework(e.target.value);$('#designerMode').onchange=e=>setDesignerMode(e.target.value);$('#designerModeTop').onchange=e=>setDesignerMode(e.target.value);$('#projectPageTop').onchange=e=>ffSwitchPage(e.target.value);$('#saveBtn').onclick=()=>{saveEventBodiesFromEditor();openSaveDialog()};$('#exportBtn').onclick=()=>{saveEventBodiesFromEditor();openExportDialog()};function download(n,c,t){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function saveWithDialog(n,c,t){
  const blob=new Blob([c],{type:t});
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const handle=await window.showSaveFilePicker({
        suggestedName:n,
        types:[{description:'Arquivo HTML',accept:{'text/html':['.html','.htm']}}],
        excludeAcceptAllOption:false
      });
      const writable=await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }catch(err){
      if(err?.name==='AbortError')return false;
      console.warn('[FlowForge] Save File Picker indisponível:',err);
    }
  }
  download(n,c,t);
  return false;
}
function ideMessage(title,message,type='info'){
 $('#ideMsgTitle').textContent=title||'FlowForge webstudio 0.6 Beta';
 $('#ideMsgText').textContent=message||'';
 $('#ideMsgDlg').dataset.type=type;
 $('#ideMsgDlg').showModal();
}
$('#openBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=async e=>{try{
 const raw=JSON.parse(await e.target.files[0].text());
 if(!raw || typeof raw!=='object') throw new Error('O arquivo não contém um projeto.');
 // Compatibilidade com projetos FlowForge antigos e exemplos externos.
 raw.name??='Projeto';
 raw.type??='app'; raw.framework??='none'; raw.projectVersion??='1.0.0';
 raw.icon??='';raw.favicon??='';raw.headerLogo??='';raw.themeColor??='#20242a';raw.titlebar??=(raw.type==='app');
 if(!Array.isArray(raw.pages)||!raw.pages.length) throw new Error('O projeto não possui páginas.');
 raw.active=Number.isInteger(raw.active)?raw.active:0;
 raw.active=Math.max(0,Math.min(raw.active,raw.pages.length-1));
 raw.pages.forEach((p,i)=>{p.id??=uid();p.name=String(p.name??`Página_${i+1}`).trim().replace(/\s+/g,'_')||`Página_${i+1}`;p.items=Array.isArray(p.items)?p.items:[];p.items.forEach(x=>{if(x.kind==='fileupload')x.kind='file';x.visible??=true;x.enabled??=true;x.events=(x.events&&typeof x.events==='object')?x.events:{};});});
 raw.activePage=raw.pages[raw.active]?.id;ensureSiteChrome(raw);
 ensureProjectNames(raw);
 project=raw; selected=null;undoStack=[];future=[];render();
 ideMessage('Projeto aberto',`"${project.name}" foi carregado com sucesso.`);
 }catch(err){ideMessage('Não foi possível abrir o projeto',err?.message||'Arquivo de projeto inválido.','error')}
 finally{e.target.value=''}
};function openSiteWizard(type){
 const dlg=$('#siteWizardDlg'); if(!dlg)return;
 dlg.dataset.projectType=type;
 const isApp=type==='app';
 $('#siteWizardTitle').textContent=isApp?'Novo App — Configuração inicial':(type==='landing'?'Novo Landing Page — Configuração inicial':'Novo Site — Configuração inicial');
 const desc=dlg.querySelector('.ffWizardHead p');if(desc)desc.textContent=isApp?'Defina a estrutura inicial do aplicativo. As escolhas serão aplicadas automaticamente às páginas.':'Defina a estrutura inicial. As escolhas serão aplicadas automaticamente a todas as páginas.';
 $('#wizPageNames').value=window.FlowForgeUIText?.t(isApp?'Home, Tela 2':'Home, Sobre, Contato')||(isApp?'Home, Tela 2':'Home, Sobre, Contato');
 $('#wizNavigation').value='navbar'; $('#wizHeader').checked=!isApp; $('#wizFooter').checked=!isApp; $('#wizFrameworkStyle').checked=true; $('#wizFramework').value='none';
 const h=$('#wizHeader')?.closest('.ffWizardChoice'),f=$('#wizFooter')?.closest('.ffWizardChoice'),tb=$('#wizTitlebar')?.closest('.ffWizardChoice');
 if(h)h.style.display=isApp?'none':'flex';if(f)f.style.display=isApp?'none':'flex';if(tb)tb.style.display=isApp?'flex':'none';
 if($('#wizTitlebar'))$('#wizTitlebar').checked=true;
 dlg.showModal();
}
function configureSiteWizard(type){
 const names=($('#wizPageNames').value||'').split(',').map(x=>x.trim()).filter(Boolean);
 const pageNames=type==='landing'?(names.length? [names[0]]:['Home']):(names.length?names:(type==='app'?['Home','Tela 2']:['Home','Sobre','Contato']));
 project=fresh(type); project.framework=$('#wizFramework').value||'none';
 project.designerMode='framework';
 project.pages=pageNames.map((name)=>({id:uid(),name,slug:sanitizeName(name,'pagina').toLowerCase(),items:[]}));
 project.active=0; project.activePage=project.pages[0].id;
 const isApp=type==='app';
 const header=!isApp && $('#wizHeader').checked, footer=!isApp && $('#wizFooter').checked, nav=$('#wizNavigation').value;
 project.siteLayout={header,footer,navigation:nav,frameworkStyle:$('#wizFrameworkStyle').checked,titlebar:isApp?($('#wizTitlebar')?.checked!==false):false};
 project.titlebar=project.titlebar||{name:'titlebar1',text:project.name,height:'52px',bg:'#20242a',color:'#ffffff',showMenu:true,autoStyle:true};
 project.pages.forEach(page=>{
   const items=[];
   const auto={visible:true,enabled:true,ffSystem:'siteChrome',frameworkStyle:project.siteLayout.frameworkStyle?'auto':false,events:{}};
   if(header) items.push({id:uid(),kind:'header',name:'siteHeader',text:project.name||'Minha Marca',x:0,y:0,width:'100%',height:'72px',bg:'#111827',color:'#ffffff',...auto});
   if(nav!=='none') { const y=isApp?52:72; const h=(nav==='bottomnav'||nav==='toolbar')?60:52; const isSidebar=nav==='sidebar'; items.push({id:uid(),kind:nav,name:'siteNavigation',text:'Navegação',x:0,y:isSidebar?y:y,width:isSidebar?'260px':'100%',height:isSidebar?'calc(100% - '+y+'px)':h+'px',bg:'#1f2937',color:'#ffffff',...auto}); }
   if(footer) items.push({id:uid(),kind:'footer',name:'siteFooter',text:'',x:0,y:900,width:'100%',height:'90px',bg:'#111827',color:'#ffffff',...auto});
   page.items=items;
 });
 selected=null;undoStack=[];future=[];ffApplyViewport(type);render();
}
$('#newBtn').onclick=()=>$('#newDlg').showModal();$$('[data-new]').forEach(b=>b.onclick=e=>{
 e.preventDefault();
 const type=b.dataset.new;
 $('#newDlg').close();
 if(type==='site'||type==='landing'||type==='app') openSiteWizard(type);
});
$('#wizCancel').onclick=()=>$('#siteWizardDlg').close();
$('#wizCreate').onclick=()=>{$('#siteWizardDlg').close();configureSiteWizard($('#siteWizardDlg').dataset.projectType||'site')};
$('#undoBtn').onclick=()=>{
  if(!undoStack.length)return;
  const entry=JSON.parse(undoStack.pop());
  if(entry?.__ffHistoryType==='framework'){
    future.push(JSON.stringify({__ffHistoryType:'framework',framework:project.framework||'none'}));
    project.framework=entry.framework||'none';
    applyFrameworkPreview();
    return;
  }
  future.push(JSON.stringify(project));
  const vp=project.viewport;
  project=entry;
  if(vp)project.viewport=vp;
  selected=null;
  render();
};
$('#redoBtn').onclick=()=>{
  if(!future.length)return;
  const entry=JSON.parse(future.pop());
  if(entry?.__ffHistoryType==='framework'){
    undoStack.push(JSON.stringify({__ffHistoryType:'framework',framework:project.framework||'none'}));
    project.framework=entry.framework||'none';
    applyFrameworkPreview();
    return;
  }
  undoStack.push(JSON.stringify(project));
  const vp=project.viewport;
  project=entry;
  if(vp)project.viewport=vp;
  selected=null;
  render();
};$$('#tabs button').forEach(b=>b.onclick=()=>{$$('#tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');let t=b.dataset.tab;activateTab(t);updateCode()});$('#previewBtn').onclick=()=>{let w=open();w.document.write(generated());w.document.close()};$('#helpBtn').onclick=()=>{const w=window.open('ajuda.html','flowforgeHelp','popup=yes,width=1200,height=800,resizable=yes,scrollbars=yes');if(w)w.focus();};$('#startupOpen').onclick=()=>{ $('#newDlg').close(); $('#fileInput').click(); };$('#examplesBtn').onclick=showExamples;$('#startupExamples').onclick=()=>{ $('#newDlg').close(); showExamples(); };
// -----------------------------------------------------------------------------
// FlowForge IntelliSense - autocomplete leve, sem bibliotecas externas.
// Sugere os nomes dos componentes do projeto e, depois de "componente.",
// propriedades úteis do elemento DOM correspondente.
// -----------------------------------------------------------------------------
const FF_INTEL_COMMON=[
 ['visible','Mostrar/ocultar componente'],['enabled','Habilitar/desabilitar componente'],
 ['style','Estilos CSS'],['hidden','Mostrar/ocultar'],['className','Classes CSS'],
 ['id','ID HTML'],['title','Texto de dica'],['click()','Executar clique'],
 ['focus()','Receber foco'],['addEventListener()','Adicionar evento'],
 ['getAttribute()','Ler atributo'],['setAttribute()','Alterar atributo']
];
const FF_INTEL_GLOBAL={
 http:[['get()','GET • retorna resposta HTTP'],['post()','POST JSON • retorna resposta HTTP'],['put()','PUT JSON • retorna resposta HTTP'],['patch()','PATCH JSON • retorna resposta HTTP'],['delete()','DELETE • retorna resposta HTTP'],['request()','Requisição HTTP completa'],['timeout','Timeout padrão em milissegundos']],
 db:[['createTable()','Criar tabela local'],['insert()','Inserir registro'],['select()','Consultar registros'],['get()','Buscar registro por ID'],['update()','Atualizar registro'],['delete()','Excluir registro'],['clear()','Limpar tabela'],['count()','Contar registros'],['dropTable()','Excluir tabela']]
};
const FF_INTEL_BY_KIND={
 button:[['textContent','Texto do botão'],['disabled','Habilitado/desabilitado'],['value','Valor']],
 gradientbutton:[['textContent','Texto do botão'],['disabled','Habilitado/desabilitado']],
 iconbutton:[['textContent','Ícone/texto'],['disabled','Habilitado/desabilitado']],
 textbox:[['value','Texto digitado'],['placeholder','Texto de exemplo'],['disabled','Desabilitado'],['readOnly','Somente leitura'],['maxLength','Máximo de caracteres'],['select()','Selecionar texto']],
 textarea:[['value','Texto digitado'],['placeholder','Texto de exemplo'],['rows','Número de linhas'],['disabled','Desabilitado'],['readOnly','Somente leitura'],['select()','Selecionar texto']],
 checkbox:[['checked','Marcado/desmarcado'],['disabled','Desabilitado'],['value','Valor']],
 radio:[['checked','Marcado/desmarcado'],['disabled','Desabilitado'],['value','Valor']],
 switch:[['checked','Ligado/desligado'],['disabled','Desabilitado']],
 select:[['value','Valor selecionado'],['selectedIndex','Índice selecionado'],['options','Opções'],['disabled','Desabilitado']],
 slider:[['value','Valor atual'],['min','Valor mínimo'],['max','Valor máximo'],['step','Incremento'],['disabled','Desabilitado']],
 date:[['value','Data selecionada'],['min','Data mínima'],['max','Data máxima']],
 time:[['value','Hora selecionada'],['min','Hora mínima'],['max','Hora máxima']],
 picturebox:[['src','URL/caminho da imagem'],['alt','Texto alternativo'],['objectFit','Ajuste da imagem'],['naturalWidth','Largura original'],['naturalHeight','Altura original']],
 image:[['src','URL/caminho da imagem'],['alt','Texto alternativo'],['naturalWidth','Largura original'],['naturalHeight','Altura original']],
 video:[['src','Fonte do vídeo'],['currentTime','Posição atual'],['volume','Volume'],['muted','Sem áudio'],['play()','Reproduzir'],['pause()','Pausar']],
 audio:[['src','Fonte do áudio'],['currentTime','Posição atual'],['duration','Duração'],['volume','Volume 0 a 1'],['muted','Sem áudio'],['loop','Repetir'],['playbackRate','Velocidade'],['paused','Está pausado'],['play()','Reproduzir'],['pause()','Pausar'],['load()','Recarregar mídia']],
 iframe:[['src','Endereço da página'],['contentWindow','Janela interna'],['contentDocument','Documento interno']],
 canvas:[['width','Largura interna'],['height','Altura interna'],['getContext()','Obter contexto de desenho']],
 form:[['reset()','Limpar formulário'],['requestSubmit()','Enviar formulário'],['checkValidity()','Validar formulário']],
 progress:[['value','Valor atual'],['max','Valor máximo']],
 label:[['textContent','Texto exibido'],['innerHTML','HTML interno']],
 heading:[['textContent','Texto exibido'],['innerHTML','HTML interno']],
 link:[['textContent','Texto exibido'],['href','Endereço do link'],['target','Destino']],
 battery:[['dataset.value','Valor do indicador']],
 thermometer:[['dataset.value','Temperatura']],
 led:[['dataset.state','Estado do LED']],
 sevenseg:[['textContent','Valor exibido']],
 dotmatrix:[['textContent','Texto exibido']],
 sparkline:[['dataset.values','Valores do gráfico']],
 valuecard:[['textContent','Valor/texto']],
 statuscard:[['textContent','Status/texto']],
qrcode:[['textContent','Texto codificado no QR Code'],['qrcodeSize','Tamanho do QR Code'],['visible','Mostrar/ocultar'],['enabled','Habilitado/desabilitado']]
};
const FF_INTEL_EXAMPLES={
 textContent:'Ex.: button1.textContent = "Salvar";',
 innerHTML:'Ex.: label1.innerHTML = "<b>Olá</b>";',
 value:'Ex.: textBox1.value = "João";',
 checked:'Ex.: checkBox1.checked = true;',
 disabled:'Ex.: button1.disabled = true;',
 hidden:'Ex.: panel1.hidden = true;',
 visible:'Ex.: button1.visible = true;',
 enabled:'Ex.: button1.enabled = false;',
 className:'Ex.: card1.className = "card shadow";',
 src:'Ex.: picturebox1.src = "foto.jpg";',
 objectFit:'Ex.: picturebox1.style.objectFit = "cover";',
 href:'Ex.: link1.href = "https://exemplo.com";',
 currentTime:'Ex.: video1.currentTime = 0;',
 volume:'Ex.: audio1.volume = 0.5;',
 'play()':'Ex.: video1.play();',
 'pause()':'Ex.: video1.pause();',
 'focus()':'Ex.: textBox1.focus();',
 'click()':'Ex.: button1.click();',
 'addEventListener()':'Ex.: button1.addEventListener("click", () => { });',
 'getAttribute()':'Ex.: button1.getAttribute("title");',
 'setAttribute()':'Ex.: picturebox1.setAttribute("alt", "Foto");',
 'querySelector()':'Ex.: card1.querySelector(".titulo");',
 'getContext()':'Ex.: canvas1.getContext("2d");',
 'reset()':'Ex.: form1.reset();',
 'requestSubmit()':'Ex.: form1.requestSubmit();',
 style:'Ex.: button1.style.backgroundColor = "red";',
 selectedIndex:'Ex.: select1.selectedIndex = 0;',
 placeholder:'Ex.: textBox1.placeholder = "Digite seu nome";',
 maxLength:'Ex.: textBox1.maxLength = 50;',
 readOnly:'Ex.: textBox1.readOnly = true;',
 min:'Ex.: slider1.min = 0;',
 max:'Ex.: slider1.max = 100;',
 step:'Ex.: slider1.step = 5;',
 target:'Ex.: link1.target = "_blank";'
};
Object.assign(FF_INTEL_EXAMPLES,{
 'get()':'Ex.: const resposta = await http.get("https://api.exemplo.com/users");',
 'post()':'Ex.: await http.post("/api/users", {name:"João"});',
 'put()':'Ex.: await http.put("/api/users/1", {name:"Maria"});',
 'patch()':'Ex.: await http.patch("/api/users/1", {active:true});',
 'delete()':'Ex.: await http.delete("/api/users/1");',
 'request()':'Ex.: await http.request(url, {method:"GET", timeout:10000});',
 'createTable()':'Ex.: await db.createTable("users");',
 'insert()':'Ex.: const id = await db.insert("users", {name:"João"});',
 'select()':'Ex.: const users = await db.select("users");',
 'update()':'Ex.: await db.update("users", 1, {name:"Maria"});',
 'clear()':'Ex.: await db.clear("users");',
 'count()':'Ex.: const total = await db.count("users");',
 'dropTable()':'Ex.: await db.dropTable("users");'
});
function intelDescription(item){
 const key=item[0], ex=FF_INTEL_EXAMPLES[key];
 return ex ? `${item[1]} • ${ex}` : item[1];
}
function intelPropsFor(name){
 const comp=project.pages.flatMap(p=>p.items).find(x=>x.name===name);
 const specific=comp?(FF_INTEL_BY_KIND[comp.kind]||[]):[];
 const seen=new Set(); return [...specific,...FF_INTEL_COMMON].filter(x=>!seen.has(x[0])&&seen.add(x[0]));
}
function ensureIntellisense(){
 if($('#ffIntellisense'))return;
 let d=document.createElement('div');d.id='ffIntellisense';d.hidden=true;
 $('#codeEditor').append(d);
}
function componentSuggestions(){
 return project.pages.flatMap(p=>p.items).map(x=>[x.name,`${ffKindLabel(x.kind)} • ${x.text||''}`]);
}
function hideIntellisense(){let d=$('#ffIntellisense');if(d)d.hidden=true}

function positionIntellisenseAtCaret(ta,box){
 const wrap=$('#codeEditor'), cs=getComputedStyle(ta), text=ta.value.slice(0,ta.selectionStart);
 const lines=text.split('\n'), line=lines.length-1, col=lines[lines.length-1].length;
 const probe=document.createElement('span');
 probe.style.cssText=`position:absolute;visibility:hidden;white-space:pre;font:${cs.font};font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing}`;
 probe.textContent=lines[lines.length-1].slice(0,col)||' ';
 document.body.appendChild(probe);
 const x=ta.offsetLeft+parseFloat(cs.paddingLeft||0)+probe.getBoundingClientRect().width-ta.scrollLeft;
 const lh=parseFloat(cs.lineHeight)||18;
 let y=ta.offsetTop+parseFloat(cs.paddingTop||0)+(line+1)*lh-ta.scrollTop+3;
 probe.remove();
 const maxX=Math.max(6,wrap.clientWidth-box.offsetWidth-8);
 let left=Math.min(Math.max(6,x),maxX);
 if(y+box.offsetHeight>wrap.clientHeight-6) y=Math.max(6,y-box.offsetHeight-lh-6);
 box.style.left=left+'px'; box.style.top=y+'px'; box.style.bottom='auto';
}
function showIntellisense(){
 ensureIntellisense();
 const ta=$('#code'), box=$('#ffIntellisense'), pos=ta.selectionStart;
 const before=ta.value.slice(0,pos), line=before.slice(before.lastIndexOf('\n')+1);
 let list=[], replaceStart=pos;
 const dot=line.match(/([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)?$/);
 if(dot){
   const name=dot[1], q=dot[2]||'';
   if(FF_INTEL_GLOBAL[name]){
     list=FF_INTEL_GLOBAL[name].filter(x=>x[0].toLowerCase().startsWith(q.toLowerCase()));
     replaceStart=pos-q.length;
   }else if(componentSuggestions().some(x=>x[0]===name)){
     list=intelPropsFor(name).filter(x=>x[0].toLowerCase().startsWith(q.toLowerCase()));
     replaceStart=pos-q.length;
   }
 }else{
   const m=line.match(/([A-Za-z_$][\w$]*)$/), q=m?m[1]:'';
   if(q.length) {
     const globals=Object.keys(FF_INTEL_GLOBAL).map(k=>[k,'API FlowForge']);
     list=[...globals,...componentSuggestions()].filter(x=>x[0].toLowerCase().startsWith(q.toLowerCase()));
     replaceStart=pos-q.length;
   }
 }
 if(!list.length){hideIntellisense();return}
 box.innerHTML=''; box.hidden=false; box.dataset.start=replaceStart;
 // Posiciona a lista junto ao cursor do textarea (linha/coluna atuais).
 requestAnimationFrame(()=>positionIntellisenseAtCaret(ta,box));
 list.slice(0,12).forEach((it,i)=>{
   let b=document.createElement('button');b.type='button';b.className='ffIntelItem'+(i===0?' active':'');
   b.innerHTML=`<b>${esc(it[0])}</b><small>${esc(intelDescription(it))}</small>`;
   b.onmousedown=e=>{e.preventDefault();applyIntellisense(it[0])}; box.append(b);
 });
}
function applyIntellisense(value){
 const ta=$('#code'), start=+$('#ffIntellisense').dataset.start, end=ta.selectionStart;
 ta.setRangeText(value,start,end,'end');hideIntellisense();syncCodeHighlight();ta.focus();
}

$('#code').addEventListener('scroll',syncCodeHighlight);$('#code').addEventListener('input',()=>{syncCodeHighlight();showIntellisense();clearTimeout(window.__ffCodeTimer);window.__ffCodeTimer=setTimeout(saveEventBodiesFromEditor,250)});$('#code').addEventListener('keydown',e=>{if(e.key==='Escape'){hideIntellisense();return}
 if(!$('#ffIntellisense')?.hidden && (e.key==='Enter'||e.key==='Tab')){e.preventDefault();let a=$('#ffIntellisense .active')||$('#ffIntellisense .ffIntelItem');if(a){applyIntellisense(a.querySelector('b').textContent);return}}
 if(!$('#ffIntellisense')?.hidden && (e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();let items=[...document.querySelectorAll('#ffIntellisense .ffIntelItem')],i=Math.max(0,items.findIndex(x=>x.classList.contains('active')));items[i]?.classList.remove('active');i=e.key==='ArrowDown'?(i+1)%items.length:(i-1+items.length)%items.length;items[i]?.classList.add('active');items[i]?.scrollIntoView({block:'nearest'});return}if(e.key==='Tab'){e.preventDefault();let a=e.target.selectionStart,b=e.target.selectionEnd;e.target.setRangeText('    ',a,b,'end');syncCodeHighlight()}});$('#propTab').onclick=()=>{$('#propTab').classList.add('active');$('#actionTab').classList.remove('active');$('#propertiesPanel').hidden=false;$('#actionsPanel').hidden=true};
$('#actionTab').onclick=()=>{$('#actionTab').classList.add('active');$('#propTab').classList.remove('active');$('#propertiesPanel').hidden=true;$('#actionsPanel').hidden=false;renderActions()};
$('#addActionBtn').onclick=()=>{if(!selected)return;let ev=$('#actionEventSelect').value;if(!ev)return;snapshot();selected.events??={};selected.events[ev]=`// ${selected.name}: ${ev}\n`;renderActions();updateCode();openAction(selected,ev)};

function ffApplyViewport(type){if(window.FFDesignerViewport)window.FFDesignerViewport.reset(type);else{let w=type==='app'?'390':'1200';$('#stage').style.width=w+'px'}window.FFProjectModes?.responsive?.()}
window.ffApplyViewport=ffApplyViewport;
function ffItems(){return project?.pages?.[project.active]?.items||project?.items||[]}
window.ffSelected=()=>selected;
function ffById(id){return (project?.pages||[]).flatMap(p=>p.items||[]).find(x=>x.id===id)}
window.ffById=ffById;
function ffPageName(id){let p=(project?.pages||[]).find(x=>x.id===id);return p?p.name:''}
window.ffPageName=ffPageName;
function ffEnsurePages(){return FlowForge.modules.pages.ensure(project)}
window.ffEnsurePages=ffEnsurePages;
function ffAttachNavigationUI(){ffEnsurePages();renderPages()}
window.ffAttachNavigationUI=ffAttachNavigationUI;
function ffSwitchPage(id){ffEnsurePages();let i=project.pages.findIndex(x=>x.id===id);if(i<0)return;snapshot();project.active=i;project.activePage=id;selected=null;render();if(typeof openStudioDrawer==='function'&&!$('#studioDrawer').hidden&&$('#drawerTitle').textContent==='Páginas')openStudioDrawer('pages')}
window.ffSwitchPage=ffSwitchPage;
function ffAddPage(name){snapshot();let p=FlowForge.modules.pages.add(project,name||'Nova Página');ensureSiteChrome(project);project.active=project.pages.length-1;project.activePage=p.id;selected=null;render();if(typeof openStudioDrawer==='function'&&!$('#studioDrawer').hidden&&$('#drawerTitle').textContent==='Páginas')openStudioDrawer('pages');return p}
window.ffAddPage=ffAddPage;
function ffRenamePage(id,name){ffEnsurePages();snapshot();if(!FlowForge.modules.pages.rename(project,id,name)){undoStack.pop();return null}render();if(typeof openStudioDrawer==='function'&&!$('#studioDrawer').hidden&&$('#drawerTitle').textContent==='Páginas')openStudioDrawer('pages');return project.pages.find(p=>p.id===id)}
window.ffRenamePage=ffRenamePage;
function ffDeletePage(id){if(project.pages.length<=1){alert('O projeto precisa ter ao menos uma página.');return}if(!confirm('Excluir esta página? Essa ação não pode ser desfeita.'))return;snapshot();let ok=FlowForge.modules.pages.remove(project,id);if(!ok){undoStack.pop();return}selected=null;render();if(typeof openStudioDrawer==='function'&&!$('#studioDrawer').hidden&&$('#drawerTitle').textContent==='Páginas')openStudioDrawer('pages')}
window.ffDeletePage=ffDeletePage;
function ffTreeRow(x,depth,container){let row=document.createElement('button');row.className='treeItem';row.style.paddingLeft=(10+depth*14)+'px';row.textContent=ffKindLabel(x.kind||'')+': '+(x.name||(window.FlowForgeUIText?.t('(sem nome)')||'(sem nome)'));if(selected&&selected.id===x.id)row.style.background='#3c414b';row.onclick=()=>{selected=x;render()};container.append(row);ffItems().filter(c=>c.parentId===x.id).forEach(c=>ffTreeRow(c,depth+1,container))}
window.ffTreeRow=ffTreeRow;
function refreshVisualTargets(){let q=$('#visualActionTarget');if(!q)return;let typ=$('#visualActionType')?.value;if(typ==='goPage')q.innerHTML=(project.pages||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (#/${esc(p.slug||p.id)})</option>`).join('');else q.innerHTML=ffItems().map(x=>`<option value="${x.name}">${x.name} (${esc(ffKindLabel(x.kind))})</option>`).join('')}
function openStudioDrawer(mode){let d=$('#studioDrawer'),b=$('#drawerBody');d.hidden=false;$('#drawerTitle').textContent=mode==='outline'?'Árvore do Projeto':mode==='pages'?'Páginas':'Assets';b.innerHTML='';
 if(mode==='outline'){let root=document.createElement('div');root.className='treeRoot';root.textContent='▾ '+(project.name||'Projeto');b.append(root);ffItems().forEach(x=>{let r=document.createElement('button');r.className='treeItem';r.textContent=`${x.visible===false?'○':'●'} ${x.name} · ${ffKindLabel(x.kind)}`;r.onclick=()=>{selected=x;render();props()};b.append(r)})}
 if(mode==='pages'){let pages=FlowForge.modules.pages.ensure(project);pages.forEach(p=>{let r=document.createElement('button');r.className='treeItem';r.textContent=(p.id===project.activePage?'● ':'○ ')+p.name;r.onclick=()=>{snapshot();project.activePage=p.id;project.active=Math.max(0,pages.findIndex(x=>x.id===p.id));selected=null;render();openStudioDrawer('pages')};b.append(r)});let a=document.createElement('button');a.textContent='＋ Nova página';a.onclick=()=>{let n=prompt('Nome da página','Nova Página');if(n){FlowForge.modules.pages.add(project,n);openStudioDrawer('pages')}};b.append(a)}
 if(mode==='assets'){let assets=FlowForge.modules.assets.ensure(project),inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.onchange=async()=>{for(const f of [...inp.files])await FlowForge.modules.assets.add(project,f);openStudioDrawer('assets')};b.append(inp);assets.forEach(a=>{let r=document.createElement('div');r.className='assetRow';r.textContent=`${a.name} · ${Math.ceil(a.size/1024)} KB`;b.append(r)})}}

$('#outlineBtn').onclick=()=>openStudioDrawer('outline');$('#pagesBtn').onclick=()=>openStudioDrawer('pages');$('#assetsBtn').onclick=()=>openStudioDrawer('assets');$('#drawerClose').onclick=()=>$('#studioDrawer').hidden=true;
document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>ffAlign(b.dataset.align));$('#dockSelect').onchange=e=>{if(selected){snapshot();selected.dock=e.target.value;render();props()}};
$('#visualActionType').onchange=()=>refreshVisualTargets();$('#addVisualActionBtn').onclick=()=>{if(!selected)return;let ev=$('#actionEventSelect').value||Object.keys(selected.events||{})[0]||defaultEvent(selected.kind);selected.events??={};selected.events[ev]??=`// ${selected.name}: ${ev}\n`;let typ=$('#visualActionType').value,tgt=$('#visualActionTarget').value;let a=FlowForge.modules.visualActions.create(typ,tgt,$('#visualActionProperty').value,$('#visualActionValue').value);if(typ==='goPage')a.value=tgt;selected.visualActions??={};(selected.visualActions[ev]??=[]).push(a);selected.events[ev]+=`\n${FlowForge.modules.visualActions.toJS(a)}\n`;updateCode();renderActions()};

// ===== v0.13.0 Designer productivity =====
let ffMulti=[];
function ffSelection(){return ffMulti.length?ffMulti:(selected?[selected]:[])}
function ffClearMulti(){ffMulti=[];document.querySelectorAll('.component.ff-multi').forEach(e=>e.classList.remove('ff-multi'))}
function ffMarkMulti(){document.querySelectorAll('.component').forEach(el=>{let x=ffItems().find(i=>i.id===el.dataset.id);el.classList.toggle('ff-multi',ffMulti.includes(x))})}
function ffToggleMulti(item){let i=ffMulti.indexOf(item);if(i>=0)ffMulti.splice(i,1);else ffMulti.push(item);selected=item;ffMarkMulti();props()}
function ffAlign(mode){let a=ffSelection();if(a.length<2)return;snapshot();FlowForge.modules.layout.align(a,mode);render();ffMarkMulti()}
function ffEqual(mode){let a=ffSelection();if(a.length<2)return;snapshot();let v=mode==='width'?a[0].width:a[0].height;a.forEach(x=>x[mode==='width'?'width':'height']=v);render();ffMarkMulti()}
function ffDistribute(axis){let a=ffSelection();if(a.length<3)return;snapshot();a=[...a].sort((x,y)=>axis==='x'?x.x-y.x:x.y-y.y);let first=a[0],last=a[a.length-1],size=a.reduce((n,x)=>n+(axis==='x'?parseFloat(x.width)||0:parseFloat(x.height)||0),0),span=(axis==='x'?last.x+(parseFloat(last.width)||0)-first.x:last.y+(parseFloat(last.height)||0)-first.y),gap=(span-size)/(a.length-1),pos=axis==='x'?first.x:first.y;a.forEach(x=>{if(axis==='x'){x.x=pos;pos+=(parseFloat(x.width)||0)+gap}else{x.y=pos;pos+=(parseFloat(x.height)||0)+gap}});render();ffMarkMulti()}
function ffZ(dir){let a=ffSelection();if(!a.length)return;snapshot();a.forEach(x=>{let i=ffItems().indexOf(x);if(dir==='front'){ffItems().splice(i,1);ffItems().push(x)}else if(dir==='back'){ffItems().splice(i,1);ffItems().unshift(x)}else if(dir==='up'&&i<ffItems().length-1){[ffItems()[i],ffItems()[i+1]]=[ffItems()[i+1],ffItems()[i]]}else if(dir==='down'&&i>0){[ffItems()[i],ffItems()[i-1]]=[ffItems()[i-1],ffItems()[i]]}});render();ffMarkMulti()}
function ffCopy(){let a=ffSelection();if(a.length)localStorage.setItem('ffClipboard',JSON.stringify(a))}
function ffPaste(){let raw=localStorage.getItem('ffClipboard');if(!raw)return;try{let a=JSON.parse(raw);snapshot();ffMulti=[];a.forEach(o=>{let n=JSON.parse(JSON.stringify(o));n.id=uid();n.name=uniqueName(n.kind);n.x=(n.x||0)+16;n.y=(n.y||0)+16;ffItems().push(n);ffMulti.push(n)});selected=ffMulti.at(-1);render();ffMarkMulti();props()}catch(e){console.error('[FlowForge clipboard]',e);ideMessage('Colar','Não foi possível colar os componentes.','error')}}
function ffCut(){ffCopy();let a=ffSelection();if(!a.length)return;snapshot();let items=ffItems();for(let i=items.length-1;i>=0;i--)if(a.includes(items[i]))items.splice(i,1);selected=null;ffClearMulti();render()}
function ffDuplicate(){ffCopy();ffPaste()}
document.addEventListener('click',e=>{let el=e.target.closest?.('.component');if(el&&(e.ctrlKey||e.shiftKey)){let x=ffItems().find(i=>i.id===el.dataset.id);if(x){e.preventDefault();e.stopPropagation();ffToggleMulti(x)}}},true);
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();ffCopy()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='x'){e.preventDefault();ffCut()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();ffPaste()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();ffDuplicate()}});
renderTools();project=fresh();render();$('#newDlg').showModal();


// v0.6.0 - Toolbox usa apenas a scrollbar nativa; sem controles artificiais.


// ===== v0.13.0 Timer component =====
(function(){
 const R=window.FlowForge?.components;
 if(R?.register)R.register('timer',{
   title:'Timer',category:'Não Visuais',nonVisual:true,
   defaults:{name:'Timer1',interval:1000,enabled:true,oneShot:false,text:'Timer'},
   event:'tick',
   events:['tick','start','stop'],
   render:()=>'<div class="ff-nonvisual-chip" title="Componente não visual">⏱ Timer</div>'
 });
})();
