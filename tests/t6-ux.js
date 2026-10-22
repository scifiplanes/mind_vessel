'use strict';
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame();
  assert.equal(typeof g.window.showFriendsDlg, 'function', 'showFriendsDlg');
  assert.equal(typeof g.window.showJoinDlg, 'function', 'showJoinDlg');
  assert.equal(typeof g.window.netConnectRelay, 'function', 'netConnectRelay');
  assert.equal(typeof g.window.netConnectDirect, 'function', 'netConnectDirect');
  assert.equal(typeof g.window.netActive, 'function', 'netActive');
  assert.equal(typeof g.window.netProposeVote, 'function', 'netProposeVote');
  assert.equal(typeof g.window.netSignal, 'function', 'netSignal');
  assert.equal(g.window.netActive(), false, 'starts offline');

  g.menuOpen = true;
  g.renderMenu();
  const html = g.document.getElementById('menu').innerHTML;
  assert.ok(/Play with friends/i.test(html), 'menu has Play with friends');

  g.window.showFriendsDlg('join');
  const body = g.document.getElementById('dlg-b').innerHTML;
  assert.ok(/Join code/i.test(body), 'friends dialog has join code field');
  assert.ok(/Host a world/i.test(body), 'friends dialog has host tab');

  assert.ok(g.player && g.RG, 'solo campaign boot intact');
  const blob = g.saveCampaignBlob();
  assert.ok(blob && blob.RG, 'solo save still works');

  console.log('PASS t6-ux');
}

main().catch(e => {
  console.error('FAIL t6-ux', e);
  process.exit(1);
});
