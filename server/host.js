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
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');

function lanIps() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      const fam = n.family;
      if ((fam === 'IPv4' || fam === 4) && !n.internal) out.push(n.address);
    }
  }
  return out;
}
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
  // Harness boots paused for tests — the live host must run the sim
  g.paused = false;
  g.speed = g.speed || 1;
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

  function findWs(playerId) {
    const bound = sockets.get(playerId);
    if (bound && bound.readyState === WebSocket.OPEN) return bound;
    for (const [ws2, meta] of pending) {
      if ((meta.tempId === playerId || meta.playerId === playerId) && ws2.readyState === WebSocket.OPEN) return ws2;
    }
    return null;
  }

  const host = createHost(g, {
    send(playerId, msg) {
      const ws = findWs(playerId);
      if (ws) ws.send(encode(msg));
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
    pending.set(ws, { tempId, role, playerId: null });
    ws.on('message', data => {
      try {
        const msg = decode(data);
        if (msg.t === 'hello') {
          // Bind socket before welcome is sent (welcome uses playerId, not tempId)
          const id = host.onMessage(msg, {
            playerId: null,
            tempId,
            ws,
            bind(playerIdBound) {
              playerId = playerIdBound;
              sockets.set(playerIdBound, ws);
              const meta = pending.get(ws);
              if (meta) meta.playerId = playerIdBound;
            },
          });
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

  let joinCode = null;
  let publicUrl = null; // https://….trycloudflare.com (set by start.js tunnel)
  const ROOT = path.resolve(__dirname, '..');
  const lobbyHtml = fs.readFileSync(path.join(__dirname, 'lobby.html'), 'utf8');
  const gameHtmlPath = path.join(ROOT, 'mind-vessel.html');

  if (args.relay) {
    const connectRelay = () => {
      const ws = new WebSocket(args.relay);
      ws.on('open', () => {
        ws.send(encode({ t: 'host.register', password: args.password || null }));
      });
      ws.on('message', data => {
        try {
          const msg = decode(data);
          if (msg.t === 'host.registered') {
            joinCode = String(msg.code || '').toUpperCase();
            console.log('');
            console.log('  Join code:', joinCode);
            console.log('  Lobby:    http://127.0.0.1:' + args.port + '/');
            console.log('');
            return;
          }
          if (msg.t === 'client.gone') {
            const pid = relayPlayers.get(msg.clientId);
            if (pid) {
              host.onDisconnect(pid);
              relayPlayers.delete(msg.clientId);
            }
            return;
          }
          if (msg.t === 'relay' && msg.fromClient != null) {
            handleRelayClient(ws, msg.fromClient, msg.msg, msg.playerId);
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
      const h = createHost(g, {
        send: (pid, m) => send(pid, m),
        broadcast: (m, ex) => {
          for (const [cid, pid] of relayPlayers) {
            if (pid !== ex) relayWs.send(encode({ t: 'relay', toClient: cid, playerId: pid, msg: m }));
          }
        },
      });
      h.onMessage(inner, { playerId });
    }

    connectRelay();
  }

  function statusJson() {
    const mp = g.MP;
    const ips = lanIps();
    const port = args.port;
    let globalInvite = null;
    let globalWs = null;
    if (publicUrl) {
      const base = publicUrl.replace(/\/$/, '');
      globalWs = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
      globalInvite = `${base}/play?ws=${encodeURIComponent(globalWs)}`;
    }
    return {
      code: joinCode,
      relay: args.relay || null,
      hasPassword: !!args.password,
      players: mp ? mp.connected.size : 0,
      worldName: args.world ? path.basename(args.world, '.json') : 'memory',
      gameUrl: '/play',
      port,
      wsLocal: 'ws://127.0.0.1:' + port,
      wsDirect: 'ws://127.0.0.1:' + port,
      lanIps: ips,
      // Friends on the same Wi‑Fi open this (direct to host, not localhost relay)
      inviteLinks: ips.map(ip => `http://${ip}:${port}/play?ws=${encodeURIComponent('ws://' + ip + ':' + port)}`),
      playLocal: '/play?ws=' + encodeURIComponent('ws://127.0.0.1:' + port),
      publicUrl,
      globalInvite,
      globalWs,
    };
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    if (u.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(statusJson()));
      return;
    }
    if (u.pathname === '/api/tunnel' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        try {
          const j = JSON.parse(body || '{}');
          if (j.publicUrl && /^https?:\/\//i.test(j.publicUrl)) {
            publicUrl = String(j.publicUrl).replace(/\/$/, '');
            console.log('Worldwide invite:', publicUrl + '/play?ws=' + encodeURIComponent(publicUrl.replace(/^https:/i, 'wss:')));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, publicUrl }));
        } catch (e) {
          res.writeHead(400);
          res.end('bad json');
        }
      });
      return;
    }
    if (u.pathname === '/play' || u.pathname === '/mind-vessel.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(gameHtmlPath));
      return;
    }
    if (u.pathname === '/' || u.pathname === '/lobby') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(lobbyHtml);
      return;
    }
    if (u.pathname === '/PerfectDOS.ttf' && fs.existsSync(path.join(ROOT, 'PerfectDOS.ttf'))) {
      res.writeHead(200, { 'Content-Type': 'font/ttf' });
      res.end(fs.readFileSync(path.join(ROOT, 'PerfectDOS.ttf')));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => attachWs(ws, 'client'));
  server.listen(args.port, '0.0.0.0', () => {
    const ips = lanIps();
    console.log(`Host lobby http://127.0.0.1:${args.port}/`);
    console.log(`Direct WS  ws://127.0.0.1:${args.port}`);
    if (ips.length) {
      console.log('Wi‑Fi invite:', `http://${ips[0]}:${args.port}/play?ws=ws://${ips[0]}:${args.port}`);
    }
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
