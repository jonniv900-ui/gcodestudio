(function(global){
  'use strict';
  const profiles={
    grbl:{name:'GRBL',extension:'nc',toolChange:false,header:['G21','G90','G17','G40'],footer:['M5','M30']},
    mach3:{name:'Mach3',extension:'tap',toolChange:true,header:['G21','G90','G17','G40','G49'],footer:['M5','M30']},
    linuxcnc:{name:'LinuxCNC',extension:'ngc',toolChange:true,header:['G21','G90','G17','G40','G49','G64 P0.01'],footer:['M5','M2']},
    fanuc:{name:'Fanuc',extension:'nc',toolChange:true,header:['%','O1000','G21 G90 G17 G40 G49'],footer:['M5','M30','%']},
    marlin:{name:'Marlin CNC',extension:'gcode',toolChange:false,header:['G21','G90'],footer:['M5','M84']}
  };
  global.GCS_CAM_PROFILES=Object.freeze(profiles);
  global.gcsCamProfile=function(id){return profiles[id]||profiles.grbl};
})(window);
