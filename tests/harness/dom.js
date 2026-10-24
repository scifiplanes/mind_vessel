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
  // Prevent rAF loop and startup dialog; expose internals as g / __MV_G
  const boot = `const resumed=loadCampaign()===true;if(!resumed)newVessel();
updFk();uiTick();
// If opened via lobby invite (?ws=…), connect immediately — don't wait for Begin
const _autoJoin=tryAutoJoinFromUrl();
if(!_autoJoin){
  showDlg('MIND//VESSEL',START,resumed?'Continue':'Begin',()=>{let done=false;try{done=localStorage.getItem('mindvessel.coached5')==='1'}catch(e){}if(!done)coach(0)});
}else{
  try{$('dlg').hidden=true;dlgOpen=false}catch(e){}
}
requestAnimationFrame(frame);`;

  const replacement = `
paused=true;
if(typeof clearCampaign==='function')try{clearCampaign()}catch(e){}
RG=null;player=null;
newVessel();
dlgOpen=false;try{$('dlg').hidden=true}catch(e){}
paused=true;
updFk();uiTick();
globalThis.__MV_G=(function(){
  const g={};
  const bindFn=(n,f)=>{if(typeof f==='function')g[n]=function(){return f.apply(null,arguments)}};
  bindFn('update',update);bindFn('newVessel',newVessel);bindFn('enterSite',enterSite);bindFn('leaveSite',leaveSite);
  bindFn('travel',travel);bindFn('saveCampaign',saveCampaign);bindFn('loadCampaign',loadCampaign);bindFn('clearCampaign',clearCampaign);
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
  Object.defineProperty(g,'exits',{enumerable:true,get(){return exits},set(v){exits=v}});
  Object.defineProperty(g,'pendingTravel',{enumerable:true,get(){return pendingTravel},set(v){pendingTravel=v}});
  Object.defineProperty(g,'VERB',{enumerable:true,get(){return VERB}});
  Object.defineProperty(g,'R',{enumerable:true,get(){return R},set(v){R=v}});
  Object.defineProperty(g,'AUTOPAUSE',{enumerable:true,get(){return typeof AUTOPAUSE!=='undefined'?AUTOPAUSE:undefined}});
  Object.defineProperty(g,'dlgOpen',{enumerable:true,get(){return dlgOpen},set(v){dlgOpen=v}});
  if(typeof saveCampaignBlob!=='function'){
    g.saveCampaignBlob=function(){
      const prev=localStorage.getItem('mindvessel.campaign.v1');
      saveCampaign();
      const raw=localStorage.getItem('mindvessel.campaign.v1');
      if(prev!=null)localStorage.setItem('mindvessel.campaign.v1',prev);else localStorage.removeItem('mindvessel.campaign.v1');
      return raw?JSON.parse(raw):null;
    };
  }
  return g;
})();
`;

  if (!html.includes(boot)) {
    // fallback: replace requestAnimationFrame(frame) and showDlg boot loosely
    let out = html.replace(/requestAnimationFrame\(frame\);\s*<\/script>/, replacement + '\n</script>');
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
