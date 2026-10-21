'use strict';
/**
 * Node listen/dedicated host.
 * Usage:
 *   node server/host.js --world worlds/demo.json [--port 7777] [--relay ws://...] [--import-campaign camp.json]
 *   node server/host.js --port 7777   # ephemeral in-memory world via jsdom boot
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { encode, decode } = require('../net/protocol');
const { saveWorld, loadWorld, importSoloCampaign } = require('./worldFile');
const { createHost } = require('./hostCore');

function parseArgs(argv) {
  const out = { port: 7777, world: null, relay: null, importCampaign: null, alwaysOn: false, pvp: false, password: null, maxPlayers: 32 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') out.port = +argv[++i];
    else if (a === '--world') out.world = argv[++i];
    else if (a === '--relay') out.relay = argv[++i];
    else if (a === '--import-campaign') out.importCampaign = argv[++i];
    else if (a === '--always-on') out.alwaysOn = true;
    else if (a === '--pvp') out.pvp = true;
    else if (a === '--password') out.password = argv[++i];
    else if (a === '--max-players') out.maxPlayers = +argv[++i];
  }
  return out;
}

async function bootGame() {
  const { loadGame } = require('../tests/harness/dom');
  const g = await loadGame();
  g.ensureMP();
  return g;
}

async function main() {
  const args = parseArgs(process.argv);
  const g = await bootGame();
  Object.assign(g.worldSettings, {
    alwaysOn: args.alwaysOn,
    pvp: args.pvp,
    maxPlayers: args.maxPlayers,
    password: args.password,
    passwordHash: args.password,
  });

  if (args.importCampaign) {
    const raw = JSON.parse(fs.readFileSync(args.importCampaign, 'utf8'));
    const world = importSoloCampaign(raw);
    g.loadCampaignBlob(world);
    g.ensureMP();
  } else if (args.world && fs.existsSync(args.world)) {
    g.loadCampaignBlob(loadWorld(args.world));
    g.ensureMP();
  }

  const sockets = new Map(); // playerId -> ws
  const pending = new Map(); // ws -> temp

  const host = createHost(g, {
    send(playerId, msg) {
      const ws = sockets.get(playerId);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
      else {
        for (const [ws2, meta] of pending) {
          if (meta.tempId === playerId && ws2.readyState === WebSocket.OPEN) ws2.send(encode(msg));
        }
      }
    },
    broadcast(msg, except) {
      for (const [id, ws] of sockets) {
        if (id !== except && ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
      }
    },
  });

  function attachWs(ws, role) {
    let playerId = null;
    const tempId = 'tmp_' + Math.random().toString(36).slice(2, 8);
    pending.set(ws, { tempId, role });
    ws.on('message', data => {
      try {
        const msg = decode(data);
        if (msg.t === 'hello') {
          const id = host.onMessage(msg, { playerId: null, tempId, ws });
          if (id) {
            playerId = id;
            sockets.set(id, ws);
            pending.delete(ws);
          }
        } else {
          host.onMessage(msg, { playerId, tempId, ws });
        }
      } catch (e) {
        ws.send(encode({ t: 'error', error: String(e.message || e) }));
      }
    });
    ws.on('close', () => {
      pending.delete(ws);
      if (playerId) {
        sockets.delete(playerId);
        host.onDisconnect(playerId);
      }
      persist();
    });
  }

  function persist() {
    if (!args.world) return;
    try {
      const blob = g.saveCampaignBlob();
      if (blob) saveWorld(args.world, blob);
    } catch (e) {
      console.warn('persist failed', e);
    }
  }

  if (args.relay) {
    const relayUrl = args.relay.replace(/\/$/, '') + (args.relay.includes('?') ? '&' : '?') + 'role=host';
    const connectRelay = () => {
      const ws = new WebSocket(args.relay, { headers: {} });
      // protocol: first message register
      ws.on('open', () => {
        ws.send(encode({ t: 'host.register', password: args.password || null }));
      });
      ws.on('message', data => {
        try {
          const msg = decode(data);
          if (msg.t === 'host.registered') {
            console.log('Registered with relay. Join code:', msg.code);
            return;
          }
          if (msg.t === 'relay' && msg.fromClient != null) {
            // multiplexed client frame
            const clientId = msg.fromClient;
            let playerId = msg.playerId || null;
            const inner = msg.msg;
            if (inner.t === 'hello') {
              const fakeSend = (pid, m) => {
                ws.send(encode({ t: 'relay', toClient: clientId, playerId: pid, msg: m }));
                if (m.t === 'welcome') {
                  // track mapping
                  sockets.set(pid, { readyState: WebSocket.OPEN, send: d => ws.send(encode({ t: 'relay', toClient: clientId, playerId: pid, msg: JSON.parse(d) })) });
                  // simpler path: store clientId mapping
                }
              };
              // Use a thin adapter per clientId
              handleRelayClient(ws, clientId, inner);
            } else {
              handleRelayClient(ws, clientId, inner, msg.playerId);
            }
          }
        } catch (e) {
          console.warn('relay msg', e);
        }
      });
      ws.on('close', () => setTimeout(connectRelay, 2000));
      ws.on('error', () => {});
    };

    const relayPlayers = new Map(); // clientId -> playerId

    function handleRelayClient(relayWs, clientId, inner, knownPlayerId) {
      const send = (playerId, m) => {
        relayWs.send(encode({ t: 'relay', toClient: clientId, playerId, msg: m }));
      };
      // temporarily override host send for this call — use dedicated createHost per... messy.
      // Inline minimal handling:
      if (inner.t === 'hello') {
        const res = g.mpHello({ token: inner.token, displayName: inner.displayName, name: inner.name, password: inner.claimPass, party: !!inner.party });
        if (res.error) {
          send(null, { t: 'error', error: res.error });
          return;
        }
        const rec = g.MP.players.get(res.playerId);
        if (rec.stashed || rec.siteId == null) g.respawnPlayer(res.playerId);
        relayPlayers.set(clientId, res.playerId);
        send(res.playerId, host.welcomePayload(res.playerId));
        send(res.playerId, host.regionSoft(res.playerId));
        return;
      }
      const playerId = knownPlayerId || relayPlayers.get(clientId);
      if (!playerId) return;
      // patch send into a one-shot host call
      const h = createHost(g, { send: (pid, m) => send(pid, m), broadcast: (m, ex) => {
        for (const [cid, pid] of relayPlayers) {
          if (pid !== ex) relayWs.send(encode({ t: 'relay', toClient: cid, playerId: pid, msg: m }));
        }
      }});
      h.onMessage(inner, { playerId });
    }

    connectRelay();
  }

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MIND//VESSEL host\n');
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => attachWs(ws, 'client'));
  server.listen(args.port, () => {
    console.log(`Host listening ws://127.0.0.1:${args.port}`);
    if (args.world) console.log('World file:', args.world);
  });

  setInterval(() => {
    host.noteMeetings();
    host.tick(0.1);
  }, 100);
  setInterval(persist, 5000);

  process.on('SIGINT', () => { persist(); process.exit(0); });
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { parseArgs, bootGame };
