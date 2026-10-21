'use strict';
/** Slice 1: multi-vessel, multi-site, despawn/respawn (offline) */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame();
  assert.equal(typeof g.ensureMP, 'function', 'ensureMP');
  assert.equal(typeof g.enterSiteFor, 'function', 'enterSiteFor');
  assert.equal(typeof g.leaveSiteFor, 'function', 'leaveSiteFor');
  assert.equal(typeof g.updateAll, 'function', 'updateAll');
  assert.equal(typeof g.despawnPlayer, 'function', 'despawnPlayer');
  assert.equal(typeof g.respawnPlayer, 'function', 'respawnPlayer');
  assert.equal(typeof g.setPlayerMind, 'function', 'setPlayerMind');
  assert.equal(typeof g.isVessel, 'function', 'isVessel');

  g.ensureMP();
  const a = g.mpHello({ displayName: 'Alpha' });
  const b = g.mpHello({ displayName: 'Beta' });
  assert.ok(a.playerId && b.playerId && a.playerId !== b.playerId, 'two player ids');
  assert.ok(a.token && b.token, 'tokens issued');

  const sites = g.RG.sites;
  const start = g.RG.start;
  const other = sites.find(s => s.id !== start && (s.nb || []).includes(start)) || sites.find(s => s.id !== start);
  assert.ok(other, 'another site exists');

  g.enterSiteFor(a.playerId, start);
  g.enterSiteFor(b.playerId, other.id);
  const pa = g.MP.players.get(a.playerId);
  const pb = g.MP.players.get(b.playerId);
  assert.equal(pa.siteId, start, 'A at start');
  assert.equal(pb.siteId, other.id, 'B at other site');
  assert.ok(g.MP.hot.has(start) && g.MP.hot.has(other.id), 'both sites hot');

  const t0 = g.gameTime;
  g.paused = false;
  g.updateAll(0.25);
  assert.ok(g.gameTime > t0, 'updateAll advances time');
  assert.ok(g.MP.hot.has(start) && g.MP.hot.has(other.id), 'both still hot after tick');

  // Mind edit only affects that vessel
  const mindA = ['flee', 'survive'];
  g.setPlayerMind(a.playerId, mindA);
  assert.deepStrictEqual([...g.MP.players.get(a.playerId).vessel.mind], mindA);
  assert.notDeepStrictEqual([...g.MP.players.get(b.playerId).vessel.mind], mindA);

  assert.ok(g.isVessel(pa.vessel), 'isVessel');
  assert.equal(g.siteOf(pa.vessel), start, 'siteOf A');
  assert.equal(g.siteOf(pb.vessel), other.id, 'siteOf B');

  // Leave B — other site sleeps; start stays hot
  g.leaveSiteFor(b.playerId);
  assert.ok(!g.MP.hot.has(other.id), 'B site cold after leave');
  assert.ok(g.MP.hot.has(start), 'A site still hot');

  // Despawn A
  const stashSite = g.MP.players.get(a.playerId).siteId;
  g.despawnPlayer(a.playerId);
  assert.ok(!g.MP.hot.has(start) || ![...g.MP.hot.get(start).actors || []].some(x => x === pa.vessel), 'vessel despawned from hot');
  assert.ok(g.MP.players.get(a.playerId).stashed, 'stashed');

  const back = g.respawnPlayer(a.playerId);
  assert.ok(back && back.siteId === stashSite, 'respawn at last site');
  assert.ok(g.MP.hot.has(stashSite), 'site hot again');
  assert.ok(!g.MP.players.get(a.playerId).stashed, 'not stashed');

  console.log('PASS t1-multisite');
}

main().catch(e => {
  console.error('FAIL t1-multisite', e);
  process.exit(1);
});
