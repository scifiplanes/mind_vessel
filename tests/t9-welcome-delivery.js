'use strict';
/** Welcome must reach the socket even though it is sent before sockets.set(playerId). */
const assert = require('assert');
const { loadGame } = require('./harness/dom');
const { createHost } = require('../server/hostCore');

async function main() {
  const g = await loadGame();
  g.ensureMP();

  const inbox = [];
  let boundId = null;
  const pending = new Map();
  const sockets = new Map();
  const tempId = 'tmpTest';
  pending.set('ws', { tempId, playerId: null });

  function findWs(playerId) {
    if (sockets.has(playerId)) return 'ws';
    for (const [ws, meta] of pending) {
      if (meta.tempId === playerId || meta.playerId === playerId) return ws;
    }
    return null;
  }

  const host = createHost(g, {
    send(playerId, msg) {
      const ws = findWs(playerId);
      assert.ok(ws, 'send must find socket for ' + playerId + ' (welcome delivery)');
      inbox.push(msg);
    },
  });

  const id = host.onMessage(
    { t: 'hello', displayName: 'Deliv', party: true },
    {
      tempId,
      bind(pid) {
        boundId = pid;
        sockets.set(pid, 'ws');
        pending.get('ws').playerId = pid;
      },
    }
  );
  assert.ok(id);
  assert.equal(boundId, id, 'bind called before welcome send');
  const wel = inbox.find(m => m.t === 'welcome');
  assert.ok(wel, 'welcome delivered');
  assert.ok(wel.world && wel.world.RG, 'welcome carries world');

  console.log('PASS t9-welcome-delivery');
}

main().catch(e => {
  console.error('FAIL t9-welcome-delivery', e);
  process.exit(1);
});
