'use strict';
const assert = require('assert');
const { loadGame } = require('../tests/harness/dom');
const { createHost } = require('./hostCore');
const { encode, decode } = require('../net/protocol');

async function main() {
  const g = await loadGame();
  g.ensureMP();
  g.worldSettings.maxPlayers = 2;

  const inbox = new Map();
  const host = createHost(g, {
    send(id, msg) {
      if (!inbox.has(id)) inbox.set(id, []);
      inbox.get(id).push(msg);
    },
  });

  const idA = host.onMessage({ t: 'hello', displayName: 'A', party: true }, { tempId: 'tmpA' });
  assert.ok(idA);
  const welA = inbox.get(idA).find(m => m.t === 'welcome');
  assert.ok(welA && welA.vessel && welA.site, 'welcome with site');

  // second player different site
  const sites = g.RG.sites;
  const other = sites.find(s => s.id !== g.MP.players.get(idA).siteId);
  const idB = host.onMessage({ t: 'hello', displayName: 'B', party: true }, { tempId: 'tmpB' });
  assert.ok(idB);
  g.leaveSiteFor(idB);
  g.enterSiteFor(idB, other.id);
  inbox.clear();

  host.onMessage({ t: 'mind.set', mind: ['flee', 'survive'] }, { playerId: idA });
  const you = inbox.get(idA).find(m => m.t === 'you.vessel');
  assert.deepStrictEqual(you.mind, ['flee', 'survive']);

  // B does not get A's site actors in region.soft
  inbox.clear();
  const soft = host.regionSoft(idB);
  assert.equal(soft.t, 'region.soft');
  const snapA = host.siteSnapshot(g.MP.players.get(idA).siteId, idA);
  const snapB = host.siteSnapshot(g.MP.players.get(idB).siteId, idB);
  assert.notEqual(snapA.siteId, snapB.siteId);
  assert.ok(!snapB.actors.some(a => a.ownerId === idA), 'B site snapshot has no A vessel');

  // full
  const idC = host.onMessage({ t: 'hello', displayName: 'C' }, { tempId: 'tmpC' });
  assert.equal(idC, null);
  const err = inbox.get('tmpC') && inbox.get('tmpC').find(m => m.t === 'error');
  assert.ok(err && err.error === 'full', 'rejects when full');

  // encode roundtrip used by ws layer
  assert.equal(decode(encode({ t: 'hello' })).t, 'hello');

  console.log('PASS host.test');
}

main().catch(e => {
  console.error('FAIL host.test', e);
  process.exit(1);
});
