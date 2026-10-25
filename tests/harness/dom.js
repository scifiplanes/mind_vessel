'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '../..');
const HTML_PATH = path.join(ROOT, 'mind-vessel.html');

function stubCanvas(window) {
  const proto = window.HTMLCanvasElement.prototype;
  proto.getContext = function getContext(type) {
    if (type !== '2d') return null;
    const noop = () => {};
    const grad = { addColorStop: noop };
    return {
      canvas: this,
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      setTransform: noop,
      resetTransform: noop,
      translate: noop,
      scale: noop,
      rotate: noop,
      save: noop,
      restore: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      rect: noop,
      fillRect: noop,
      strokeRect: noop,
      clearRect: noop,
      fill: noop,
      stroke: noop,
      clip: noop,
      fillText: noop,
      strokeText: noop,
      measureText: () => ({ width: 8 }),
      drawImage: noop,
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: noop,
    };
  };
  proto.toDataURL = () => 'data:image/png;base64,';
}

function patchBoot(html) {
  // Prevent rAF loop and main menu; expose internals as g / __MV_G
  const boot = `migrateLegacyCampaign();
loadRegionIndex();
// If opened via lobby invite (?ws=…), connect immediately — don't wait for menu
const _autoJoin=tryAutoJoinFromUrl();
if(_autoJoin){
  const resumed=loadCampaign()===true;if(!resumed)newVessel();
  updFk();uiTick();
  try{$('dlg').hidden=true;dlgOpen=false}catch(e){}
}else{
  showMainMenu();
}
requestAnimationFrame(frame);`;

  const replacement = `
paused=true;inMenu=false;
try{if(typeof hideMainMenu==='function')hideMainMenu()}catch(e){}
try{$('mainmenu').hidden=true}catch(e){}
try{$('app').classList.remove('mm-hidden')}catch(e){}
if(typeof clearCampaign==='function')try{clearCampaign()}catch(e){}
RG=null;player=null;
newVessel();
dlgOpen=false;try{$('dlg').hidden=true}catch(e){}
paused=true;inMenu=false;
updFk();uiTick();
globalThis.__MV_G=(function(){
  const g={};
  const bindFn=(n,f)=>{if(typeof f==='function')g[n]=function(){return f.apply(null,arguments)}};
  bindFn('update',update);bindFn('newVessel',newVessel);bindFn('enterSite',enterSite);bindFn('leaveSite',leaveSite);
  bindFn('travel',travel);bindFn('saveCampaign',saveCampaign);bindFn('loadCampaign',loadCampaign);bindFn('clearCampaign',clearCampaign);
  if(typeof mintWorldBlob==='function')bindFn('mintWorldBlob',mintWorldBlob);
  if(typeof showMainMenu==='function')bindFn('showMainMenu',showMainMenu);
  if(typeof hideMainMenu==='function')bindFn('hideMainMenu',hideMainMenu);
  if(typeof quitToMenu==='function')bindFn('quitToMenu',quitToMenu);
  if(typeof loadSoloSlot==='function')bindFn('loadSoloSlot',loadSoloSlot);
  if(typeof deleteSoloSlot==='function')bindFn('deleteSoloSlot',deleteSoloSlot);
  if(typeof ensureActiveSlot==='function')bindFn('ensureActiveSlot',ensureActiveSlot);
  if(typeof migrateLegacyCampaign==='function')bindFn('migrateLegacyCampaign',migrateLegacyCampaign);
  bindFn('think',think);bindFn('act',act);bindFn('followers',followers);bindFn('genRegion',genRegion);
  if(typeof bfs==='function')bindFn('bfs',bfs);
  if(typeof idx==='function')bindFn('idx',idx);
  if(typeof unexploredFor==='function')bindFn('unexploredFor',unexploredFor);
  if(typeof rngSeed==='function')bindFn('rngSeed',rngSeed);
  if(typeof pathToDuct==='function')bindFn('pathToDuct',pathToDuct);
  if(typeof pathTo==='function')bindFn('pathTo',pathTo);
  if(typeof ensureExits==='function')bindFn('ensureExits',ensureExits);
  if(typeof ensureRegionConnected==='function')bindFn('ensureRegionConnected',ensureRegionConnected);
  if(typeof soleDuctRelief==='function')bindFn('soleDuctRelief',soleDuctRelief);
  if(typeof pathDuctRelief==='function')bindFn('pathDuctRelief',pathDuctRelief);
  if(typeof travelBackOk==='function')bindFn('travelBackOk',travelBackOk);
  if(typeof siteDone==='function')bindFn('siteDone',siteDone);
  if(typeof frontierValue==='function')bindFn('frontierValue',frontierValue);
  if(typeof hopBanned==='function')bindFn('hopBanned',hopBanned);
  if(typeof seekTileToward==='function')bindFn('seekTileToward',seekTileToward);
  if(typeof starterThoughts==='function')bindFn('starterThoughts',starterThoughts);
  if(typeof restNeed==='function')bindFn('restNeed',restNeed);
  if(typeof restGates==='function')bindFn('restGates',restGates);
  if(typeof restProfile==='function')bindFn('restProfile',restProfile);
  if(typeof composeMind==='function')bindFn('composeMind',composeMind);
  if(typeof mindPool==='function')bindFn('mindPool',mindPool);
  if(typeof thinkWithMind==='function')bindFn('thinkWithMind',thinkWithMind);
  if(typeof previewAtFor==='function')bindFn('previewAtFor',previewAtFor);
  if(typeof startBusy==='function')bindFn('startBusy',startBusy);
  if(typeof heal==='function')bindFn('heal',heal);
  if(typeof seenThreats==='function')bindFn('seenThreats',seenThreats);
  if(typeof fitMind==='function')bindFn('fitMind',fitMind);
  bindFn('flushCurDun',flushCurDun);bindFn('syncSite',syncSite);bindFn('makeActor',makeActor);
  if(typeof bumpAssembly==='function')bindFn('bumpAssembly',bumpAssembly);
  if(typeof competency==='function')bindFn('competency',competency);
  if(typeof hasComp==='function')bindFn('hasComp',hasComp);
  if(typeof taxFocus==='function')bindFn('taxFocus',taxFocus);
  if(typeof refundFocus==='function')bindFn('refundFocus',refundFocus);
  if(typeof faunaRoom==='function')bindFn('faunaRoom',faunaRoom);
  if(typeof ambient==='function')bindFn('ambient',ambient);
  if(typeof absorb==='function')bindFn('absorb',absorb);
  if(typeof assemblyWake==='function')bindFn('assemblyWake',assemblyWake);
  if(typeof assemblySleep==='function')bindFn('assemblySleep',assemblySleep);
  if(typeof footOf==='function')bindFn('footOf',footOf);
  if(typeof footDist==='function')bindFn('footDist',footDist);
  if(typeof canSit==='function')bindFn('canSit',canSit);
  if(typeof wakeMass==='function')bindFn('wakeMass',wakeMass);
  if(typeof massKindFor==='function')bindFn('massKindFor',massKindFor);
  if(typeof walk==='function')bindFn('walk',walk);
  if(typeof coalesce==='function')bindFn('coalesce',coalesce);
  if(typeof split==='function')bindFn('split',split);
  if(typeof splitNear==='function')bindFn('splitNear',splitNear);
  if(typeof bondSpaceFor==='function')bindFn('bondSpaceFor',bondSpaceFor);
  if(typeof domBond==='function')bindFn('domBond',domBond);
  if(typeof assemblyFeel==='function')bindFn('assemblyFeel',assemblyFeel);
  if(typeof habitFeel==='function')bindFn('habitFeel',habitFeel);
  if(typeof telegraphBonds==='function')bindFn('telegraphBonds',telegraphBonds);
  if(typeof describeActor==='function')bindFn('describeActor',describeActor);
  if(typeof describeSite==='function')bindFn('describeSite',describeSite);
  if(typeof aname==='function')bindFn('aname',aname);
  if(typeof spawnAt==='function')bindFn('spawnAt',spawnAt);
  if(typeof makeCreature==='function')bindFn('makeCreature',makeCreature);
  if(typeof makeCreatureKind==='function')bindFn('makeCreatureKind',makeCreatureKind);
  Object.defineProperty(g,'rooms',{enumerable:true,get(){return rooms}});
  Object.defineProperty(g,'map',{enumerable:true,get(){return map}});
  if(typeof patience==='function')bindFn('patience',patience);
  bindFn('serializeActor',serializeActor);bindFn('reviveActor',reviveActor);
  bindFn('serializeCiv',serializeCiv);bindFn('reviveCiv',reviveCiv);
  bindFn('serializeSiteDun',serializeSiteDun);bindFn('reviveSiteDun',reviveSiteDun);
  bindFn('serializeVmem',serializeVmem);bindFn('reviveVmem',reviveVmem);
  if(typeof despawnPlayer==='function')bindFn('despawnPlayer',despawnPlayer);
  if(typeof respawnPlayer==='function')bindFn('respawnPlayer',respawnPlayer);
  if(typeof enterSiteFor==='function')bindFn('enterSiteFor',enterSiteFor);
  if(typeof leaveSiteFor==='function')bindFn('leaveSiteFor',leaveSiteFor);
  if(typeof updateAll==='function')bindFn('updateAll',updateAll);
  if(typeof withSite==='function')bindFn('withSite',withSite);
  if(typeof isVessel==='function')bindFn('isVessel',isVessel);
  if(typeof siteOf==='function')bindFn('siteOf',siteOf);
  if(typeof saveCampaignBlob==='function')bindFn('saveCampaignBlob',saveCampaignBlob);
  if(typeof loadCampaignBlob==='function')bindFn('loadCampaignBlob',loadCampaignBlob);
  if(typeof importCampaignBlob==='function')bindFn('importCampaignBlob',importCampaignBlob);
  if(typeof setPlayerMind==='function')bindFn('setPlayerMind',setPlayerMind);
  if(typeof hostTick==='function')bindFn('hostTick',hostTick);
  if(typeof ensureMP==='function')bindFn('ensureMP',ensureMP);
  if(typeof mpHello==='function')bindFn('mpHello',mpHello);
  if(typeof mpMindSet==='function')bindFn('mpMindSet',mpMindSet);
  if(typeof mpVote==='function')bindFn('mpVote',mpVote);
  if(typeof mpSignal==='function')bindFn('mpSignal',mpSignal);
  if(typeof mpKick==='function')bindFn('mpKick',mpKick);
  if(typeof mpBan==='function')bindFn('mpBan',mpBan);
  if(typeof partyPresence==='function')bindFn('partyPresence',partyPresence);
  if(typeof canLootRemains==='function')bindFn('canLootRemains',canLootRemains);
  if(typeof pvpAllows==='function')bindFn('pvpAllows',pvpAllows);
  if(typeof showJoinDlg==='function')bindFn('showJoinDlg',showJoinDlg);
  if(typeof showFriendsDlg==='function')bindFn('showFriendsDlg',showFriendsDlg);
  if(typeof netActive==='function')bindFn('netActive',netActive);
  if(typeof netConnectRelay==='function')bindFn('netConnectRelay',netConnectRelay);
  if(typeof netConnectDirect==='function')bindFn('netConnectDirect',netConnectDirect);
  if(typeof netProposeVote==='function')bindFn('netProposeVote',netProposeVote);
  if(typeof netSignal==='function')bindFn('netSignal',netSignal);
  if(typeof renderMenu==='function')bindFn('renderMenu',renderMenu);
  if(typeof toggleMenu==='function')bindFn('toggleMenu',toggleMenu);
  if(typeof setManual==='function')bindFn('setManual',setManual);
  if(typeof stickVec==='function')bindFn('stickVec',stickVec);
  if(typeof stickMoving==='function')bindFn('stickMoving',stickMoving);
  if(typeof manualIntentOk==='function')bindFn('manualIntentOk',manualIntentOk);
  if(typeof manualDuctWanted==='function')bindFn('manualDuctWanted',manualDuctWanted);
  if(typeof thoughtFleeOnly==='function')bindFn('thoughtFleeOnly',thoughtFleeOnly);
  if(typeof refreshMindOpps==='function')bindFn('refreshMindOpps',refreshMindOpps);
  if(typeof manualApproach==='function')bindFn('manualApproach',manualApproach);
  if(typeof manualWait==='function')bindFn('manualWait',manualWait);
  Object.defineProperty(g,'MANUAL',{enumerable:true,get(){return MANUAL},set(v){MANUAL=v}});
  Object.defineProperty(g,'stickKeys',{enumerable:true,get(){return stickKeys}});
  Object.defineProperty(g,'mindOpps',{enumerable:true,get(){return mindOpps}});
  Object.defineProperty(g,'menuOpen',{enumerable:true,get(){return menuOpen},set(v){menuOpen=v}});
  Object.defineProperty(g,'RG',{enumerable:true,get(){return RG},set(v){RG=v}});
  Object.defineProperty(g,'player',{enumerable:true,get(){return player},set(v){player=v}});
  Object.defineProperty(g,'actors',{enumerable:true,get(){return actors},set(v){actors=v}});
  Object.defineProperty(g,'objs',{enumerable:true,get(){return objs},set(v){objs=v}});
  Object.defineProperty(g,'paused',{enumerable:true,get(){return paused},set(v){paused=v}});
  Object.defineProperty(g,'speed',{enumerable:true,get(){return speed},set(v){speed=v}});
  Object.defineProperty(g,'gameTime',{enumerable:true,get(){return gameTime},set(v){gameTime=v}});
  Object.defineProperty(g,'nextId',{enumerable:true,get(){return nextId},set(v){nextId=v}});
  Object.defineProperty(g,'vmem',{enumerable:true,get(){return vmem},set(v){vmem=v}});
  Object.defineProperty(g,'save',{enumerable:true,get(){return save},set(v){save=v}});
  Object.defineProperty(g,'cyc',{enumerable:true,get(){return cyc}});
  Object.defineProperty(g,'TH',{enumerable:true,get(){return TH}});
  Object.defineProperty(g,'KIND',{enumerable:true,get(){return KIND}});
  Object.defineProperty(g,'BUILD',{enumerable:true,get(){return BUILD}});
  Object.defineProperty(g,'PROP_FOOT',{enumerable:true,get(){return typeof PROP_FOOT!=='undefined'?PROP_FOOT:undefined}});
  Object.defineProperty(g,'MP',{enumerable:true,get(){return typeof MpWorld!=='undefined'?MpWorld:undefined},set(v){MpWorld=v}});
  Object.defineProperty(g,'MpWorld',{enumerable:true,get(){return typeof MpWorld!=='undefined'?MpWorld:undefined},set(v){MpWorld=v}});
  Object.defineProperty(g,'worldSettings',{enumerable:true,get(){return typeof worldSettings!=='undefined'?worldSettings:undefined},set(v){worldSettings=v}});
  Object.defineProperty(g,'MW',{enumerable:true,get(){return MW}});
  Object.defineProperty(g,'MH',{enumerable:true,get(){return MH}});
  Object.defineProperty(g,'explored',{enumerable:true,get(){return explored}});
  Object.defineProperty(g,'vis',{enumerable:true,get(){return vis}});
  Object.defineProperty(g,'exits',{enumerable:true,get(){return exits},set(v){exits=v}});
  Object.defineProperty(g,'pendingTravel',{enumerable:true,get(){return pendingTravel},set(v){pendingTravel=v}});
  Object.defineProperty(g,'VERB',{enumerable:true,get(){return VERB}});
  Object.defineProperty(g,'R',{enumerable:true,get(){return R},set(v){R=v}});
  Object.defineProperty(g,'AUTOPAUSE',{enumerable:true,get(){return typeof AUTOPAUSE!=='undefined'?AUTOPAUSE:undefined}});
  Object.defineProperty(g,'dlgOpen',{enumerable:true,get(){return dlgOpen},set(v){dlgOpen=v}});
  // Perf / lag probes (read-only snapshots for long-run profiling)
  if(typeof draw==='function')bindFn('draw',draw);
  if(typeof updFx==='function')bindFn('updFx',updFx);
  if(typeof updBarks==='function')bindFn('updBarks',updBarks);
  if(typeof uiTick==='function')bindFn('uiTick',uiTick);
  if(typeof rebuildEnv==='function')bindFn('rebuildEnv',rebuildEnv);
  if(typeof renderLevel==='function')bindFn('renderLevel',renderLevel);
  if(typeof pruneDunCanvases==='function')bindFn('pruneDunCanvases',pruneDunCanvases);
  if(typeof regionLive==='function')bindFn('regionLive',regionLive);
  if(typeof regionStep==='function')bindFn('regionStep',regionStep);
  if(typeof computeVis==='function')bindFn('computeVis',computeVis);
  if(typeof bfs==='function')bindFn('bfs',bfs);
  g.mutDbg=function mutDbg(patch){if(!patch)return;for(const k of Object.keys(patch))DBG[k]=patch[k];};
  // One-shot wrappers to count hot calls during update (lag investigation)
  let _lagC=null,_lagWrapped=false,_lagMs=null;
  g.installLagCounters=function installLagCounters(){
    if(_lagWrapped)return;_lagWrapped=true;
    _lagC={bfs:0,think:0,emit:0,regionLive:0,rebuildEnv:0,poseUpdate:0,computeVis:0};
    _lagMs={bfs:0,think:0,emit:0,regionLive:0,rebuildEnv:0,poseUpdate:0,computeVis:0};
    const wrap=(name,fn)=>{
      return function(){
        _lagC[name]++;
        const t0=performance.now();
        try{return fn.apply(this,arguments)}finally{_lagMs[name]+=performance.now()-t0}
      };
    };
    // Only wrap function-decls (const bindings like freshNews cannot be reassigned)
    bfs=wrap('bfs',bfs);
    think=wrap('think',think);
    emit=wrap('emit',emit);
    regionLive=wrap('regionLive',regionLive);
    rebuildEnv=wrap('rebuildEnv',rebuildEnv);
    poseUpdate=wrap('poseUpdate',poseUpdate);
    if(typeof computeVis==='function')computeVis=wrap('computeVis',computeVis);
  };
  g.resetLagCounters=function resetLagCounters(){
    if(!_lagC)return null;
    for(const k of Object.keys(_lagC)){_lagC[k]=0;_lagMs[k]=0}
    return _lagC;
  };
  g.frameCounters=function frameCounters(){
    if(!_lagC)return null;
    const out={};for(const k of Object.keys(_lagC))out[k]={n:_lagC[k],ms:+_lagMs[k].toFixed(3)};
    return out;
  };
  g.countUpdateWork=function countUpdateWork(dt,n){
    g.installLagCounters();g.resetLagCounters();
    for(let i=0;i<n;i++)update(dt);
    const out=Object.assign({},_lagC);for(const k of Object.keys(out))out[k]=+(out[k]/n).toFixed(2);return out;
  };
  g.timeUpdateSlices=function timeUpdateSlices(dt,n){
    n=n||40;const acc={updActor:0,pose:0,rest:0,total:0};
    for(let i=0;i<n;i++){
      const t0=performance.now();
      gameTime+=dt;stats.t+=dt;gossipStep(dt);
      if(floraEnvDirty&&(floraEnvT-=dt)<=0){floraEnvT=1;floraEnvDirty=false;rebuildEnv()}
      visT-=dt;if(visT<=0){visT=.1;computeVis();updatePlayerStealth()}
      const s=RG.sites[RG.cur];cycleStep(dt);envStep(dt,s);
      const t1=performance.now();
      for(const a of actors)updActor(a,dt);
      const t2=performance.now();
      if(DBG.pose)for(const a of actors){if(!a.dead)try{poseUpdate(a,dt)}catch(e){}}
      const t3=performance.now();
      regAcc+=dt;if(regAcc>=2){regAcc=0;regionLive()}
      separateActors();
      actors=actors.filter(a=>!a.dead||a===player);
      const t4=performance.now();
      acc.updActor+=t2-t1;acc.pose+=t3-t2;acc.rest+=(t1-t0)+(t4-t3);acc.total+=t4-t0;
    }
    const k=1/n;return{updActor:+(acc.updActor*k).toFixed(3),pose:+(acc.pose*k).toFixed(3),rest:+(acc.rest*k).toFixed(3),total:+(acc.total*k).toFixed(3)};
  };
  g.snapLag=function snapLag(){
    const sites=RG&&RG.sites||[];
    let dunN=0,dunCanvasN=0,dunBytes=0,vmemN=0;
    const taBytes=a=>a&&a.byteLength||0;
    for(const s of sites){
      if(!s.dun)continue;dunN++;
      if(s.dun.lvlCanvas)dunCanvasN++;
      const d=s.dun;dunBytes+=taBytes(d.map)+taBytes(d.blk)+taBytes(d.flr)+taBytes(d.stock)+taBytes(d.slick)+taBytes(d.ECHO)+taBytes(d.POWER)+(d.objs?d.objs.length*64:0);
    }
    if(vmem&&vmem.explored)for(const e of vmem.explored.values())vmemN+=taBytes(e);
    const logN=typeof logEl!=='undefined'&&logEl?logEl.children.length:0;
    const poseN=(actors||[]).filter(a=>a&&a.pose).length;
    return{
      gameTime,tick:RG?RG.tick:0,cur:RG?RG.cur:null,
      actors:(actors||[]).length,liveActors:(actors||[]).filter(a=>a&&!a.dead).length,
      objs:(objs||[]).length,parts:(parts||[]).length,floats:(floats||[]).length,rings:(rings||[]).length,
      barks:(barks||[]).length,newsWait:(newsWait||[]).length,
      heardN:heardN?heardN.size:0,news:RG&&RG.news?RG.news.length:0,
      scanned:scanned?scanned.size:0,tileFeed:tileFeed?tileFeed.size:0,
      envLights:(envLights||[]).length,lights:(lights||[]).length,
      walks:(typeof WALKS!=='undefined'&&WALKS)?WALKS.length:0,
      regrow:(regrowList||[]).length,conduit:(conduitList||[]).length,echo:(echoList||[]).length,
      sites:sites.length,visited:sites.filter(s=>s.visited).length,dunN,dunCanvasN,dunBytes,vmemN,logN,poseN,
      softTint:typeof _softTint!=='undefined'?_softTint.size:0,
      partPool:(typeof partPool!=='undefined'?partPool.length:0),
      barkSeen:typeof barkSeen!=='undefined'?barkSeen.size:0,
      chronicle:typeof chronicle!=='undefined'?chronicle.length:0,
      toasts:typeof toasts!=='undefined'?toasts.length:0
    };
  };
  if(typeof saveCampaignBlob!=='function'){
    g.saveCampaignBlob=function(){
      const id=(typeof ensureActiveSlot==='function'?ensureActiveSlot():null);
      const key=id?('mindvessel.campaign.slot.'+id):'mindvessel.campaign.v1';
      const prev=localStorage.getItem(key);
      saveCampaign();
      const raw=localStorage.getItem(key);
      if(prev!=null)localStorage.setItem(key,prev);else localStorage.removeItem(key);
      return raw?JSON.parse(raw):null;
    };
  }
  Object.defineProperty(g,'inMenu',{enumerable:true,get(){return inMenu},set(v){inMenu=!!v}});
  Object.defineProperty(g,'regionIndex',{enumerable:true,get(){return regionIndex}});
  return g;
})();
`;

  if (!html.includes(boot)) {
    // fallback: replace requestAnimationFrame(frame) and main-menu boot loosely
    let out = html.replace(/requestAnimationFrame\(frame\);\s*<\/script>/, replacement + '\n</script>');
    out = out.replace(/migrateLegacyCampaign\(\);\s*loadRegionIndex\(\);[\s\S]*?showMainMenu\(\);\s*\}\s*/, '');
    out = out.replace(/const resumed=loadCampaign\(\)===true;if\(!resumed\)newVessel\(\);\s*updFk\(\);uiTick\(\);\s*showDlg\([\s\S]*?\);\s*/, '');
    return out;
  }
  return html.replace(boot, replacement);
}

