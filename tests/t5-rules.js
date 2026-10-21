'use strict';
const assert = require('assert');
const { loadGame } = require('./harness/dom');
const { createHost } = require('../server/hostCore');

async function main() {
  const g = await loadGame();
  g.ensureMP();
  g.worldSettings.pvp = false;
  g.worldSettings.remainsLockSec = 600;

  // Identity: token return
  const a1 = g.mpHello({ displayName: 'Ann' });
  g.enterSiteFor(a1.playerId, g.RG.start);
  g.despawnPlayer(a1.playerId);
  const a2 = g.mpHello({ token: a1.token });
  assert.equal(a2.playerId, a1.playerId, 'token reconnect');
  assert.ok(a2.returning);

  // Claim name/password
  g.mpHello({ displayName: 'Bob' }); // ensure ensureMP
  const claim = g.mpHello({ displayName: 'Cara' });
  const rec = g.MP.players.get(claim.playerId);
  rec.claimName = 'cara';
  rec.claimPass = 'pw';
  g.despawnPlayer(claim.playerId);
  const back = g.mpHello({ name: 'cara', password: 'pw' });
  assert.equal(back.playerId, claim.playerId);

  // Votes + host override
  const inbox = new Map();
  const host = createHost(g, {
    send(id, msg) { if (!inbox.has(id)) inbox.set(id, []); inbox.get(id).push(msg); },
    broadcast(msg) {
      for (const id of g.MP.connected) {
        if (!inbox.has(id)) inbox.set(id, []);
        inbox.get(id).push(msg);
      }
    },
  });
  // ensure two connected
  g.respawnPlayer(a1.playerId);
  g.MP.hostPlayerId = a1.playerId;
  const b = g.mpHello({ displayName: 'Bea', party: true });
  g.enterSiteFor(b.playerId, g.RG.start);
  g.MP.connected = new Set([a1.playerId, b.playerId]);
  g.paused = false;
  host.onMessage({ t: 'vote', action: 'pause' }, { playerId: b.playerId });
  assert.equal(g.paused, false, 'one vote not enough');
  host.onMessage({ t: 'vote', action: 'pause' }, { playerId: a1.playerId });
  assert.equal(g.paused, true, 'majority pauses');
  host.onMessage({ t: 'vote', action: 'resume', force: true }, { playerId: a1.playerId });
  assert.equal(g.paused, false, 'host force resume');

  // PvP flag / remains
  assert.equal(g.pvpAllows(), false);
  const rem = { ownerId: a1.playerId, lootT: g.gameTime + 600 };
  assert.equal(g.canLootRemains(b.playerId, rem), false);
  rem.lootT = g.gameTime - 1;
  assert.equal(g.canLootRemains(b.playerId, rem), true);
  g.worldSettings.pvp = true;
  assert.equal(g.canLootRemains(b.playerId, { ownerId: a1.playerId, lootT: g.gameTime + 9999 }), true);

  // Party map: password party
  g.worldSettings.pvp = false;
  const p1 = g.mpHello({ displayName: 'P1', party: true });
  const p2 = g.mpHello({ displayName: 'P2', party: true });
  g.enterSiteFor(p1.playerId, g.RG.start);
  const far = g.RG.sites.find(s => s.id !== g.RG.start);
  g.enterSiteFor(p2.playerId, far.id);
  let presence = g.partyPresence(p1.playerId);
  assert.ok(presence.some(x => x.id === p2.playerId), 'party sees each other');

  // Meet + crew without party
  const q1 = g.mpHello({ displayName: 'Q1', party: false });
  const q2 = g.mpHello({ displayName: 'Q2', party: false });
  g.enterSiteFor(q1.playerId, g.RG.start);
  g.enterSiteFor(q2.playerId, g.RG.start);
  host.noteMeetings();
  presence = g.partyPresence(q1.playerId);
  assert.ok(presence.some(x => x.id === q2.playerId), 'met in same site');

  // Signals
  inbox.clear();
  host.onMessage({ t: 'signal', text: 'duct' }, { playerId: q1.playerId });
  assert.ok([...inbox.values()].flat().some(m => m.t === 'signal.fx' && m.text === 'duct'));

  // Kick + ban
  assert.equal(typeof g.mpKick, 'function');
  assert.equal(typeof g.mpBan, 'function');
  const tok = g.MP.players.get(q2.playerId).token;
  g.mpBan(q2.playerId);
  g.despawnPlayer(q2.playerId);
  const banned = g.mpHello({ token: tok });
  assert.equal(banned.error, 'banned');

  // Fog not shared: vmem independent
  const va = g.MP.players.get(p1.playerId).vmem;
  const vb = g.MP.players.get(p2.playerId).vmem;
  assert.notEqual(va, vb);

  console.log('PASS t5-rules');
}

main().catch(e => {
  console.error('FAIL t5-rules', e);
  process.exit(1);
});
