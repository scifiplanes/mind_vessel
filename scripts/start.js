'use strict';
/**
 * One-command multiplayer: starts relay + host, opens the lobby in your browser.
 *   npm start
 *   npm start -- --password secret --pvp
 *
 * Cloud (Fly.io):
 *   MIND_VESSEL_CLOUD=1 PORT=8080 PUBLIC_URL=https://….fly.dev WORLD_PATH=/data/save.json
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { startTunnel, postTunnelStatus } = require('./tunnel');

const ROOT = path.resolve(__dirname, '..');
const IS_CLOUD = !!(
  process.env.MIND_VESSEL_CLOUD === '1' ||
  process.env.FLY_APP_NAME ||
  process.env.PUBLIC_URL
);
const RELAY_PORT = +(process.env.RELAY_PORT || 7474);
const HOST_PORT = +(process.env.PORT || (IS_CLOUD ? 8080 : 7777));
const RELAY = `ws://127.0.0.1:${RELAY_PORT}`;
const WORLD = process.env.WORLD_PATH || path.join(ROOT, 'worlds', 'save.json');
const PUBLIC_URL = (process.env.PUBLIC_URL ||
  (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : ''))
  .replace(/\/$/, '');
const SKIP_TUNNEL = process.env.MIND_VESSEL_NO_TUNNEL === '1' || IS_CLOUD || !!PUBLIC_URL;

function parseExtra(argv) {
  return argv.slice(2);
}

function openUrl(url) {
  if (IS_CLOUD || process.env.MIND_VESSEL_NO_OPEN === '1') return;
  const { exec } = require('child_process');
  const cmd = process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function waitHttp(url, tries = 80) {
  return new Promise(resolve => {
    let n = 0;
    const tick = () => {
      n++;
      const req = http.get(url, res => { res.resume(); resolve(true); });
      req.on('error', () => {
        if (n >= tries) resolve(false);
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function inviteFromPublic(base) {
  const url = base.replace(/\/$/, '');
  const ws = url.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  return `${url}/play?ws=${encodeURIComponent(ws)}`;
}

function main() {
  fs.mkdirSync(path.dirname(WORLD), { recursive: true });
  const extra = parseExtra(process.argv);

  console.log('');
  console.log('  MIND//VESSEL — starting a world for friends');
  console.log('  ─────────────────────────────────────────');
  if (IS_CLOUD) console.log('  Mode: cloud');
  if (PUBLIC_URL) console.log('  Public:', PUBLIC_URL);
  console.log('');

  const relay = spawn(process.execPath, [path.join(ROOT, 'relay', 'server.js'), '--port', String(RELAY_PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const hostArgs = [
    path.join(ROOT, 'server', 'host.js'),
    '--world', WORLD,
    '--port', String(HOST_PORT),
    '--relay', RELAY,
    ...extra,
  ];
  const host = spawn(process.execPath, hostArgs, {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });

  let joinCode = null;
  let tunnelChild = null;
  const onHostOut = chunk => {
    const s = String(chunk);
    process.stdout.write(s);
    const m = s.match(/Join code:\s*([A-Z0-9]+)/i) || s.match(/code["']?\s*[:=]\s*["']?([A-Z0-9]{6})/i);
    if (m) joinCode = m[1].toUpperCase();
  };
  host.stdout.on('data', onHostOut);
  host.stderr.on('data', d => process.stderr.write(d));
  relay.stdout.on('data', d => process.stdout.write(d));
  relay.stderr.on('data', d => process.stderr.write(d));

  const shutdown = () => {
    try { if (tunnelChild) tunnelChild.kill('SIGINT'); } catch (e) {}
    try { host.kill('SIGINT'); } catch (e) {}
    try { relay.kill('SIGINT'); } catch (e) {}
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  host.on('exit', code => { if (code) console.error('Host exited', code); shutdown(); });
  relay.on('exit', code => { if (code && code !== null) console.error('Relay exited', code); });

  const lobby = `http://127.0.0.1:${HOST_PORT}/`;
  waitHttp(lobby).then(async ok => {
    if (!ok) {
      console.log('Lobby did not come up — check errors above.');
      return;
    }
    console.log('');
    console.log('  Lobby:');
    console.log('   ', PUBLIC_URL || lobby);
    if (joinCode) console.log('  Join code:', joinCode);

    if (PUBLIC_URL) {
      await postTunnelStatus(HOST_PORT, PUBLIC_URL);
      const invite = inviteFromPublic(PUBLIC_URL);
      console.log('  Worldwide invite:');
      console.log('   ', invite);
      console.log('');
      return;
    }

    console.log('  Opening worldwide invite…');
    console.log('  Press Ctrl+C to stop the world.');
    console.log('');
    openUrl(lobby);

    if (SKIP_TUNNEL) {
      console.log('  (tunnel skipped)');
      return;
    }
    try {
      const { url, child } = await startTunnel(HOST_PORT, {
        onLog: c => {
          const t = String(c);
          if (/ERR|error|failed/i.test(t) && !/INF/.test(t)) process.stderr.write(t);
        },
      });
      tunnelChild = child;
      child.on('exit', () => { tunnelChild = null; });
      await postTunnelStatus(HOST_PORT, url);
      console.log('');
      console.log('  Worldwide invite (send this to friends anywhere):');
      console.log('   ', inviteFromPublic(url));
      console.log('');
    } catch (e) {
      console.log('');
      console.log('  Worldwide invite unavailable:', e.message || e);
      console.log('  Friends on your Wi‑Fi can still use the lobby invite link.');
      console.log('');
    }
  });
}

main();
