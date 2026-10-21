'use strict';
/**
 * Join-code relay: host dials outbound; clients redeem codes.
 * Usage: node relay/server.js [--port 7474]
 * Default public URL placeholder: ws://127.0.0.1:7474
 */
const http = require('http');
const { WebSocketServer } = require('ws');
const { encode, decode } = require('../net/protocol');

function parseArgs(argv) {
  let port = 7474;
  for (let i = 2; i < argv.length; i++) if (argv[i] === '--port') port = +argv[++i];
  return { port };
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

function createRelay() {
  const rooms = new Map(); // code -> { hostWs, clients: Map(clientId, ws), password }

  function registerHost(ws, msg) {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    rooms.set(code, { hostWs: ws, clients: new Map(), password: msg.password || null, _seq: 0 });
    ws._roomCode = code;
    ws._role = 'host';
    ws.send(encode({ t: 'host.registered', code }));
    return code;
  }

  function joinClient(ws, msg) {
    const code = String(msg.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.hostWs || room.hostWs.readyState !== 1) {
      ws.send(encode({ t: 'error', error: 'no_room' }));
      return null;
    }
    if (room.password && msg.password !== room.password) {
      ws.send(encode({ t: 'error', error: 'bad_password' }));
      return null;
    }
    const clientId = 'c' + (++room._seq);
    room.clients.set(clientId, ws);
    ws._roomCode = code;
    ws._role = 'client';
    ws._clientId = clientId;
    ws.send(encode({ t: 'joined', code, clientId }));
    return clientId;
  }

  function onMessage(ws, data) {
    const msg = decode(data);
    if (msg.t === 'host.register') {
      registerHost(ws, msg);
      return;
    }
    if (msg.t === 'client.join') {
      joinClient(ws, msg);
      return;
    }
    if (msg.t === 'relay') {
      const room = rooms.get(ws._roomCode);
      if (!room) return;
      if (ws._role === 'client') {
        // client -> host
        if (room.hostWs.readyState === 1) {
          room.hostWs.send(encode({
            t: 'relay',
            fromClient: ws._clientId,
            playerId: msg.playerId || null,
            msg: msg.msg,
          }));
        }
      } else if (ws._role === 'host') {
        const clientWs = room.clients.get(msg.toClient);
        if (clientWs && clientWs.readyState === 1) {
          clientWs.send(encode({ t: 'relay', playerId: msg.playerId || null, msg: msg.msg }));
        }
      }
    }
  }

  function onClose(ws) {
    const code = ws._roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (ws._role === 'host') {
      for (const c of room.clients.values()) {
        try { c.send(encode({ t: 'error', error: 'host_gone' })); c.close(); } catch (e) {}
      }
      rooms.delete(code);
    } else if (ws._role === 'client') {
      room.clients.delete(ws._clientId);
      if (room.hostWs.readyState === 1) {
        room.hostWs.send(encode({ t: 'client.gone', clientId: ws._clientId }));
      }
    }
  }

  return { rooms, onMessage, onClose, registerHost, joinClient };
}

function main() {
  const args = parseArgs(process.argv);
  const relay = createRelay();
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MIND//VESSEL relay\n');
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => {
    ws.on('message', d => {
      try { relay.onMessage(ws, d); } catch (e) {
        try { ws.send(encode({ t: 'error', error: String(e.message || e) })); } catch (_) {}
      }
    });
    ws.on('close', () => relay.onClose(ws));
  });
  server.listen(args.port, () => console.log(`Relay ws://127.0.0.1:${args.port}`));
}

if (require.main === module) main();

module.exports = { createRelay, makeCode };
