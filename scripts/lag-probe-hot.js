'use strict';
/** Count expensive calls inside update as a parked session ages. */
const { loadGame } = require('../tests/harness/dom');

async function main(){
  const g=await loadGame({simple:false});
  g.paused=false;g.dlgOpen=false;
  try{for(const k of Object.keys(g.AUTOPAUSE||{}))g.AUTOPAUSE[k]=false}catch(e){}
  g.player.mind=['rest'];g.pendingTravel=null;
  if(g.vis)for(let i=0;i<g.vis.length;i++)g.vis[i]=1;

  // Install counters via harness helpers if present; else wrap through mutDbg realm
  if(typeof g.installLagCounters!=='function'){
    console.error('need installLagCounters');
  }
  const rows=[];
  const dt=0.05;
  for(const sec of[0,30,60,120,180]){
    const steps=sec===0?0:Math.round(30/dt);
    for(let i=0;i<steps;i++){g.pendingTravel=null;g.update(dt);if(g.updFx)g.updFx(dt)}
    const c=g.installLagCounters?g.resetLagCounters():null;
    // 40 updates with counting
    const counts=g.countUpdateWork?g.countUpdateWork(dt,40):null;
    const snap=g.snapLag();
    const upd={};
    const samples=[];
    for(let i=0;i<40;i++){const t0=performance.now();g.update(dt);samples.push(performance.now()-t0)}
    upd.mean=+(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(3);
    rows.push({sec:sec===0?0:sec,updMean:upd.mean,snap:{actors:snap.liveActors,objs:snap.objs,parts:snap.parts,news:snap.news,envLights:snap.envLights},counts,bd:g.timeUpdateSlices(dt,40)});
  }
  console.log(JSON.stringify({rows},null,2));
  require('fs').writeFileSync('.preview-res/lag-probe-hot.json',JSON.stringify({rows},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
