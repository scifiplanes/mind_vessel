'use strict';
/** Exhausted pocket: Wayfarer TRAVEL must leave — not instinct WANDER */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame({ simple: true });
  const p = g.player;
  assert.ok(p && !p.dead, 'vessel');

  p.mind = ['wayfarer'];
  p.hp = p.maxHp;
  p.energy = p.maxEnergy;
  p.focus = { all: 0 };
  p.idleT = 0;
  p.exT = null;
  p.intent = null;
  p.busy = null;
  p.bad = new Map();
  p._thr = [];
  p.lastHit = 0;
  p.lastAttacker = null;
  // strip ground loot so Forager is not what we are testing
  g.objs = g.objs.filter(o => !(o.k === 'item'));

  // No pathable unexplored → Wayfarer should TRAVEL, not silent / not instinct WANDER
  const explored = g.explored;
  for (let i = 0; i < explored.length; i++) explored[i] = 1;

  const cur = g.RG.cur;
  const nb = (g.RG.sites[cur].nb || []).filter(id => id !== cur);
  assert.ok(nb.length, 'site has a neighbour');
  g.RG.prev = nb[0];
  p.siteT = 20; // past brief exhausted-pocket sit

  const it = g.think(p);
  assert.ok(it, 'exhausted Mind must act');
  assert.notEqual(it.v, 'WANDER', 'must not mask with instinct WANDER');
  assert.ok(
    it.v === 'TRAVEL' || it.act === 'travel',
    'Wayfarer should TRAVEL when local explore is exhausted; got ' + (it.v || it.act)
  );

  // Full starter Mind: whatever applies must be a Mind verb, never instinct WANDER
  p.mind = ['forager', 'coward', 'leaselife', 'wayfarer'];
  p.siteT = 20;
  p.exT = null;
  const full = g.think(p);
  assert.ok(full, 'full Mind acts');
  assert.notEqual(full.v, 'WANDER', 'no instinct WANDER; got ' + full.v);
  assert.ok(full.th, 'action comes from a Thought, not instinct');

  // Too soon after arrival (not yet idle): do not bounce through return duct
  p.siteT = 5;
  p.idleT = 0;
  for (let i = 0; i < explored.length; i++) explored[i] = 1;
  const early = g.VERB.TRAVEL(p, { to: 'deeper' });
  assert.ok(!early || early.to !== g.RG.prev, 'must not board return duct during brief sit');

  // Silent in a corridor pocket: idle waives the brief sit so Wayfarer can leave
  p.siteT = 5;
  p.idleT = 8;
  p.bad = new Map();
  // simulate prior duct markBad (old softlock)
  const leave = g.VERB.TRAVEL(p, { to: 'deeper' });
  assert.ok(leave && leave.act === 'travel', 'idle exhausted Mind can TRAVEL even with short siteT');

  p.siteT = 40;
  p.idleT = 0;
  assert.equal(g.VERB.EXPLORE(p), null, 'no pathable unexplored');

  // Ducts hidden in fog: idle TRAVEL must still route (explored[e.i] was the softlock)
  for (let i = 0; i < explored.length; i++) explored[i] = 0;
  explored[g.idx(p.x | 0, p.y | 0)] = 1;
  p.idleT = 8;
  p.siteT = 20;
  p.exT = null;
  p.mind = ['wayfarer'];
  const fogDuct = g.think(p);
  assert.ok(fogDuct && (fogDuct.v === 'TRAVEL' || fogDuct.act === 'travel' || fogDuct.v === 'EXPLORE'),
    'idle Mind acts when ducts were unexplored; got ' + (fogDuct && (fogDuct.v || fogDuct.act)));

  console.log('PASS t12-silent-mind');
}

main().catch(e => {
  console.error('FAIL t12-silent-mind', e);
  process.exit(1);
});
