'use strict';
const assert = require('assert');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { encode, decode } = require('../net/protocol');
const { createRelay } = require('./server');

function onceMessage(ws) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 3000);
    ws.once('message', d => { clearTimeout(t); resolve(decode(d)); });
  });
}

async function main() {
  const relay = createRelay();
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => {
    ws.on('message', d => relay.onMessage(ws, d));
    ws.on('close', () => relay.onClose(ws));
  });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const url = `ws://127.0.0.1:${port}`;

  const host = new WebSocket(url);
  await new Promise(r => host.once('open', r));
  host.send(encode({ t: 'host.register', password: 'secret' }));
  const reg = await onceMessage(host);
  assert.equal(reg.t, 'host.registered');
  assert.ok(reg.code && reg.code.length === 6);

  // bad password
  const bad = new WebSocket(url);
  await new Promise(r => bad.once('open', r));
  bad.send(encode({ t: 'client.join', code: reg.code, password: 'wrong' }));
  const err = await onceMessage(bad);
  assert.equal(err.error, 'bad_password');
  bad.close();

  const c1 = new WebSocket(url);
  await new Promise(r => c1.once('open', r));
  c1.send(encode({ t: 'client.join', code: reg.code, password: 'secret' }));
  const joined = await onceMessage(c1);
  assert.equal(joined.t, 'joined');

  // client -> host relay
  const hostGot = onceMessage(host);
  c1.send(encode({ t: 'relay', msg: { t: 'hello', displayName: 'P1' } }));
  const forwarded = await hostGot;
  assert.equal(forwarded.t, 'relay');
  assert.equal(forwarded.msg.t, 'hello');
  assert.ok(forwarded.fromClient);

  // host -> client
  const c1Got = onceMessage(c1);
  host.send(encode({ t: 'relay', toClient: forwarded.fromClient, msg: { t: 'welcome', playerId: 'p1' } }));
  const back = await c1Got;
  assert.equal(back.t, 'relay');
  assert.equal(back.msg.t, 'welcome');

  // BYO: second relay instance proves URL is just an address (no assert beyond connect)
  const c2 = new WebSocket(url);
  await new Promise(r => c2.once('open', r));
  c2.send(encode({ t: 'client.join', code: reg.code, password: 'secret' }));
  const j2 = await onceMessage(c2);
  assert.equal(j2.t, 'joined');

  // unset password room
  const host2 = new WebSocket(url);
  await new Promise(r => host2.once('open', r));
  host2.send(encode({ t: 'host.register' }));
  const reg2 = await onceMessage(host2);
  const c3 = new WebSocket(url);
  await new Promise(r => c3.once('open', r));
  c3.send(encode({ t: 'client.join', code: reg2.code }));
  const j3 = await onceMessage(c3);
  assert.equal(j3.t, 'joined', 'code alone enough without password');

  host.close(); c1.close(); c2.close(); host2.close(); c3.close();
  await new Promise(r => server.close(r));
  console.log('PASS relay.test');
}

main().catch(e => {
  console.error('FAIL relay.test', e);
  process.exit(1);
});
