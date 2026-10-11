// FlowForge WebStudio v0.10.0 - Game Components
(function(){
 const FF=window.FlowForge, R=FF?.components;
 const defs={
  gamecanvas:{title:'Game Canvas',category:'GAMES',defaults:{name:'GameCanvas1',width:320,height:240,bg:'#111827',fps:60},event:'gameStart',events:['gameStart','gameUpdate','gameOver'],render:ctx=>{const x=ctx.item||{};return `<canvas class="ff-gamecanvas" width="${Number(x.canvasWidth)||320}" height="${Number(x.canvasHeight)||240}" style="display:block;width:100%;height:100%;background:${x.bg||'#111827'}"></canvas>`}},
  sprite:{title:'Sprite',category:'GAMES',defaults:{name:'Sprite1',width:48,height:48,text:'◆',x:20,y:20,vx:0,vy:0,rotation:0,visible:true},event:'click',events:['click','collision','move'],render:ctx=>{const x=ctx.item||{};return `<div class="ff-sprite" style="width:100%;height:100%;display:grid;place-items:center;font-size:${Math.max(12,Math.min(64,Number(x.width)||48))*.65}px;transform:rotate(${Number(x.rotation)||0}deg)">${String(x.text||'◆')}</div>`}},
  spritesheet:{title:'Sprite Sheet',category:'GAMES',defaults:{name:'SpriteSheet1',width:64,height:64,frameWidth:32,frameHeight:32,frame:0,fps:8,loop:true},event:'animationEnd',events:['animationStart','animationEnd','frame'],render:ctx=>{const x=ctx.item||{};return `<canvas class="ff-spritesheet" width="${Number(x.frameWidth)||32}" height="${Number(x.frameHeight)||32}" style="display:block;width:100%;height:100%;background:transparent"></canvas>`}},
  collisionarea:{title:'Collision Area',category:'GAMES',defaults:{name:'CollisionArea1',width:100,height:60,visibleInGame:false,tag:'obstacle'},event:'collision',events:['collision','enter','leave'],render:()=>'<div class="ff-collision">COLLISION</div>'},
  keyboardinput:{title:'Keyboard Input',category:'GAMES',nonVisual:true,defaults:{name:'Keyboard1',enabled:true,preventDefault:false},event:'keydown',events:['keydown','keyup'],render:()=>'<div class="ff-game-nonvisual">⌨ Keyboard</div>'},
  gamepadinput:{title:'Gamepad Input',category:'GAMES',nonVisual:true,defaults:{name:'Gamepad1',enabled:true,index:0},event:'buttondown',events:['connected','disconnected','buttondown','buttonup','axis'],render:()=>'<div class="ff-game-nonvisual">🎮 Gamepad</div>'},
  gametimer:{title:'Game Timer',category:'GAMES',nonVisual:true,defaults:{name:'GameTimer1',interval:16,enabled:true},event:'tick',events:['tick'],render:()=>'<div class="ff-game-nonvisual">◷ GameTimer</div>'},
  scorelabel:{title:'Score Label',category:'GAMES',defaults:{name:'Score1',width:130,height:36,text:'Score: 0',value:0,prefix:'Score: '},event:'change',events:['change'],render:()=>'<div class="ff-score">★ Score: 0</div>'},
  healthbar:{title:'Health Bar',category:'GAMES',defaults:{name:'Health1',width:180,height:24,value:100,max:100},event:'change',events:['change','empty'],render:()=>'<div class="ff-health"><i></i><span>100%</span></div>'},
  joystick:{title:'Virtual Joystick',category:'GAMES',defaults:{name:'Joystick1',width:120,height:120,deadZone:.15},event:'move',events:['move','start','end'],render:()=>'<div class="ff-joystick"><i></i></div>'}
 };
 if(R?.register)Object.entries(defs).forEach(([k,v])=>R.register(k,v));
 FF.game=FF.game||{};
 FF.game.rectsCollide=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 FF.game.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 FF.game.distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
 FF.game.keys=new Set();
 addEventListener('keydown',e=>FF.game.keys.add(e.key));
 addEventListener('keyup',e=>FF.game.keys.delete(e.key));
 FF.game.key=k=>FF.game.keys.has(k);
 FF.game.loop=function(update,fps=60){let active=true,last=performance.now(),step=1000/fps;function frame(now){if(!active)return;if(now-last>=step){update((now-last)/1000);last=now}requestAnimationFrame(frame)}requestAnimationFrame(frame);return()=>active=false};
 FF.game.gamepads=()=>navigator.getGamepads?navigator.getGamepads():[];
})();
