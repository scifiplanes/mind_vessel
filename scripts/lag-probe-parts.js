'use strict';
/** Isolate: does a full parts[] buffer make update()/emit expensive? */
const { loadGame } = require('../tests/harness/dom');

function mean(xs){return xs.reduce((s,x)=>s+x,0)/xs.length}
function bench(fn,n=100){const s=[];for(let i=0;i<n;i++){const t0=performance.now();fn();s.push(performance.now()-t0)}return{mean:+mean(s).toFixed(3),max:+Math.max(...s).toFixed(3)}}

async function main(){
  const g=await loadGame({simple:false});
  g.paused=false;g.dlgOpen=false;
  try{for(const k of Object.keys(g.AUTOPAUSE||{}))g.AUTOPAUSE[k]=false}catch(e){}
  g.player.mind=['rest'];g.pendingTravel=null;

  // Fill parts to cap via repeated emit-equivalent: call update+updFx until parts hit 2500
  for(let i=0;i<800;i++){g.update(0.05);if(typeof g.updFx==='function')g.updFx(0.05)}
  let snap=g.snapLag();
  console.log('after warmup parts',snap.parts,'actors',snap.liveActors);

  // Drain parts
  g.mutDbg({}); // no-op keep
  // Clear parts by running updFx with huge dt many times — or expose clear
  // Direct: use update until empty won't work. Inject clear via mutator:
  if(typeof g.clearParts!=='function'){
    // fall through — use updFx with life expiry: set by running long
  }

  const full=bench(()=>g.update(0.05),120);
  const snapFull=g.snapLag();

  // Clear particles: expire them
  for(let i=0;i<80;i++)if(g.updFx)g.updFx(1);
  const snapEmpty=g.snapLag();
  const empty=bench(()=>g.update(0.05),120);

  // Refill to cap again
  for(let i=0;i<800;i++){g.update(0.05);if(g.updFx)g.updFx(0.05)}
  const snapRefill=g.snapLag();
  const full2=bench(()=>g.update(0.05),120);

  // Slice breakdown at full vs empty
  for(let i=0;i<80;i++)if(g.updFx)g.updFx(1);
  const bdEmpty=g.timeUpdateSlices(0.05,80);
  for(let i=0;i<800;i++){g.update(0.05);if(g.updFx)g.updFx(0.05)}
  const bdFull=g.timeUpdateSlices(0.05,80);

  // Emit stress: call emit-like through many actors fighting — simpler: measure emit via Function
  // Use save path: g doesn't expose emit. timeUpdateSlices already shows updActor.

  const out={
    full:{upd:full,parts:snapFull.parts,actors:snapFull.liveActors},
    empty:{upd:empty,parts:snapEmpty.parts,actors:snapEmpty.liveActors},
    fullAgain:{upd:full2,parts:snapRefill.parts},
    breakdownEmpty:bdEmpty,
    breakdownFull:bdFull,
    verdict:{
      updateSlowerWhenPartsFull:full.mean>empty.mean*1.5,
      ratio:+(full.mean/Math.max(0.001,empty.mean)).toFixed(2),
      updActorFullVsEmpty:+(bdFull.updActor/Math.max(0.001,bdEmpty.updActor)).toFixed(2),
    }
  };
  console.log(JSON.stringify(out,null,2));
  require('fs').writeFileSync(require('path').join(__dirname,'../.preview-res/lag-probe-parts.json'),JSON.stringify(out,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
