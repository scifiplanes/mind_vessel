'use strict';
/**
 * Controlled lag hypothesis validation.
 * Parks the vessel (no travel), forces full visibility, ablates systems.
 */
const { loadGame } = require('../tests/harness/dom');

function mean(xs){return xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0}
function median(xs){const a=xs.slice().sort((p,q)=>p-q);const m=(a.length/2)|0;return a.length%2?a[m]:(a[m-1]+a[m])/2}
function pct(xs,p){const a=xs.slice().sort((p,q)=>p-q);return a[Math.min(a.length-1,Math.floor(p/100*a.length))]||0}

function forceVis(g){
  if(g.vis)for(let i=0;i<g.vis.length;i++)g.vis[i]=1;
  if(g.explored)for(let i=0;i<g.explored.length;i++)if(!g.explored[i])g.explored[i]=1;
}

function parkPlayer(g){
  const p=g.player;
  // Strip travel / exploration drives so the vessel stays put
  p.mind=['rest','feed'];
  p.intent=null;p.path=null;p.busy=null;p.travelTo=null;p.exT=null;p.idleT=0;
  g.pendingTravel=null;
  // Starve auto-travel: remove TRAVEL thoughts from mind if any slipped in
  p.mind=p.mind.filter(t=>{const T=g.TH[t];return T&&!T.v.some(v=>v[0]==='TRAVEL')});
  if(!p.mind.length)p.mind=['rest'];
}

function setDbg(g,patch){
  // DBG is const in game — mutate fields
  const D=g.dom.window.eval?null:null;
  // Access via snap closure: use Function in script realm through a tiny helper installed on g
}

async function installHooks(g){
  // Patch update to optionally skip pose / measure slices by wrapping via __MV_G
  // Expose DBG mutate + timed update breakdown through a one-shot Function injected into boot…
  // Simpler: use existing binds and monkeypatch g.update after reading DBG via snapLag side channel.
  // Install timing hooks into the live script by evaluating inside the IIFE — not available.
  // Instead: wrap the exported update and call pose/updActor separately? Can't — not exported.
  //
  // Approach: mutate DBG.pose via localStorage + reload is heavy.
  // Add a tiny mutator on g from harness: we already have snapLag in same scope as DBG.
  // Extend harness? For this script, re-patch by reloading with custom HTML is overkill.
  //
  // Use g.window and document — DBG is not on window.
  // HACK: saveCampaignBlob path… 
  // Best: call into snapLag's realm by adding g.setDbg to harness. Do that now in this script
  // by re-loading? User wants validation now — mutate through a Function that harness can add.
  //
  // Quick path: edit is already in harness — add g.mutDbg and g.timeUpdate in lag-validate by
  // requiring a local patch. I'll inline a second loadGame with patched HTML.
}

function bench(fn,n){
  const s=[];
  for(let i=0;i<n;i++){const t0=performance.now();fn();s.push(performance.now()-t0)}
  return{mean:+mean(s).toFixed(3),med:+median(s).toFixed(3),p95:+pct(s,95).toFixed(3),max:+Math.max(...s).toFixed(3)};
}

async function runPhase(g,label,seconds,opts={}){
  parkPlayer(g);
  forceVis(g);
  g.paused=false;g.dlgOpen=false;
  if(opts.pose===false)g.mutDbg({pose:false});
  if(opts.pose===true)g.mutDbg({pose:true});
  const dt=0.05;
  const steps=Math.round(seconds/dt);
  const t0=performance.now();
  for(let i=0;i<steps;i++){
    g.pendingTravel=null;
    if(g.player){g.player.travelTo=null;g.player.exT=null}
    g.update(dt);
  }
  const wall=performance.now()-t0;
  const upd=bench(()=>{g.pendingTravel=null;g.update(dt)},80);
  const snap=g.snapLag();
  const breakdown=typeof g.timeUpdateSlices==='function'?g.timeUpdateSlices(dt,60):null;
  return{label,seconds,wallSec:+(wall/1000).toFixed(2),upd,snap:{
    liveActors:snap.liveActors,objs:snap.objs,parts:snap.parts,envLights:snap.envLights,
    regrow:snap.regrow,poseN:snap.poseN,dunN:snap.dunN,dunCanvasN:snap.dunCanvasN,
    news:snap.news,heardN:snap.heardN,logN:snap.logN,walks:snap.walks
  },breakdown,opts};
}

