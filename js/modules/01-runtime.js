(function(){
  "use strict";

  const SAMPLE_GCODE = `; Programa Exemplo - G-code Studio
G21 G90 G17 G40 G49
G0 Z10.0
T1 M6 (Fresa Topo Reto 6mm)
S12000 M3
G0 X10 Y10 Z5
G1 Z-2.0 F200
G1 X80 Y10 F600
G1 X80 Y60
G2 X60 Y80 I-20 J0
G1 X10 Y80
G1 X10 Y10
G0 Z10

T2 M6 (Fresa V-Bit Acabamento)
S15000 M3
G0 X45 Y45 Z5
G1 Z-1.5 F150
G3 X45 Y45 I10 J0 F400
G0 Z10
M5 M9
G0 X0 Y0
M30
`;

  const GCODE_DICT = [
    { code: 'G00', desc: 'Movimento Rápido' },
    { code: 'G01', desc: 'Interpolação Linear' },
    { code: 'G02', desc: 'Arco Horário (CW)' },
    { code: 'G03', desc: 'Arco Anti-Horário (CCW)' },
    { code: 'G28', desc: 'Retorno Home Primário' },
    { code: 'G30', desc: 'Retorno Home Secundário' },
    { code: 'G54', desc: 'Work Offset G54' },
    { code: 'G55', desc: 'Work Offset G55' },
    { code: 'G56', desc: 'Work Offset G56' },
    { code: 'G57', desc: 'Work Offset G57' },
    { code: 'G58', desc: 'Work Offset G58' },
    { code: 'G59', desc: 'Work Offset G59' },
    { code: 'G40', desc: 'Cancelar Compensação da Ferramenta' },
    { code: 'G41', desc: 'Compensação à Esquerda' },
    { code: 'G42', desc: 'Compensação à Direita' },
    { code: 'G80', desc: 'Cancelar Ciclo Fixo' },
    { code: 'G81', desc: 'Ciclo de Furação' },
    { code: 'G82', desc: 'Furação com Dwell' },
    { code: 'G83', desc: 'Furação Peck' },
    { code: 'G17', desc: 'Plano XY' },
    { code: 'G20', desc: 'Unidades Polegadas' },
    { code: 'G21', desc: 'Unidades Milímetros' },
    { code: 'G90', desc: 'Coordenadas Absolutas' },
    { code: 'G91', desc: 'Coordenadas Incrementais' },
    { code: 'M00', desc: 'Parada de Programa' },
    { code: 'M01', desc: 'Parada Opcional' },
    { code: 'M07', desc: 'Coolant Névoa' },
    { code: 'M08', desc: 'Coolant Fluido' },
    { code: 'M09', desc: 'Coolant Desligado' },
    { code: 'M98', desc: 'Chamada de Subprograma' },
    { code: 'M99', desc: 'Retorno de Subprograma' },
    { code: 'M03', desc: 'Ligar Spindle (CW)' },
    { code: 'M05', desc: 'Desligar Spindle' },
    { code: 'M06', desc: 'Troca de Ferramenta' },
    { code: 'M30', desc: 'Fim de Programa' }
  ];

  let config = {
    limX: 500, limY: 500, limZ: 100,
    stkX: 100, stkY: 100, stkZ: 20, stkZOrigin: 'top',
    toolDiameter: 6, stockResolution: 0.5,
    rapidRate: 6000, defaultSpindle: 12000,
    safeZ: 5, optionalStopEnabled: true,
    home28:{x:0,y:0,z:80}, home30:{x:0,y:0,z:50},
    workOffsets:{
      G54:{x:0,y:0,z:0},G55:{x:0,y:0,z:0},G56:{x:0,y:0,z:0},
      G57:{x:0,y:0,z:0},G58:{x:0,y:0,z:0},G59:{x:0,y:0,z:0}
    },
    material:'aluminum', simArcTolerance:0.05, simArcMaxSteps:4096, simAdaptive:true
  };

  const state = {
    // Oculta a trajetória verde já executada no ISO 3D.
    hidePlayedPath3D: true,
    segments: [], tools: [], warnings: [], bbox: null, units: 'mm',
    viewPlane: 'XY', scale: 1, offsetX: 0, offsetY: 0,
    selectedLine: null, playIndex: 0, playing: false, playTimer: null, playSpeed: 1,
    currentFileName: 'programa.tap', zMaxFilter: Infinity,
    renderGeometry: [], limitViolations: [], stockCache: null, stockSim: null,
    fileQueue: [], fileQueueIndex: -1, sequencePlaying: false, multiFileMode: null,
    stockQuality: 'preview', stockRefineTimer: null, stockRenderCache: null,
    isDraggingCanvas: false, dragStart: {x:0, y:0}, dragMode: 'pan',
    isoAzimuth: Math.PI/4, isoElevation: Math.atan(1/Math.sqrt(2)),
    toolLibrary: {
      1:{number:1,name:'Fresa Topo 6mm',type:'endmill',diameter:6,angle:60,flutes:2,stickout:25,holderDiameter:20,holderLength:45},
      2:{number:2,name:'V-Bit 60°',type:'vbit',diameter:6,angle:60,flutes:2,stickout:20,holderDiameter:20,holderLength:45},
      3:{number:3,name:'Ball Nose 4mm',type:'ballnose',diameter:4,angle:60,flutes:2,stickout:22,holderDiameter:20,holderLength:45}
    },
    analysis: [], stats:null, breakpoints:new Set(), bookmarks:new Set(),
    measureMode:false, measurePoints:[], history:[], historyIndex:-1, historyLock:false,
    virtualTime:0, playClockLast:0, cumulativeTimes:[], totalTime:0,
    fixtures:[], snapshots:[], recentFiles:[], activeWorkOffset:'G54',
    coolant:'off', projectionMode:'ortho', perspectiveDistance:900,
    xray:false, depthMap:false, sectionAxis:'none', sectionValue:0,
    toolVisibility:{}, showRapid:true, showCut:true, holderCollision:true, machineEvents:[],
    conditionalBreak:{toolChange:false, programStop:true, depthEnabled:false, depthZ:-10},
    jobType:'cnc', jobConfidence:0, jobEvidence:[],
    printNozzleWidth:0.45, printLayerHeight:0.20,
    orbitSensitivity:0.006,
    toolZoomFactor:1.8,
    followTool:false,
    executionWindow:0,
    materialLibrary:{
      aluminum:{name:'Alumínio',density:2.70,recommendedVc:250,chipLoad:0.05},
      steel:{name:'Aço carbono',density:7.85,recommendedVc:120,chipLoad:0.03},
      stainless:{name:'Inox',density:8.00,recommendedVc:80,chipLoad:0.02},
      wood:{name:'Madeira / MDF',density:0.70,recommendedVc:400,chipLoad:0.10},
      plastic:{name:'Plástico',density:1.10,recommendedVc:200,chipLoad:0.08}
    }
  };

  // DOM Refs
  const codeEl = document.getElementById('code');
  const highlightEl = document.getElementById('highlight');
  const gutterEl = document.getElementById('gutter');
  const editorScrollEl = document.getElementById('editorScroll');
  const lineHighlightEl = document.getElementById('lineHighlight');
  const playHighlightEl = document.getElementById('playHighlight');
  const scrollMapEl = document.getElementById('scrollMap');
  const acBox = document.getElementById('acBox');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const glCanvas = document.getElementById('glCanvas');
  const xyzChart = document.getElementById('xyzChart');
  const xyzCtx = xyzChart.getContext('2d');
  const xyzChartWrap = document.getElementById('xyzChartWrap');


