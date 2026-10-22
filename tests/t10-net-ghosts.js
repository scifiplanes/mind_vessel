'use strict';
/** Remote vessels must use a drawable species and appear in site snapshots. */
const assert = require('assert');
const { loadGame } = require('./harness/dom');
const { createHost } = require('../server/hostCore');

async function main() {
  const g = await loadGame();
  g.ensureMP();
  g.paused = false;

  const host = createHost(g, { send() {} });
  const a = host.onMessage({ t: 'hello', displayName: 'Alpha', party: true }, { tempId: 'tA', bind() {} });
  const b = host.onMessage({ t: 'hello', displayName: 'Beta', party: true }, { tempId: 'tB', bind() {} });
  assert.ok(a && b);
  const siteA = g.MP.players.get(a).siteId;
  const siteB = g.MP.players.get(b).siteId;
  // Put both on same site
  if (siteB !== siteA) {
    g.leaveSiteFor(b);
    g.enterSiteFor(b, siteA);
  }
  assert.equal(g.MP.players.get(a).siteId, g.MP.players.get(b).siteId, 'same site');

  const snap = host.siteSnapshot(siteA, a);
  const vessels = snap.actors.filter(x => x.ownerId);
  assert.ok(vessels.length >= 2, 'snapshot has both vessels, got ' + vessels.length);
  assert.ok(vessels.every(v => v.species), 'species included in snapshot');

  for (const v of vessels) {
    assert.ok(v.species && typeof v.species === 'string', 'species string on vessel snap');
    assert.ok(v.name, 'display name on vessel snap');
  }

  console.log('PASS t10-net-ghosts');
}

main().catch(e => {
  console.error('FAIL t10-net-ghosts', e);
  process.exit(1);
});
