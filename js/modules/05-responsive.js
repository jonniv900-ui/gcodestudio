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