async function loadGame(opts = {}) {
  const { w = 1280, h = 800, simple = false, file = HTML_PATH } = opts;
  let html = fs.readFileSync(file, 'utf8');
  html = patchBoot(html);

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => {
    if (String(e && e.message || e).includes('Not implemented')) return;
  });

  const dom = new JSDOM(html, {
    url: 'http://localhost/mind-vessel.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      stubCanvas(window);
      window.matchMedia = query => ({
        matches: !String(query).includes('max-width'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
      window.cancelAnimationFrame = id => clearTimeout(id);
      if (typeof window.fetch !== 'function') {
        window.fetch = () => Promise.reject(new Error('fetch stub'));
      }
      window.HTMLElement.prototype.scrollIntoView = () => {};
      Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return w; } });
      Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return h; } });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return w; } });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get() { return h; } });
      // allow harness to assign locals via Function
      window.__mvSet = (k, v) => {
        // eslint-disable-next-line no-new-func
        Function('v', k + '=v')(v);
      };
    },
  });

  await new Promise(r => setImmediate(r));
  const g = dom.window.__MV_G;
  if (!g) throw new Error('__MV_G not installed — boot patch failed');
  g.window = dom.window;
  g.document = dom.window.document;
  g.dom = dom;
  try {
    if (typeof g.window.setSimple === 'function') g.window.setSimple(!!simple);
  } catch (e) {}
  return g;
}

module.exports = { loadGame, patchBoot, stubCanvas, HTML_PATH, ROOT };