async function main(){
  // Reload harness file to pick up any mutDbg we add — add mutators here via monkeypatch of snapLag realm
  // by editing dom.js first if missing.
  const g=await loadGame({simple:false});
  if(typeof g.mutDbg!=='function'||typeof g.timeUpdateSlices!=='function'){
    console.error('Harness missing mutDbg/timeUpdateSlices — patching expected. Available:',Object.keys(g).filter(k=>typeof g[k]==='function').slice(0,30));
    // Fallback without breakdown
  }

  try{for(const k of Object.keys(g.AUTOPAUSE||{}))g.AUTOPAUSE[k]=false}catch(e){}

  const results={when:new Date().toISOString(),phases:[]};

  // Baseline parked dwell
  results.phases.push(await runPhase(g,'parked_60s_pose_on',60,{pose:true}));

  // Continue another 120s same session (accumulation while parked)
  results.phases.push(await runPhase(g,'parked_plus_120s_pose_on',120,{pose:true}));

  // Ablation: pose off for 60s
  results.phases.push(await runPhase(g,'parked_60s_pose_off',60,{pose:false}));

  // Pose back on
  results.phases.push(await runPhase(g,'parked_60s_pose_on_again',60,{pose:true}));

  // Fresh vessel, pose off from the start for 180s
  g.newVessel();
  try{for(const k of Object.keys(g.AUTOPAUSE||{}))g.AUTOPAUSE[k]=false}catch(e){}
  results.phases.push(await runPhase(g,'fresh_180s_pose_off',180,{pose:false}));
  g.newVessel();
  try{for(const k of Object.keys(g.AUTOPAUSE||{}))g.AUTOPAUSE[k]=false}catch(e){}
  results.phases.push(await runPhase(g,'fresh_180s_pose_on',180,{pose:true}));

  // Compare growth
  const a=results.phases.find(p=>p.label==='parked_60s_pose_on');
  const b=results.phases.find(p=>p.label==='parked_plus_120s_pose_on');
  const off=results.phases.find(p=>p.label==='fresh_180s_pose_off');
  const on=results.phases.find(p=>p.label==='fresh_180s_pose_on');

  results.verdicts=[
    {
      id:'V1_parked_accumulates',
      claim:'Even with travel disabled, update() cost rises over a parked session',
      before:a&&a.upd,after:b&&b.upd,
      snapDelta:a&&b?{
        objs:b.snap.objs-a.snap.objs,
        parts:b.snap.parts-a.snap.parts,
        envLights:b.snap.envLights-a.snap.envLights,
        regrow:b.snap.regrow-a.snap.regrow,
        actors:b.snap.liveActors-a.snap.liveActors,
        poseN:b.snap.poseN-a.snap.poseN,
        dunN:b.snap.dunN-a.snap.dunN,
      }:null,
      verdict:a&&b&&(b.upd.mean-a.upd.mean)>1?'SUPPORTED':a&&b&&(b.upd.mean-a.upd.mean)>0.2?'PARTIAL':'REJECTED',
    },
    {
      id:'V2_pose_dominates',
      claim:'Pose system accounts for most of the long-run update cost',
      poseOn:on&&on.upd,poseOff:off&&off.upd,
      ratio:on&&off&&off.upd.mean>0?+(on.upd.mean/off.upd.mean).toFixed(2):null,
      verdict:on&&off&&on.upd.mean>off.upd.mean*1.8?'SUPPORTED':on&&off&&on.upd.mean>off.upd.mean*1.2?'PARTIAL':'REJECTED',
    },
    {
      id:'V3_envLights_regrow_grow',
      claim:'envLights and/or regrowList grow while parked and track cost',
      evidence:a&&b?{env:b.snap.envLights-a.snap.envLights,regrow:b.snap.regrow-a.snap.regrow,updGrowth:+(b.upd.mean-a.upd.mean).toFixed(3)}:null,
      verdict:a&&b&&(b.snap.envLights-a.snap.envLights>20||b.snap.regrow-a.snap.regrow>50)?'SUPPORTED':'REJECTED',
    },
    {
      id:'V4_parts_grow_parked',
      claim:'Particle count climbs while parked (ambient FX)',
      evidence:a&&b?{partsFrom:a.snap.parts,partsTo:b.snap.parts}:null,
      verdict:a&&b&&b.snap.parts-a.snap.parts>200?'SUPPORTED':'REJECTED',
    },
  ];

  const fs=require('fs');
  const path=require('path');
  const out=path.join(__dirname,'../.preview-res/lag-validate.json');
  fs.writeFileSync(out,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
  console.error('Wrote',out);
}

main().catch(e=>{console.error(e);process.exit(1)});
