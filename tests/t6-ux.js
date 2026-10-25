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
  assert.ok(/Quit to menu/i.test(html), 'menu has Quit to menu');

  g.window.showFriendsDlg('join');
  const body = g.document.getElementById('dlg-b').innerHTML;
  assert.ok(/Join code/i.test(body), 'friends dialog has join code field');
  assert.ok(/Host a world/i.test(body), 'friends dialog has host tab');

  assert.ok(g.player && g.RG, 'solo campaign boot intact');
  const blob = g.saveCampaignBlob();
  assert.ok(blob && blob.RG, 'solo save still works');

  // Region slots: save → quit → list → reload
  assert.equal(typeof g.window.showMainMenu, 'function', 'showMainMenu');
  assert.equal(typeof g.window.quitToMenu, 'function', 'quitToMenu');
  g.saveCampaign();
  const idx = g.regionIndex;
  assert.ok(idx && idx.activeId && idx.slots.length >= 1, 'active region slot after save');
  const slotId = idx.activeId;
  const siteName = g.RG.sites[g.RG.start].name;

  g.window.quitToMenu();
  assert.equal(g.inMenu, true, 'quit opens main menu');
  assert.ok(g.document.getElementById('mainmenu') && !g.document.getElementById('mainmenu').hidden, 'mainmenu visible');
  assert.ok(!g.player && !g.RG, 'play state cleared in menu');

  const ok = g.loadSoloSlot(slotId);
  assert.equal(ok, true, 'reload solo slot');
  g.window.hideMainMenu();
  g.inMenu = false;
  assert.ok(g.player && g.RG, 'slot restored vessel');
  assert.equal(g.RG.sites[g.RG.start].name, siteName, 'same start site');

  const before = g.regionIndex.slots.length;
  g.deleteSoloSlot(slotId);
  assert.ok(g.regionIndex.slots.length === before - 1 || !g.regionIndex.slots.some(s => s.id === slotId), 'slot deleted');

  // mintWorldBlob for host create path
  assert.equal(typeof g.mintWorldBlob, 'function', 'mintWorldBlob');
  const minted = g.mintWorldBlob();
  assert.ok(minted && minted.RG && minted.RG.sites.length, 'minted world has region');
  assert.ok(g.RG && g.player, 'mint restores current campaign');

  console.log('PASS t6-ux');
}

main().catch(e => {
  console.error('FAIL t6-ux', e);
  process.exit(1);
});
