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
    stockKey:'',stockChunks:[],stockChunkKey:'',stockChunkSize:32
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
      webgl3d.stockKey = '';webgl3d.stockChunkKey='';webgl3d.stockChunks=[];
      webgl3d.lineKey = '';
      webgl3d.depositKey = '';webgl3d.depositFrameKey='';webgl3d.depositLiveKey='';webgl3d.stockBuildKey='';
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

  function deleteStockChunks(){
    const gl=webgl3d.gl;
    if(!gl)return;
    for(const ch of webgl3d.stockChunks||[]){
      try{gl.deleteVertexArray(ch.vao);gl.deleteBuffer(ch.pos);gl.deleteBuffer(ch.nor);gl.deleteBuffer(ch.col);gl.deleteBuffer(ch.ibo);}catch(e){}
    }
    webgl3d.stockChunks=[];
  }

  function createStockChunk(){
    const gl=webgl3d.gl;
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    const nor=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nor);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
    const col=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,col);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,0,0);
    const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
    gl.bindVertexArray(null);
    return {vao,pos,nor,col,ibo,indexCount:0,cx:0,cy:0};
  }

  function stockChunkKey(sim,mode){
    return [sim.nx,sim.ny,state.stockQuality,state.depthMap,state.sectionAxis,state.sectionValue,
      config.stkX,config.stkY,config.stkZ,mode].join(':');
  }

  function stockVertexNormal(sim,ix,iy){
    const vx=sim.nx+1,vy=sim.ny+1;
    const h=(x,y)=>{
      x=Math.max(0,Math.min(sim.nx-1,x));y=Math.max(0,Math.min(sim.ny-1,y));
      return sim.top[y*sim.nx+x];
    };
    const hl=h(ix-1,iy),hr=h(ix,iy),hd=h(ix,iy-1),hu=h(ix,iy);
    let nx=-(hr-hl)/Math.max(sim.dx,1e-6),ny=-(hu-hd)/Math.max(sim.dy,1e-6),nz=1;
    const l=Math.hypot(nx,ny,nz)||1;return [nx/l,ny/l,nz/l];
  }

  function buildStockChunk(sim,ch,cx,cy){
    const gl=webgl3d.gl,cs=sim.chunkSize||32;
    const x0=cx*cs,y0=cy*cs,x1=Math.min(sim.nx,x0+cs),y1=Math.min(sim.ny,y0+cs),b=stockBounds();
    const pos=[],nor=[],col=[],idx=[];
    let vi=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const z00=sim.top[y*sim.nx+x],z10=sim.top[y*sim.nx+x+1]??z00,z01=sim.top[(y+1)*sim.nx+x]??z00,z11=sim.top[(y+1)*sim.nx+x+1]??z00;
      const z=(z00+z10+z01+z11)/4;
      if(!stockCellVisible((x+.5)*sim.dx,(y+.5)*sim.dy,z))continue;
      const verts=[[x*sim.dx,y*sim.dy,z00],[(x+1)*sim.dx,y*sim.dy,z10],[(x+1)*sim.dx,(y+1)*sim.dy,z11],[x*sim.dx,(y+1)*sim.dy,z01]];
      const ns=[stockVertexNormal(sim,x,y),stockVertexNormal(sim,x+1,y),stockVertexNormal(sim,x+1,y+1),stockVertexNormal(sim,x,y+1)];
      for(let q=0;q<4;q++){pos.push(...verts[q]);nor.push(...ns[q]);col.push(...webglColorDepth((b.zTop-verts[q][2])/Math.max(.001,config.stkZ)));}
      idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4;
    }
    gl.bindVertexArray(ch.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,ch.pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,ch.nor);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,ch.col);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ch.ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);ch.indexCount=idx.length;ch.cx=cx;ch.cy=cy;
  }

  function buildStockChunksWebGL(sim,force=false){
    const key=stockChunkKey(sim,document.getElementById('stockViewMode')?.value||'machined');
    const gl=webgl3d.gl,cs=sim.chunkSize||32;
    if(force||webgl3d.stockChunkKey!==key||!webgl3d.stockChunks.length){
      deleteStockChunks();webgl3d.stockChunkKey=key;
      const nx=Math.ceil(sim.nx/cs),ny=Math.ceil(sim.ny/cs);
      for(let cy=0;cy<ny;cy++)for(let cx=0;cx<nx;cx++){const ch=createStockChunk();buildStockChunk(sim,ch,cx,cy);webgl3d.stockChunks.push(ch);}
      sim.dirtyChunks?.clear();return;
    }
    if(!sim.dirtyChunks?.size)return;
    for(const packed of sim.dirtyChunks){const cx=packed>>16,cy=packed&0xffff;const ch=webgl3d.stockChunks.find(v=>v.cx===cx&&v.cy===cy);if(ch)buildStockChunk(sim,ch,cx,cy);}
    sim.dirtyChunks.clear();
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
    // A malha do estoque é dividida em chunks. Durante a usinagem, somente os
    // chunks atingidos pelo corte são reconstruídos; o restante permanece na GPU.
    if(mode!=='original'){
      buildStockChunksWebGL(sim,force);
      // As paredes são pequenas comparadas à superfície; mantemos a atualização simples.
      const edgeChanged=sim.lastIndex>=0;
      if(!force && !edgeChanged && webgl3d.wallVertexCount) return;
      const wp=[],wn=[],wc=[];
      function quad(a,b1,c,d,n){[[a,b1,c],[a,c,d]].forEach(t=>t.forEach(v=>{wp.push(...v);wn.push(...n);wc.push(.18,.48,.55,.65);}));}
      const nx=sim.nx,ny=sim.ny,dx=sim.dx,dy=sim.dy;
      const h=(x,y)=>sim.top[Math.max(0,Math.min(ny-1,y))*nx+Math.max(0,Math.min(nx-1,x))];
      for(let x=0;x<nx;x++){let z0=h(x,0),z1=h(x+1,0);quad([x*dx,0,b.zBottom],[(x+1)*dx,0,b.zBottom],[(x+1)*dx,0,z1],[x*dx,0,z0],[0,-1,0]);z0=h(x,ny);z1=h(x+1,ny);quad([x*dx,ny*dy,b.zBottom],[x*dx,ny*dy,z0],[(x+1)*dx,ny*dy,z1],[(x+1)*dx,ny*dy,b.zBottom],[0,1,0]);}
      for(let y=0;y<ny;y++){let z0=h(0,y),z1=h(0,y+1);quad([0,y*dy,b.zBottom],[0,y*dy,z0],[0,(y+1)*dy,z1],[0,(y+1)*dy,b.zBottom],[-1,0,0]);z0=h(nx,y);z1=h(nx,y+1);quad([nx*dx,y*dy,b.zBottom],[nx*dx,(y+1)*dy,b.zBottom],[nx*dx,(y+1)*dy,z1],[nx*dx,y*dy,z0],[1,0,0]);}
      uploadWebGLWalls(wp,wn,wc);return;
    }

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
    const liveKey=[state.geometryVersion||0,i,Math.round(progress*250)].join('|');
    if(webgl3d.depositLiveKey!==liveKey){webgl3d.depositLiveKey=liveKey;uploadLiveDepositPrefix(i,progress);}
    const liveCount=webgl3d.depositLiveIndexCount;
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
      const stockFrameKey=[state.geometryVersion||0,state.playIndex,state.selectedLine,state.stockQuality,state.depthMap,state.sectionAxis,state.sectionValue,config.stkX,config.stkY,config.stkZ,document.getElementById('stockViewMode')?.value||'machined',state.xray].join('|');
      if(webgl3d.stockBuildKey!==stockFrameKey){webgl3d.stockBuildKey=stockFrameKey;buildStockWebGL(false);}const pr=webgl3d.program;gl.useProgram(pr);glUniforms(webgl3d.programUniforms,r);
      const xr=webgl3d.programUniforms.uXray;if(xr!=null)gl.uniform1f(xr,state.xray?1:0);
      if(state.xray)gl.depthMask(false);
      if(webgl3d.stockChunks?.length){for(const ch of webgl3d.stockChunks){if(ch.indexCount){gl.bindVertexArray(ch.vao);gl.drawElements(gl.TRIANGLES,ch.indexCount,gl.UNSIGNED_INT,0);}}}else if(webgl3d.meshIndexCount){gl.bindVertexArray(webgl3d.meshVAO);gl.drawElements(gl.TRIANGLES,webgl3d.meshIndexCount,gl.UNSIGNED_INT,0);}
      if(webgl3d.wallVertexCount){gl.bindVertexArray(webgl3d.wallVAO);gl.drawArrays(gl.TRIANGLES,0,webgl3d.wallVertexCount);}
      gl.depthMask(true);
    }
    if(state.jobType==='print3d'){
      const depositFrameKey=[state.geometryVersion||0,state.segments.length,state.jobType].join('|');
      if(webgl3d.depositFrameKey!==depositFrameKey){
        webgl3d.depositFrameKey=depositFrameKey;
        buildDepositWebGL();
        webgl3d.depositLiveKey='';
      }
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
    state.stockSim={nx,ny,dx:actualResX,dy:actualResY,top,bottom:b.zBottom,topOriginal:b.zTop,lastIndex:-1,resolution:res,chunkSize:32,dirtyChunks:new Set()};
    state.stockCache=null;
    state.stockRenderCache=null;
    state.stockSim.dirtyChunks=new Set();
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
        if(cutterZ<sim.top[k]){
          sim.top[k]=Math.max(sim.bottom,cutterZ);
          const cs=sim.chunkSize||32;
          sim.dirtyChunks?.add((Math.floor(ix/cs)<<16) ^ Math.floor(iy/cs));
        }
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

  // A simulação é deliberadamente incremental: o playback nunca deve bloquear
  // a thread principal reconstruindo centenas/milhares de segmentos de uma vez.
  // O restante é processado em frames ociosos e o último estado continua preciso.
  function processStockBudget(target, quality, budgetMs){
    const startTime=performance.now();
    const sim=state.stockSim;
    if(!sim) return false;
    while(sim.lastIndex < target){
      const next=sim.lastIndex+1;
      simulateStockSegment(state.segments[next],sim);
      sim.lastIndex=next;
      // Mantemos uma margem para layout/input/paint do navegador.
      if(performance.now()-startTime >= budgetMs) return false;
    }
    return true;
  }

  function scheduleStockContinuation(target, quality){
    if(state.stockRefineTimer) return;
    state.stockRefineTimer=requestAnimationFrame(()=>{
      state.stockRefineTimer=null;
      if(!state.stockSim || state.stockQuality!==quality) return;
      const wanted=Math.min(target,state.segments.length-1);
      const done=processStockBudget(wanted,quality,state.playing?3.0:7.0);
      state.stockRenderCache=null;
      if(typeof webgl3d!=='undefined') webgl3d.stockKey='';
      if(!done) scheduleStockContinuation(wanted,quality);
      // Só força outro frame quando ainda há simulação pendente.
      if(done && !state.playing) drawCanvas();
    });
  }

  function syncStockSimulation(){
    const target=(state.playing || state.playIndex>0) ? Math.min(state.playIndex,state.segments.length-1) : -1;
    if(target<0) return;

    const wantedQuality=state.playing ? 'preview' : 'normal';
    if(!state.stockSim || state.stockQuality!==wantedQuality){
      state.stockQuality=wantedQuality;
      resetStockSimulation();
    }

    const sim=state.stockSim;
    if(target < sim.lastIndex){
      // Seek para trás: reconstrói incrementalmente em vez de travar a UI.
      resetStockSimulation();
    }

    if(sim.lastIndex < target){
      const done=processStockBudget(target,wantedQuality,state.playing?3.0:7.0);
      state.stockRenderCache=null;
      if(typeof webgl3d!=='undefined') webgl3d.stockKey='';
      if(!done) scheduleStockContinuation(target,wantedQuality);
    }
  }

  function refineStockAfterPlayback(){
    if(state.stockRefineTimer) cancelAnimationFrame(state.stockRefineTimer);
    state.stockRefineTimer=null;
    const target=state.playIndex>0 ? Math.min(state.playIndex,state.segments.length-1) : -1;
    if(target<0){
      state.stockQuality='normal';
      resetStockSimulation();
      drawCanvas();
      return;
    }
    state.stockQuality='normal';
    // Recomeça em resolução normal, mas processa em pequenos blocos.
    resetStockSimulation();
    scheduleStockContinuation(target,'normal');
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

    // Janela de execução: 0 mostra o programa inteiro; valores maiores
    // mostram somente os últimos N movimentos executados.
    const windowSize=Math.max(0,Number(state.executionWindow)||0);
    const windowStart=windowSize>0 ? Math.max(0,state.playIndex-windowSize+1) : 0;
    const windowEnd=windowSize>0 ? Math.min(state.segments.length-1,state.playIndex) : state.segments.length-1;

    for(let idx=windowStart;idx<=windowEnd;idx++){
      const g=geom[idx];
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
    }

    state.limitViolations=violationCount;

    followCurrentTool();

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

  // ============================================================
  // ZOOM DA FERRAMENTA DURANTE A EXECUÇÃO
  // Mantém o playback independente da câmera e permite aproximar
  // rapidamente a região em que a ferramenta está trabalhando.
  // ============================================================
  function currentToolPoint(){
    if(!state.segments.length) return null;
    const idx=Math.max(0,Math.min(state.playIndex,state.segments.length-1));
    return currentPlaybackPosition() || state.segments[idx]?.end || state.segments[idx]?.start || null;
  }

  function zoomAroundModelPoint(pt,factor,keepCenter=false){
    if(!pt || !isFinite(factor) || factor<=0) return;
    const rect=canvas.getBoundingClientRect();
    const centerX=rect.width/2, centerY=rect.height/2;
    const before=toScreen(pt);
    const f=Math.max(0.2,Math.min(8,factor));
    state.scale=Math.max(0.0005,Math.min(5000,state.scale*f));
    if(keepCenter){
      const after=toScreen(pt);
      state.offsetX+=centerX-after[0];
      state.offsetY+=centerY-after[1];
    }else{
      state.offsetX=centerX-(before[0]-state.offsetX)*f;
      state.offsetY=centerY-(before[1]-state.offsetY)*f;
    }
    drawCanvas();
  }

  function focusCurrentTool(){
    const pt=currentToolPoint();
    if(!pt) return false;
    const rect=canvas.getBoundingClientRect();
    const centerX=rect.width/2,centerY=rect.height/2;
    const oldScale=Math.max(0.0005,Number(state.scale)||1);
    const f=Math.max(1,Number(state.toolZoomFactor)||1.8);
    const before=toScreen(pt);
    const modelX=before[0]-state.offsetX;
    const modelY=before[1]-state.offsetY;
    const targetScale=Math.max(0.0005,Math.min(5000,oldScale*f));
    state.scale=targetScale;
    state.offsetX=centerX-modelX*(targetScale/oldScale);
    state.offsetY=centerY-modelY*(targetScale/oldScale);
    state._suppressFollowOnce=true;
    drawCanvas();
    return true;
  }

  function setFollowTool(enabled){
    state.followTool=!!enabled;
    const btn=document.getElementById('btnFollowTool');
    if(btn){
      btn.textContent=state.followTool?'Seguir: Sim':'Seguir: Não';
      btn.classList.toggle('active',state.followTool);
      btn.setAttribute('aria-pressed',String(state.followTool));
    }
    if(state.followTool) focusCurrentTool();
  }

  function followCurrentTool(){
    if(state._suppressFollowOnce){state._suppressFollowOnce=false;return;}
    if(!state.followTool || !state.playing) return;
    const pt=currentToolPoint();
    if(!pt) return;
    const rect=canvas.getBoundingClientRect();
    const projected=toScreen(pt);
    const dx=rect.width/2-projected[0],dy=rect.height/2-projected[1];
    const deadX=rect.width*0.16,deadY=rect.height*0.16;
    if(Math.abs(dx)>deadX || Math.abs(dy)>deadY){
      state.offsetX+=dx;
      state.offsetY+=dy;
      // drawCanvas() já está executando; não fazer chamada recursiva.
    }
  }

  document.getElementById('btnToolZoom')?.addEventListener('click',()=>focusCurrentTool());
  document.getElementById('btnFollowTool')?.addEventListener('click',()=>setFollowTool(!state.followTool));
  document.getElementById('executionWindow')?.addEventListener('change',e=>{
    state.executionWindow=Math.max(0,Number(e.target.value)||0);
    drawCanvas();
  });

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
  window.gcsFocusCurrentTool=focusCurrentTool;
  window.gcsSetFollowTool=setFollowTool;

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


