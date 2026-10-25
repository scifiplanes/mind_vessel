'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadGame } = require('../tests/harness/dom');
const { saveWorld, loadWorld, importSoloCampaign, listWorlds, deleteWorld, safeWorldName } = require('./worldFile');

async function main() {
  const g = await loadGame();
  g.ensureMP();
  const a = g.mpHello({ displayName: 'Hosty' });
  g.enterSiteFor(a.playerId, g.RG.start);
  const blob = g.saveCampaignBlob();
  assert.equal(blob.ver, 2);
  assert.ok(blob.players && blob.players.length >= 1);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-world-'));
  const file = path.join(dir, 'test.json');
  saveWorld(file, blob);
  const loaded = loadWorld(file);
  assert.equal(loaded.ver, 2);
  assert.equal(loaded.players.length, blob.players.length);
  assert.equal(loaded.RG.sites.length, blob.RG.sites.length);

  // import solo-shaped blob
  const g2 = await loadGame();
  const solo = g2.saveCampaignBlob();
  // force solo shape: strip players
  const soloBlob = Object.assign({}, solo, { ver: 1, players: null });
  const world = importSoloCampaign(soloBlob);
  assert.ok(world.players && world.players.length === 1, 'import creates one player');
  assert.equal(world.ver, 2);

  // idle pause
  const g3 = await loadGame();
  g3.ensureMP();
  g3.worldSettings.alwaysOn = false;
  const hello = g3.mpHello({ displayName: 'Idle' });
  g3.enterSiteFor(hello.playerId, g3.RG.start);
  g3.despawnPlayer(hello.playerId);
  const tick0 = g3.RG.tick;
  const gt0 = g3.gameTime;
  g3.hostTick(1);
  g3.hostTick(1);
  assert.equal(g3.gameTime, gt0, 'idle pause: gameTime frozen');
  assert.equal(g3.RG.tick, tick0, 'idle pause: RG.tick frozen');

  g3.worldSettings.alwaysOn = true;
  g3.hostTick(3);
  // always-on with no hot sites still may regionStep
  assert.ok(g3.gameTime > gt0, 'always-on advances gameTime');

  assert.equal(safeWorldName('ok_World-1'), 'ok_World-1');
  assert.equal(safeWorldName('../x'), null);
  saveWorld(path.join(dir, 'listed.json'), blob);
  const listed = listWorlds(dir);
  assert.ok(listed.some(w => w.name === 'listed' && w.bytes > 0));
  deleteWorld(dir, 'listed');
  assert.ok(!listWorlds(dir).some(w => w.name === 'listed'));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS worldFile.test');
}

main().catch(e => {
  console.error('FAIL worldFile.test', e);
  process.exit(1);
});
