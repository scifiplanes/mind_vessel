'use strict';
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame();
  assert.equal(typeof g.window.showJoinDlg, 'function', 'showJoinDlg');
  assert.equal(typeof g.window.netConnectRelay, 'function', 'netConnectRelay');
  assert.equal(typeof g.window.netConnectDirect, 'function', 'netConnectDirect');
  assert.equal(typeof g.window.netActive, 'function', 'netActive');
  assert.equal(typeof g.window.netProposeVote, 'function', 'netProposeVote');
  assert.equal(typeof g.window.netSignal, 'function', 'netSignal');
  assert.equal(g.window.netActive(), false, 'starts offline');

  // Menu exposes Join when offline
  g.menuOpen = true;
  g.renderMenu();
  const html = g.document.getElementById('menu').innerHTML;
  assert.ok(/Join multiplayer/i.test(html), 'menu has Join');

  // Solo still works
  assert.ok(g.player && g.RG, 'solo campaign boot intact');
  const blob = g.saveCampaignBlob();
  assert.ok(blob && blob.RG, 'solo save still works');

  console.log('PASS t6-ux');
}

main().catch(e => {
  console.error('FAIL t6-ux', e);
  process.exit(1);
});
