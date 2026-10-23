'use strict';
/** Rest: innate drive, completion composeMind, interrupt skips rewrite */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame({ simple: true });
  assert.equal(typeof g.restNeed, 'function', 'restNeed');
  assert.equal(typeof g.restGates, 'function', 'restGates');
  assert.equal(typeof g.composeMind, 'function', 'composeMind');
  assert.equal(typeof g.mindPool, 'function', 'mindPool');

  const p = g.player;
  assert.ok(p && !p.dead, 'vessel');

  // Innate rest: no Rest Thought required when hurt + calm (energy high so FEED does not hold)
  p.mind = ['prospect', 'wayfarer', 'tunnel'];
  p.hp = p.maxHp * 0.4;
  p.energy = Math.max(40, p.maxEnergy * 0.8);
  p._thr = [];
  p.lastHit = 0;
  p.lastAttacker = null;
  assert.equal(g.restGates(p), true, 'gates open when hurt + energy');
  assert.equal(g.restNeed(p), true, 'need when below hpTrig');
  const it = g.think(p);
  assert.ok(it, 'think returns intent');
  assert.equal(it.act, 'rest', 'innate rest without Rest Thought');
  assert.equal(it.v, 'REST', 'innate REST verb');
  assert.equal(it.th, null, 'innate has no Thought id');

  // Pool includes Memory
  g.save.lib = ['forager', 'survive', 'flee', 'strike', 'wayfarer', 'prospect', 'listen', 'rest'];
  p.mind = ['forager'];
  const pool = g.mindPool(p);
  assert.ok(pool.includes('survive') && pool.includes('strike'), 'pool pulls from Memory');

  // composeMind reshuffles prev Mind (niche order); does not inject work broads from Memory
  p.restMindAt = 0;
  p.restCd = 0;
  p.hp = p.maxHp * 0.5;
  p.mind = ['delver', 'forager', 'wayfarer'];
  g.save.lib = ['forager', 'survive', 'flee', 'strike', 'wayfarer', 'prospect', 'listen', 'rest', 'delver', 'rivetlife'];
  assert.equal(g.composeMind(p), true, 'compose succeeds');
  assert.ok(!p.mind.includes('rivetlife'), 'compose does not inject Plate Yard from Memory');
  assert.ok(p.mind.includes('forager') && p.mind.includes('delver'), 'keeps prior Mind Thoughts');
  const iSur = p.mind.indexOf('forager'), iWork = p.mind.indexOf('delver');
  assert.ok(iSur >= 0 && iWork >= 0 && iSur < iWork, 'survive before work after reshape');
  assert.ok((p.restMindAt || 0) > g.gameTime, 'rewrite cooldown set');
  const mid = p.mind.slice();
  assert.equal(g.composeMind(p), false, 'cooldown blocks second rewrite');
  assert.deepEqual(p.mind, mid, 'Mind unchanged during cooldown');

  // after rest completion, restCd blocks immediate innate rest thrash
  p.restMindAt = 0;
  p.restCd = 0;
  p.hp = p.maxHp * 0.35;
  p.energy = p.maxEnergy * 0.8;
  p.mind = ['prospect', 'wayfarer'];
  g.act(p, { self: 1, act: 'rest', lab: 'resting' });
  const done2 = p.busy.done;
  p.busy = null;
  done2();
  assert.ok((p.restCd || 0) > g.gameTime, 'restCd set after rest');
  assert.equal(g.restNeed(p), false, 'restCd blocks innate restNeed');

  // Completion path: act rest busy done heals + compose (reshapes; may fill travel gap)
  p.restMindAt = 0;
  p.restCd = 0;
  g.save.lib = ['forager', 'survive', 'flee', 'wanderlust', 'wayfarer', 'delver'];
  p.mind = ['forager', 'delver'];
  p.hp = Math.max(1, Math.floor(p.maxHp * 0.35));
  const hp0 = p.hp;
  g.act(p, { self: 1, act: 'rest', lab: 'resting' });
  assert.ok(p.busy && p.busy.type === 'rest', 'rest busy started');
  const done = p.busy.done;
  p.busy = null;
  done();
  assert.ok(p.hp > hp0, 'heal on completion');
  assert.ok(p.mind.includes('forager'), 'keeps forager after rest compose');
  assert.ok(p.mind.indexOf('forager') < p.mind.indexOf('delver') || !p.mind.includes('delver'), 'survive ordered before work');
  assert.deepEqual(g.save.mind, p.mind, 'save.mind synced');

  // Interrupt: clearing busy without done skips rewrite
  p.restMindAt = 0;
  p.mind = ['forager', 'wayfarer'];
  const frozen = p.mind.slice();
  g.act(p, { self: 1, act: 'rest', lab: 'resting' });
  assert.ok(p.busy && p.busy.type === 'rest');
  p.busy = null; // threat cancel path — done never runs
  assert.deepEqual(p.mind, frozen, 'interrupt leaves Mind unchanged');

  // Flora skip
  const mold = g.actors.find(a => a.flora) || null;
  if (mold) {
    mold.hp = mold.maxHp * 0.2;
    mold.energy = 40;
    assert.equal(g.restGates(mold), false, 'flora cannot innate rest');
  }

  console.log('PASS t11-rest-mind');
}

main().catch(e => {
  console.error('FAIL t11-rest-mind', e);
  process.exit(1);
});
