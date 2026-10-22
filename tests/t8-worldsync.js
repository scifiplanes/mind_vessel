'use strict';
/** Joining client must adopt the host region, not keep a solo campaign. */
const assert = require('assert');
const { loadGame } = require('./harness/dom');
const { createHost } = require('../server/hostCore');

async function main() {
  const hostG = await loadGame();
  hostG.ensureMP();
  const inbox = new Map();
  const host = createHost(hostG, {
    send(id, msg) {
      if (!inbox.has(id)) inbox.set(id, []);
      inbox.get(id).push(msg);
    },
  });
  const id = host.onMessage({ t: 'hello', displayName: 'HostFace', party: true }, { tempId: 'tmp' });
  const wel = inbox.get(id).find(m => m.t === 'welcome');
  assert.ok(wel && wel.world && wel.world.RG, 'welcome.world');

  const clientG = await loadGame();
  const soloStart = clientG.RG.sites[clientG.RG.start].name;
  const hostStart = hostG.RG.sites[hostG.RG.start].name;
  // Solo boots are random — force a mismatch if they happened to match
  if (soloStart === hostStart) {
    clientG.RG.sites[clientG.RG.start].name = 'SOLO-ONLY-' + Date.now();
  }
  assert.notEqual(clientG.RG.sites[clientG.RG.start].name, hostStart, 'precondition: different worlds');

  const ok = clientG.loadCampaignBlob({
    ver: wel.world.ver,
    RG: wel.world.RG,
    cyc: wel.world.cyc,
    newsId: wel.world.newsId,
    nextId: wel.world.nextId,
    gameTime: wel.world.gameTime,
    settings: wel.world.settings,
    players: null,
    vessel: null,
  });
  assert.ok(ok, 'client loads host world blob');
  assert.equal(clientG.RG.sites[clientG.RG.start].name, hostStart, 'client region matches host');
  assert.equal(clientG.RG.sites.length, hostG.RG.sites.length, 'same site count');

  console.log('PASS t8-worldsync');
}

main().catch(e => {
  console.error('FAIL t8-worldsync', e);
  process.exit(1);
});
