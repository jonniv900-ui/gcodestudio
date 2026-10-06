  // ============================================================
  // PRÉ-PROCESSADOR: MACROS SIMPLES + M98/M99
  // ============================================================
  function evalMacroExpr(expr, vars){
    let s=String(expr||'').replace(/#(\d+)/g,(_,n)=>String(vars[n]??0))
      .replace(/\bEQ\b/gi,'==').replace(/\bNE\b/gi,'!=').replace(/\bGT\b/gi,'>')
      .replace(/\bLT\b/gi,'<').replace(/\bGE\b/gi,'>=').replace(/\bLE\b/gi,'<=')
      .replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||');
    if(!/^[0-9+\-*/().<>=!&| \t]+$/.test(s)) return 0;
    try{return Number(Function(`"use strict";return (${s})`)())||0;}catch{return 0;}
  }

  function preprocessProgram(raw){
    const source=String(raw||'').split(/\r?\n/);
    const subs={};
    const main=[];
    // Detecta Oxxxx que termina em M99 como subprograma.
    for(let i=0;i<source.length;i++){
      const om=source[i].match(/^\s*O(\d+)\b/i);
      if(om){
        let j=i+1, found=false;
        for(;j<source.length;j++){
          if(/\bM99\b/i.test(source[j])){found=true;break;}
          if(/^\s*O\d+\b/i.test(source[j]))break;
        }
        if(found){
          subs[Number(om[1])]=source.slice(i+1,j);
          i=j;continue;
        }
      }
      main.push(source[i]);
    }

    function expandSubs(lines,depth=0){
      if(depth>6)return lines;
      const out=[];
      lines.forEach(line=>{
        const m=line.match(/\bM98\s+P(\d+)(?:\s+L(\d+))?/i);
        if(m && subs[Number(m[1])]){
          const count=Math.max(1,Math.min(100,Number(m[2]||1)));
          for(let k=0;k<count;k++) out.push(...expandSubs(subs[Number(m[1])],depth+1));
        }else if(!/\bM99\b/i.test(line)) out.push(line);
      });
      return out;
    }

    const expanded=expandSubs(main);
    const vars={};
    const out=[];
    for(let i=0;i<expanded.length;i++){
      let line=expanded[i];
      const assign=line.match(/^\s*#(\d+)\s*=\s*(.+)$/);
      if(assign){vars[assign[1]]=evalMacroExpr(assign[2].replace(/[\[\]]/g,''),vars);continue;}

      const wh=line.match(/^\s*WHILE\s*\[(.+)\]\s*DO(\d+)/i);
      if(wh){
        const id=wh[2], block=[];let j=i+1,level=1;
        for(;j<expanded.length;j++){
          if(new RegExp(`^\\s*WHILE.*DO${id}\\b`,'i').test(expanded[j]))level++;
          if(new RegExp(`^\\s*END${id}\\b`,'i').test(expanded[j])){level--;if(level===0)break;}
          if(level>0)block.push(expanded[j]);
        }
        let guard=0;
        while(evalMacroExpr(wh[1],vars) && guard++<500){
          block.forEach(bl=>{
            const a=bl.match(/^\s*#(\d+)\s*=\s*(.+)$/);
            if(a)vars[a[1]]=evalMacroExpr(a[2].replace(/[\[\]]/g,''),vars);
            else out.push(bl.replace(/\[([^\]]+)\]/g,(_,e)=>String(evalMacroExpr(e,vars))).replace(/#(\d+)/g,(_,n)=>String(vars[n]??0)));
          });
        }
        i=j;continue;
      }

      line=line.replace(/\[([^\]]+)\]/g,(_,e)=>String(evalMacroExpr(e,vars)))
               .replace(/#(\d+)/g,(_,n)=>String(vars[n]??0));
      out.push(line);
    }
    return out.join('\n');
  }


  // ============================================================
  // DETECÇÃO AUTOMÁTICA: CNC / IMPRESSÃO 3D
  // ============================================================
  function detectJobType(code){
    const src=String(code||'');
    let printScore=0, cncScore=0;
    const printEvidence=[], cncEvidence=[];

    const add=(kind,score,label)=>{
      if(kind==='print'){printScore+=score;if(!printEvidence.includes(label))printEvidence.push(label);}
      else{cncScore+=score;if(!cncEvidence.includes(label))cncEvidence.push(label);}
    };

    // Sinais fortes de impressão FDM.
    if(/\bM10[49]\b|\bM140\b|\bM190\b/i.test(src)) add('print',6,'controle de temperatura');
    if(/\bM82\b|\bM83\b/i.test(src)) add('print',5,'modo de extrusão M82/M83');
    if(/\bG92\s+E[-+]?\d/i.test(src)) add('print',4,'reset do extrusor G92 E');
    if(/;\s*(LAYER|TYPE|TIME_ELAPSED|MESH|FLAVOR|FILAMENT)/i.test(src)) add('print',5,'metadados de slicer');

    const extrusionMoves=(src.match(/^\s*(?:N\d+\s+)?G0?1\b[^\r\n;]*\bE[-+]?\d*\.?\d+/gim)||[]).length;
    if(extrusionMoves>=3) add('print',Math.min(10,3+Math.floor(extrusionMoves/20)),'movimentos com eixo E');

    // Sinais fortes de usinagem CNC.
    if(/\bM0?[34]\b/i.test(src)) add('cnc',6,'spindle M3/M4');
    if(/\bM0?5\b/i.test(src)) add('cnc',3,'spindle M5');
    if(/\bM0?6\b/i.test(src)) add('cnc',6,'troca de ferramenta M6');
    if(/\bG8[123]\b/i.test(src)) add('cnc',6,'ciclo de furação');
    if(/\bG4[12]\b/i.test(src)) add('cnc',3,'compensação G41/G42');
    if(/(?:DIA(?:METRO)?|Ø|FRESA|MILL|ENDMILL|V-BIT|BALL\s*NOSE)/i.test(src)) add('cnc',4,'descrição de ferramenta CNC');

    // Em empate/arquivo ambíguo, CNC é o comportamento conservador da V1.
    const type=printScore>cncScore ? 'print3d' : 'cnc';
    const total=Math.max(1,printScore+cncScore);
    const confidence=Math.abs(printScore-cncScore)/total;

    return {
      type,confidence,
      printScore,cncScore,
      evidence:type==='print3d'?printEvidence:cncEvidence
    };
  }

  function applyDetectedJobType(code){
    const d=detectJobType(code);
    state.jobType=d.type;
    state.jobConfidence=d.confidence;
    state.jobEvidence=d.evidence;

    // O bloco representa matéria-prima removida; não faz sentido em FDM.
    // Não alteramos permanentemente a preferência do checkbox: apenas o renderer
    // ignora o stock quando o arquivo detectado é impressão 3D.
    return d;
  }

  /* ============================================================
     PARSER DE G-CODE
  ============================================================ */
  function parseGCode(text){
    text=preprocessProgram(text);
    const lines=text.split(/\r?\n/);
    const st={
      x:0,y:0,z:0,e:0,units:'mm',absolute:true,extruderAbsolute:true,plane:'XY',motion:null,feed:300,
      currentTool:1, spindle:false, spindleRPM:0, comp:'G40', coolant:'off', workOffset:'G54',
      cycle:null, cycleR:0, cycleZ:0, cycleQ:0, cycleP:0
    };
    const segments=[], tools=[], warnings=[];
    const bbox={minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity};
    let sawUnits=false, sawDistance=false;
    let printFeature='UNKNOWN',printLayer=-1;

    const extend=p=>{
      bbox.minX=Math.min(bbox.minX,p.x); bbox.maxX=Math.max(bbox.maxX,p.x);
      bbox.minY=Math.min(bbox.minY,p.y); bbox.maxY=Math.max(bbox.maxY,p.y);
      bbox.minZ=Math.min(bbox.minZ,p.z); bbox.maxZ=Math.max(bbox.maxZ,p.z);
    };
    const toolFor=n=>state.toolLibrary[n] || {
      number:n,name:`T${n}`,type:'endmill',diameter:config.toolDiameter,angle:60,flutes:2,stickout:25,holderDiameter:20,holderLength:45
    };
    const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);

    function pushLinear(type,start,end,line,feed,extra={}){
      if(distance(start,end)<1e-9) return;
      const tool=toolFor(st.currentTool);
      const rate=type==='rapid' ? config.rapidRate : Math.max(feed,0.001);
      const length=distance(start,end);
      const durationSec=(length/rate)*60;
      segments.push({
        type,start:{...start},end:{...end},line,feed,toolNumber:st.currentTool,
        toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,flutes:tool.flutes||2,stickout:tool.stickout||25,holderDiameter:tool.holderDiameter||20,holderLength:tool.holderLength||45,
        spindle:st.spindle,spindleRPM:st.spindleRPM,comp:st.comp,coolant:st.coolant,workOffset:st.workOffset,length,durationSec,...extra
      });
      extend(start); extend(end);
    }

    function pushArc(start,end,i,j,k,r,cw,plane,line,feed,extra={}){
      const arc=computeArc(start,end,i,j,k,r,cw,plane);
      if(arc.warning) warnings.push({line,severity:'warn',text:arc.warning});
      let length=0, prev=start;
      arc.points.forEach(p=>{length+=distance(prev,p);prev=p;});
      length+=distance(prev,end);
      const tool=toolFor(st.currentTool);
      const durationSec=(length/Math.max(feed,0.001))*60;
      segments.push({
        type:'arc',start:{...start},end:{...end},points:arc.points,line,feed,
        toolNumber:st.currentTool,toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,flutes:tool.flutes||2,stickout:tool.stickout||25,holderDiameter:tool.holderDiameter||20,holderLength:tool.holderLength||45,
        spindle:st.spindle,spindleRPM:st.spindleRPM,comp:st.comp,coolant:st.coolant,workOffset:st.workOffset,length,durationSec,
        clockwise:cw,plane,center:arc.center,radius:arc.radius,sweep:arc.sweep,...extra
      });
      extend(start); arc.points.forEach(extend); extend(end);
    }

    function runDrillCycle(lineNum,targetXY,cycle,feed){
      const tool=toolFor(st.currentTool);
      const start={x:st.x,y:st.y,z:st.z};
      const atXY={x:targetXY.x,y:targetXY.y,z:start.z};
      pushLinear('rapid',start,atXY,lineNum,feed,{cycle});
      const rPt={x:targetXY.x,y:targetXY.y,z:st.cycleR};
      pushLinear('rapid',atXY,rPt,lineNum,feed,{cycle});
      if(cycle==='G83'){
        const q=Math.max(0.001,Math.abs(st.cycleQ||Math.abs(st.cycleZ-st.cycleR)));
        let depth=st.cycleR;
        while(depth>st.cycleZ+1e-9){
          const nextDepth=Math.max(st.cycleZ,depth-q);

          // Aproximação visual de peck drilling:
          // cada novo mergulho parte do plano R e alcança uma profundidade maior.
          pushLinear(
            'cut',
            {x:targetXY.x,y:targetXY.y,z:st.cycleR},
            {x:targetXY.x,y:targetXY.y,z:nextDepth},
            lineNum,feed,{cycle}
          );

          depth=nextDepth;

          if(depth>st.cycleZ+1e-9){
            pushLinear(
              'rapid',
              {x:targetXY.x,y:targetXY.y,z:depth},
              {x:targetXY.x,y:targetXY.y,z:st.cycleR},
              lineNum,feed,{cycle}
            );
          }
        }
      }else{
        pushLinear('cut',rPt,{x:targetXY.x,y:targetXY.y,z:st.cycleZ},lineNum,feed,{cycle,dwell:cycle==='G82'?st.cycleP:0});
        if(cycle==='G82' && st.cycleP>0){
          // dwell virtual, no geometry
          segments.push({
            type:'dwell',start:{x:targetXY.x,y:targetXY.y,z:st.cycleZ},
            end:{x:targetXY.x,y:targetXY.y,z:st.cycleZ},line:lineNum,feed:0,
            toolNumber:st.currentTool,toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,
            durationSec:st.cycleP>10?st.cycleP/1000:st.cycleP,length:0,cycle
          });
        }
      }
      pushLinear('rapid',{x:targetXY.x,y:targetXY.y,z:st.cycleZ},
        {x:targetXY.x,y:targetXY.y,z:st.cycleR},lineNum,feed,{cycle});
      st.x=targetXY.x; st.y=targetXY.y; st.z=st.cycleR;
    }

    lines.forEach((raw,idx)=>{
      const lineNum=idx+1;
      const cm=raw.match(/(?:;TYPE:|;FEATURE:|;TYPE\s*=\s*)([^;]+)/i);if(cm)printFeature=cm[1].trim().toUpperCase();
      const lm=raw.match(/;LAYER:\s*(-?\d+)/i);if(lm)printLayer=parseInt(lm[1],10);
      let line=raw.replace(/\([^)]*\)/g,'');
      const semi=line.indexOf(';'); if(semi>=0) line=line.slice(0,semi);
      line=line.trim();

      const tMatch=raw.match(/\bT(\d+)\b/i);
      if(tMatch){
        st.currentTool=parseInt(tMatch[1],10);
        const tool=toolFor(st.currentTool);
        const diaMatch=raw.match(/(?:DIA(?:METRO)?|Ø|FRESA|TOOL|MILL|BIT)[^\d]*(\d+(?:[.,]\d+)?)\s*MM/i);
        if(diaMatch){
          tool.diameter=parseFloat(diaMatch[1].replace(',','.'))||tool.diameter;
          state.toolLibrary[st.currentTool]=tool;
        }
      }
      if(/\bM0?6\b/i.test(raw)){
        const tool=toolFor(st.currentTool);
        tools.push({line:lineNum,tool:String(st.currentTool),raw:raw.trim(),definition:tool});
      }

      if(!line) return;
      const words=[...line.matchAll(/([A-Za-z])\s*(-?\d*\.?\d+)/g)]
        .map(m=>({letter:m[1].toUpperCase(),val:parseFloat(m[2])}));
      if(!words.length) return;
      const get=L=>{const w=words.find(w=>w.letter===L);return w?w.val:undefined;};
      const gCodes=words.filter(w=>w.letter==='G').map(w=>w.val);
      const mCodes=words.filter(w=>w.letter==='M').map(w=>w.val);

      gCodes.forEach(g=>{
        if(g===20){st.units='in';sawUnits=true;}
        else if(g===21){st.units='mm';sawUnits=true;}
        else if(g===90){st.absolute=true;sawDistance=true;}
        else if(g===91){st.absolute=false;sawDistance=true;}
        else if(g===17) st.plane='XY';
        else if(g===18) st.plane='XZ';
        else if(g===19) st.plane='YZ';
        else if(g===40) st.comp='G40';
        else if(g===41) st.comp='G41';
        else if(g===42) st.comp='G42';
        else if(g>=54 && g<=59){st.workOffset=`G${g}`;state.activeWorkOffset=st.workOffset;}
        else if(g===80) st.cycle=null;
        else if([81,82,83].includes(g)) st.cycle=`G${g}`;
      });

      mCodes.forEach(m=>{
        if(m===3||m===4){st.spindle=true;const s=get('S');if(s!==undefined)st.spindleRPM=s;}
        else if(m===5) st.spindle=false;
        else if(m===7) st.coolant='mist';
        else if(m===8) st.coolant='flood';
        else if(m===9) st.coolant='off';
        else if(m===82) st.extruderAbsolute=true;
        else if(m===83) st.extruderAbsolute=false;
      });
      const s=get('S'); if(s!==undefined) st.spindleRPM=s;

      const unitScale=st.units==='in'?25.4:1;
      const f=get('F'); if(f!==undefined) st.feed=f*unitScale;

      // Impressoras 3D usam G92 E... para redefinir a posição lógica do extrusor.
      if(gCodes.includes(92)){
        const ev=get('E');
        if(ev!==undefined) st.e=ev;
        // G92 sem movimento não cria geometria.
        if(!['X','Y','Z'].some(L=>get(L)!==undefined)) return;
      }

      // Eventos de máquina sem geometria.
      const eventM=mCodes.find(m=>m===0||m===1||m===30);
      if(eventM!==undefined){
        const tool=toolFor(st.currentTool);
        segments.push({
          type:'event',event:eventM===0?'M0':eventM===1?'M1':'M30',
          start:{x:st.x,y:st.y,z:st.z},end:{x:st.x,y:st.y,z:st.z},
          line:lineNum,feed:0,durationSec:0,length:0,toolNumber:st.currentTool,
          toolDiameter:tool.diameter,toolType:tool.type,toolAngle:tool.angle,
          spindle:st.spindle,spindleRPM:st.spindleRPM,coolant:st.coolant,workOffset:st.workOffset
        });
      }

      // G28/G30: retorno à posição configurada de máquina.
      const homeCode=gCodes.find(g=>g===28||g===30);
      if(homeCode!==undefined){
        const home=homeCode===28?config.home28:config.home30;
        const start={x:st.x,y:st.y,z:st.z};
        const end={x:home.x,y:home.y,z:home.z};
        pushLinear('rapid',start,end,lineNum,st.feed,{machineHome:`G${homeCode}`});
        st.x=end.x;st.y=end.y;st.z=end.z;
        return;
      }

      if(st.cycle){
        const r=get('R'); if(r!==undefined) st.cycleR=r*unitScale;
        const z=get('Z'); if(z!==undefined) st.cycleZ=z*unitScale;
        const q=get('Q'); if(q!==undefined) st.cycleQ=q*unitScale;
        const p=get('P'); if(p!==undefined) st.cycleP=p;
        const tx=get('X'), ty=get('Y');
        if(tx!==undefined || ty!==undefined || gCodes.some(g=>[81,82,83].includes(g))){
          const targetXY={
            x:tx===undefined?st.x:(st.absolute?tx*unitScale+(config.workOffsets[st.workOffset]?.x||0):st.x+tx*unitScale),
            y:ty===undefined?st.y:(st.absolute?ty*unitScale+(config.workOffsets[st.workOffset]?.y||0):st.y+ty*unitScale)
          };
          runDrillCycle(lineNum,targetXY,st.cycle,st.feed);
        }
        return;
      }

      const motionG=gCodes.filter(g=>[0,1,2,3].includes(g));
      if(motionG.length) st.motion=motionG[motionG.length-1];

      const hasAxis=['X','Y','Z'].some(L=>get(L)!==undefined);
      const hasArc=['I','J','K','R'].some(L=>get(L)!==undefined);
      const onlyE=!hasAxis&&!hasArc&&get('E')!==undefined;
      if(onlyE){
        const ev=get('E');
        st.e=st.extruderAbsolute?ev:st.e+ev;
        return;
      }
      if(!hasAxis && !hasArc) return;
      if(st.motion===null) return;

      const start={x:st.x,y:st.y,z:st.z}, target={...start};
      ['x','y','z'].forEach(a=>{
        const rawVal=get(a.toUpperCase());
        if(rawVal!==undefined){
          const v=rawVal*unitScale;
          if(st.absolute){
            const off=config.workOffsets[st.workOffset]||{x:0,y:0,z:0};
            target[a]=v+(off[a]||0);
          }else target[a]=start[a]+v;
        }
      });

      const rawE=get('E');
      const targetE=rawE===undefined ? st.e : (st.extruderAbsolute ? rawE : st.e+rawE);
      const extrusionDelta=targetE-st.e;
      const extrusionInfo={
        extrusionDelta,
        extruding:extrusionDelta>1e-7,
        retracting:extrusionDelta<-1e-7,
        printFeature,printLayer
      };

      if(st.motion===0||st.motion===1){
        pushLinear(st.motion===0?'rapid':'cut',start,target,lineNum,st.feed,extrusionInfo);
      }else{
        const i=(get('I')??0)*unitScale, j=(get('J')??0)*unitScale, k=(get('K')??0)*unitScale;
        const rr=get('R'); const r=rr===undefined?undefined:rr*unitScale;
        pushArc(start,target,i,j,k,r,st.motion===2,st.plane,lineNum,st.feed,extrusionInfo);
      }
      st.x=target.x;st.y=target.y;st.z=target.z;st.e=targetE;
    });

    if(!sawUnits) warnings.push({line:1,severity:'warn',text:'Programa não declara G20/G21; assumido milímetro.'});
    if(!sawDistance) warnings.push({line:1,severity:'warn',text:'Programa não declara G90/G91; assumido absoluto.'});
    if(!isFinite(bbox.minX)) bbox.minX=bbox.maxX=bbox.minY=bbox.maxY=bbox.minZ=bbox.maxZ=0;
    if(bbox.minX<0||bbox.minY<0||bbox.minZ<-config.limZ||
       bbox.maxX>config.limX||bbox.maxY>config.limY||bbox.maxZ>config.limZ){
      warnings.push({line:1,severity:'error',
        text:`Percurso ultrapassa os Soft Limits (${config.limX}x${config.limY}x${config.limZ}mm).`});
    }
    return {segments,tools,warnings,bbox,units:st.units};
  }

  function computeArc(start, end, i, j, k, r, cw, plane){
    let a1='x', a2='y', a3='z', c1=i, c2=j;
    if(plane==='XZ'){ a2='z'; a3='y'; c2=k; }
    else if(plane==='YZ'){ a1='y'; a2='z'; a3='x'; c1=j; c2=k; }

    const s1=start[a1], s2=start[a2], s3=start[a3];
    const e1=end[a1], e2=end[a2], e3=end[a3];
    const dx=e1-s1, dy=e2-s2;
    const chord=Math.hypot(dx,dy);

    // Sem movimento planar: ainda pode ser uma hélice/linha; não fabricar arco.
    if(chord < 1e-10 && r === undefined && Math.hypot(c1,c2) < 1e-10){
      return { points:[{...end}], center:null, radius:0, sweep:0 };
    }

    let cx, cy, radius, startAng, delta, warning='';

    if(r !== undefined && Math.abs(r) > 1e-10){
      radius = Math.abs(r);
      if(chord > 2*radius + 1e-7){
        // G-code inválido para o raio informado: retorna linha para não quebrar o render.
        return {
          points:[{...end}], center:null, radius,
          sweep:0,
          warning:`Arco R inválido na linha: raio ${radius.toFixed(3)}mm menor que metade da corda.`
        };
      }

      if(chord < 1e-10){
        return {
          points:[{...end}], center:null, radius, sweep:0,
          warning:'Arco por R sem deslocamento final não é determinístico; use I/J/K para círculo completo.'
        };
      }

      const mx=(s1+e1)/2, my=(s2+e2)/2;
      const ux=-dy/chord, uy=dx/chord;
      const h=Math.sqrt(Math.max(0, radius*radius - (chord*chord)/4));
      const candidates=[
        {x:mx+ux*h, y:my+uy*h},
        {x:mx-ux*h, y:my-uy*h}
      ];

      const wantedMajor = r < 0;
      let best=null;
      candidates.forEach(c => {
        const sa=Math.atan2(s2-c.y,s1-c.x);
        const ea=Math.atan2(e2-c.y,e1-c.x);
        let d=ea-sa;
        if(cw){ while(d>=0) d-=Math.PI*2; }
        else { while(d<=0) d+=Math.PI*2; }
        const isMajor=Math.abs(d)>Math.PI+1e-9;
        if(best===null || isMajor===wantedMajor) {
          if(best===null || (isMajor===wantedMajor && Math.abs(d) < Math.abs(best.delta) && !wantedMajor) ||
             (isMajor===wantedMajor && wantedMajor && Math.abs(d) > Math.abs(best.delta))){
            best={x:c.x,y:c.y,delta:d};
          }
        }
      });
      if(!best) best={x:candidates[0].x,y:candidates[0].y,delta:0};
      cx=best.x; cy=best.y; delta=best.delta;
      startAng=Math.atan2(s2-cy,s1-cx);
    } else {
      cx=s1+c1; cy=s2+c2;
      radius=Math.hypot(s1-cx,s2-cy);
      if(radius < 1e-10){
        return { points:[{...end}], center:null, radius:0, sweep:0,
          warning:'Centro de arco inválido: I/J/K não definem um raio.' };
      }
      startAng=Math.atan2(s2-cy,s1-cx);
      let endAng=Math.atan2(e2-cy,e1-cx);
      delta=endAng-startAng;
      if(chord < 1e-10){
        delta = cw ? -Math.PI*2 : Math.PI*2;
      } else if(cw){
        while(delta>=-1e-10) delta-=Math.PI*2;
      } else {
        while(delta<=1e-10) delta+=Math.PI*2;
      }
    }

    // Tolerância geométrica fixa em mm. A quantidade de pontos cresce com o raio/ângulo.
    const tol=Math.max(0.005, Number(config.simArcTolerance)||0.05);
    const denom = radius > tol ? 2*Math.acos(Math.max(-1, Math.min(1, 1-tol/radius))) : Math.PI/18;
    let steps=Math.ceil(Math.abs(delta)/Math.max(denom, Math.PI/180));
    steps=Math.max(6, Math.min(Number(config.simArcMaxSteps)||4096, steps));

    const pts=[];
    for(let n=1;n<=steps;n++){
      const t=n/steps;
      const ang=startAng+delta*t;
      const pt={...start};
      pt[a1]=cx+radius*Math.cos(ang);
      pt[a2]=cy+radius*Math.sin(ang);
      pt[a3]=s3+(e3-s3)*t;
      pts.push(pt);
    }
    // O último ponto deve ser exatamente o endpoint do G-code para evitar drift acumulado.
    pts[pts.length-1]={...end};

    const center={x:start.x,y:start.y,z:start.z};
    center[a1]=cx; center[a2]=cy; center[a3]=s3;
    return { points:pts, center, radius, sweep:delta, warning };
  }

  /* ============================================================
     MODIFICADORES DE G-CODE
  ============================================================ */
  function transformGCode(fnTransform){
    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      if(line.trim().startsWith(';')) return line;
      return line.replace(/([XYZxyz])\s*(-?\d*\.?\d+)/g, (match, axis, val) => {
        const newVal = fnTransform(axis.toUpperCase(), parseFloat(val));
        return axis + newVal.toFixed(3);
      });
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView();
  }

  document.getElementById('btnApplyShift').addEventListener('click', () => {
    const dx = parseFloat(document.getElementById('shiftX').value)||0;
    const dy = parseFloat(document.getElementById('shiftY').value)||0;
    const dz = parseFloat(document.getElementById('shiftZ').value)||0;
    transformGCode((axis, val) => {
      if(axis==='X') return val + dx;
      if(axis==='Y') return val + dy;
      if(axis==='Z') return val + dz;
      return val;
    });
    closeDialogs();
  });

  document.getElementById('btnApplyScale').addEventListener('click', () => {
    const factor = parseFloat(document.getElementById('scaleFactor').value)||1;
    const mirror = document.getElementById('mirrorAxis').value;
    
    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      let l = line;
      if(mirror !== 'none'){
        if(l.includes('G2')) l = l.replace('G2','G3');
        else if(l.includes('G3')) l = l.replace('G3','G2');
      }
      return l.replace(/([XYZIJKxyzijk])\s*(-?\d*\.?\d+)/g, (match, axis, val) => {
        let v = parseFloat(val) * factor;
        const ax = axis.toUpperCase();
        if(mirror === 'X' && (ax==='X'||ax==='I')) v = -v;
        if(mirror === 'Y' && (ax==='Y'||ax==='J')) v = -v;
        return axis + v.toFixed(3);
      });
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView(); closeDialogs();
  });

  document.getElementById('btnApplyRotate').addEventListener('click', () => {
    const deg = parseFloat(document.getElementById('rotateAngle').value)||0;
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    const lines = codeEl.value.split('\n');
    const out = lines.map(line => {
      if(line.trim().startsWith(';')) return line;
      let x=null, y=null, i=null, j=null;
      line.replace(/([XYIJxyij])\s*(-?\d*\.?\d+)/g, (m, a, v) => {
        const val = parseFloat(v);
        const ax = a.toUpperCase();
        if(ax==='X') x=val; if(ax==='Y') y=val;
        if(ax==='I') i=val; if(ax==='J') j=val;
      });

      let res = line;
      if(x!==null && y!==null){
        const nx = x*cos - y*sin;
        const ny = x*sin + y*cos;
        res = res.replace(/X-?\d*\.?\d+/i, 'X'+nx.toFixed(3)).replace(/Y-?\d*\.?\d+/i, 'Y'+ny.toFixed(3));
      }
      if(i!==null && j!==null){
        const ni = i*cos - j*sin;
        const nj = i*sin + j*cos;
        res = res.replace(/I-?\d*\.?\d+/i, 'I'+ni.toFixed(3)).replace(/J-?\d*\.?\d+/i, 'J'+nj.toFixed(3));
      }
      return res;
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse(); fitView(); closeDialogs();
  });

  document.getElementById('btnRenumber').addEventListener('click', () => {
    const lines = codeEl.value.split('\n');
    let num = 10;
    const out = lines.map(l => {
      let clean = l.replace(/^N\d+\s*/i, '').trim();
      if(!clean || clean.startsWith(';')) return clean;
      const res = `N${num} ${clean}`;
      num += 10;
      return res;
    });
    codeEl.value = out.join('\n');
    renderHighlight(); runParse();
  });

  /* ============================================================
     OPERAÇÕES DE ARQUIVO
  ============================================================ */
  document.getElementById('btnNew').addEventListener('click', async () => {
    const confirmed = await htmlConfirm(
      'Deseja criar um novo arquivo? O código atual será limpo.',
      'Novo programa'
    );
    if(confirmed){
      codeEl.value = "G21 G90 G17 G40 G49\nG0 Z10.0\nM30\n";
      state.currentFileName = 'novo_programa.tap';
      document.getElementById('filename').textContent = state.currentFileName;
      renderHighlight(); runParse(); fitView();
    }
  });

  const openWrap = document.getElementById('openWrap');
  const openMenu = document.getElementById('openMenu');
  const fileInput = document.getElementById('fileInput');
  const fileInputSequence = document.getElementById('fileInputSequence');

  document.getElementById('btnOpen').addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if(!openWrap.contains(e.target)) openMenu.classList.remove('open');
  });

  document.getElementById('btnOpenSingle').addEventListener('click', () => {
    openMenu.classList.remove('open');
    state.fileQueue = [];
    state.fileQueueIndex = -1;
    state.sequencePlaying = false;
    state.multiFileMode = null;
    fileInput.value = '';
    fileInput.click();
  });

  document.getElementById('btnOpenSequence').addEventListener('click', () => {
    openMenu.classList.remove('open');
    state.fileQueue = [];
    state.fileQueueIndex = -1;
    state.sequencePlaying = false;
    state.multiFileMode = null;
    fileInputSequence.value = '';
    fileInputSequence.click();
  });

  function readFileText(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(String(e.target.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
      reader.readAsText(file);
    });
  }

  async function loadProgramFile(file, options={}){
    try{
      const text = await readFileText(file);
      state.currentFileName = file.name;
      document.getElementById('filename').textContent = file.name;
      codeEl.value = text;
      rememberRecent(file.name,text);
      renderHighlight();
      runParse();
      fitView();

      if(options.startPlayback){
        // Começa sempre do início do novo programa.
        state.playIndex = 0;
        updatePlaybackUI();
        drawCanvas();
        startPlay();
      }
      return true;
    }catch(err){
      console.error(err);
      await htmlAlert(
        `Não foi possível abrir "${file.name}".`,
        'Erro ao abrir arquivo'
      );
      return false;
    }
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    stopPlay();
    await loadProgramFile(file);
    fileInput.value = '';
  });

  fileInputSequence.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if(!files.length) return;

    stopPlay();

    /*
     * Ao abrir vários arquivos existem dois comportamentos:
     *
     * 1) SEQUENCIAL:
     *    cada arquivo é carregado e executado separadamente.
     *    Ao terminar um, o próximo começa.
     *    O stock é reiniciado a cada novo programa.
     *
     * 2) COMO UM SÓ:
     *    todos os arquivos são concatenados em memória e analisados
     *    como um único programa. O playback, o stock e a usinagem
     *    permanecem contínuos entre os arquivos.
     */
    const multiMode = await showMessageDialog({
      title:'Abrir vários arquivos',
      message:
        'Como deseja reproduzir os arquivos selecionados?\n\n' +
        'Como um só: todos os arquivos formam uma única simulação contínua e usam o mesmo bloco de material.\n\n' +
        'Sequencial: cada arquivo é executado separadamente, um após o outro.',
      icon:'▶',
      buttons:[
        {label:'Como um só', value:'combined', primary:true},
        {label:'Sequencial', value:'sequential'},
        {label:'Cancelar', value:'cancel'}
      ]
    });

    if(multiMode === 'cancel'){
      fileInputSequence.value = '';
      return;
    }

    if(multiMode === 'combined'){
      state.multiFileMode = 'combined';
      state.sequencePlaying = false;
      state.fileQueue = [];
      state.fileQueueIndex = -1;

      try{
        const parts = [];
        for(let i=0; i<files.length; i++){
          const file = files[i];
          const fileText = await readFileText(file);

          // Marcadores são comentários válidos e ajudam a identificar
          // visualmente onde cada programa começa e termina no editor.
          parts.push(
            `; ===== ARQUIVO ${i+1}/${files.length}: ${file.name} =====
${fileText}
; ===== FIM: ${file.name} =====`
          );
        }

        codeEl.value = parts.join('\n\n');
        state.currentFileName =
          files.length === 1
            ? files[0].name
            : `${files.length}_arquivos_combinados.tap`;

        document.getElementById('filename').textContent =
          files.length === 1
            ? files[0].name
            : `${files.length} arquivos • combinado`;

        renderHighlight();
        runParse();
        fitView();

        state.playIndex = 0;
        resetStockSimulation();
        updatePlaybackUI();
        drawCanvas();
        startPlay();

      }catch(err){
        console.error(err);
        await htmlAlert(
          'Não foi possível ler todos os arquivos selecionados.',
          'Erro ao abrir arquivos'
        );
        state.multiFileMode = null;
      }

    }else if(multiMode === 'sequential'){
      state.multiFileMode = 'sequential';
      state.fileQueue = files;
      state.fileQueueIndex = 0;
      state.sequencePlaying = true;

      // O FileList já vem na ordem escolhida pelo navegador/sistema.
      const ok = await loadProgramFile(state.fileQueue[0], {startPlayback:true});
      if(!ok){
        state.sequencePlaying = false;
        state.fileQueue = [];
        state.fileQueueIndex = -1;
        state.multiFileMode = null;
      }
    }

    fileInputSequence.value = '';
  });

  const saveNameDialog = document.getElementById('saveNameDialog');
  const saveFileNameInput = document.getElementById('saveFileNameInput');

  function normalizeSaveName(name){
    let n=(name||'').trim();
    if(!n)n='programa.tap';

    // Mantém extensões CNC conhecidas. Caso contrário, acrescenta .tap.
    if(!/\.(tap|nc|cnc|gcode|txt)$/i.test(n)) n += '.tap';
    return n;
  }

  document.getElementById('btnSave').addEventListener('click', () => {
    saveFileNameInput.value = state.currentFileName || 'programa.tap';
    saveNameDialog.showModal();
    requestAnimationFrame(() => {
      saveFileNameInput.focus();
      const dot=saveFileNameInput.value.lastIndexOf('.');
      saveFileNameInput.setSelectionRange(0, dot>0?dot:saveFileNameInput.value.length);
    });
  });

  document.getElementById('btnConfirmSaveName').addEventListener('click', () => {
    const fileName = normalizeSaveName(saveFileNameInput.value);

    state.currentFileName = fileName;
    document.getElementById('filename').textContent = fileName;

    const blob = new Blob([codeEl.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    rememberRecent(fileName, codeEl.value);
    saveNameDialog.close();
  });

  document.getElementById('btnCancelSaveName').addEventListener('click', () => {
    saveNameDialog.close();
  });

  saveFileNameInput.addEventListener('keydown', e => {
    if(e.key === 'Enter'){
      e.preventDefault();
      document.getElementById('btnConfirmSaveName').click();
    }
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = state.currentFileName.replace(/\.[^/.]+$/, "") + "_preview.png";
    a.click();
  });

  /* ============================================================
     SYNTAX HIGHLIGHTING & EDITOR EVENTS
  ============================================================ */
  function highlightLine(line){
    let out = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    out = out.replace(/(;[^\n]*|\([^)]*\))/g, '<span class="tok-comment">$1</span>');
    out = out.replace(/\b([Gg])(\d+\.?\d*)/g, '<span class="tok-g">$1$2</span>');
    out = out.replace(/\b([Mm])(\d+)/g, '<span class="tok-m">$1$2</span>');
    out = out.replace(/\b([XYZxyz])(-?\d*\.?\d+)/g, '<span class="tok-axis">$1$2</span>');
    out = out.replace(/\b([IJKijk])(-?\d*\.?\d+)/g, '<span class="tok-ijk">$1$2</span>');
    out = out.replace(/\b([Ff])(-?\d*\.?\d+)/g, '<span class="tok-f">$1$2</span>');
    out = out.replace(/\b([SsTt])(\d+)/g, '<span class="tok-s">$1$2</span>');
    return out.length ? out : '&nbsp;';
  }

  function renderHighlight(){
    const lines = codeEl.value.split('\n');
    highlightEl.innerHTML = lines.map(highlightLine).join('\n');
    let buf = ''; for(let n=1; n<=lines.length; n++) buf += n + '\n';
    gutterEl.textContent = buf;
    els.statLines.textContent = lines.length;
    codeEl.style.height = (lines.length * 20 + 40) + 'px';
  }

  function updateCursorHighlight(){
    const pos = codeEl.selectionStart;
    const curLine = codeEl.value.slice(0, pos).split('\n').length;
    els.statCurLine.textContent = curLine;
    state.selectedLine = curLine;

    lineHighlightEl.style.display = 'block';
    lineHighlightEl.style.top = (10 + (curLine-1)*20) + 'px';
    drawCanvas();
  }

  codeEl.addEventListener('click', updateCursorHighlight);
  codeEl.addEventListener('keyup', (e) => {
    updateCursorHighlight();
    if(['ArrowUp','ArrowDown','Enter','Escape'].includes(e.key)) return;

    const pos = codeEl.selectionStart;
    const textBefore = codeEl.value.slice(0, pos);
    const lastWord = textBefore.split(/[\s\n]+/).pop().toUpperCase();

    if(lastWord.length >= 1 && (lastWord.startsWith('G') || lastWord.startsWith('M'))){
      const matches = GCODE_DICT.filter(d => d.code.startsWith(lastWord));
      if(matches.length){
        acBox.innerHTML = matches.map((m,i) => `<div class="ac-item ${i===0?'selected':''}" data-code="${m.code}"><b>${m.code}</b> <span>${m.desc}</span></div>`).join('');
        acBox.style.display = 'block';
        acBox.style.top = (10 + (textBefore.split('\n').length)*20) + 'px';
        acBox.style.left = '60px';
        return;
      }
    }
    acBox.style.display = 'none';
  });

  acBox.addEventListener('click', (e) => {
    const item = e.target.closest('.ac-item');
    if(!item) return;
    insertCode(item.dataset.code);
  });

  function insertCode(codeStr){
    const pos = codeEl.selectionStart;
    const textBefore = codeEl.value.slice(0, pos);
    const lastWord = textBefore.split(/[\s\n]+/).pop();
    const startPos = pos - lastWord.length;
    codeEl.value = codeEl.value.slice(0, startPos) + codeStr + ' ' + codeEl.value.slice(pos);
    acBox.style.display = 'none';
    renderHighlight(); runParse(); codeEl.focus();
  }


