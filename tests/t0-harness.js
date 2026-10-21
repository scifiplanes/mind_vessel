'use strict';
/** Slice 0 RED/GREEN: harness loads the game and exposes g.* */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame({ simple: false });
  assert.ok(g, 'loadGame returns g');
  assert.ok(g.RG, 'g.RG region exists after boot');
  assert.ok(g.RG.sites && g.RG.sites.length > 0, 'region has sites');
  assert.equal(typeof g.newVessel, 'function', 'g.newVessel');
  assert.equal(typeof g.update, 'function', 'g.update');
  assert.equal(typeof g.saveCampaignBlob, 'function', 'g.saveCampaignBlob');
  assert.ok(g.player, 'g.player vessel exists');
  const t0 = g.gameTime;
  g.paused = false;
  g.update(0.1);
  assert.ok(g.gameTime > t0, 'update advances gameTime');
  const blob = g.saveCampaignBlob();
  assert.ok(blob && blob.RG && blob.RG.sites.length, 'campaign blob serializes RG');
  console.log('PASS t0-harness');
}

main().catch(e => {
  console.error('FAIL t0-harness', e);
  process.exit(1);
});
