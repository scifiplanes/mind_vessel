'use strict';
/**
 * One-command multiplayer: starts relay + host, opens the lobby in your browser.
 *   npm start
 *   npm start -- --password secret --pvp
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const RELAY_PORT = 7474;
const HOST_PORT = 7777;
const RELAY = `ws://127.0.0.1:${RELAY_PORT}`;
const WORLD = path.join(ROOT, 'worlds', 'save.json');

function parseExtra(argv) {
  // forward unknown flags to host
  return argv.slice(2);
}

function openUrl(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function waitHttp(url, tries = 40) {
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

function main() {
  fs.mkdirSync(path.dirname(WORLD), { recursive: true });
  const extra = parseExtra(process.argv);

  console.log('');
  console.log('  MIND//VESSEL — starting a world for friends');
  console.log('  ─────────────────────────────────────────');
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
    try { host.kill('SIGINT'); } catch (e) {}
    try { relay.kill('SIGINT'); } catch (e) {}
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  host.on('exit', code => { if (code) console.error('Host exited', code); shutdown(); });
  relay.on('exit', code => { if (code && code !== null) console.error('Relay exited', code); });

  const lobby = `http://127.0.0.1:${HOST_PORT}/`;
  waitHttp(lobby).then(ok => {
    if (!ok) {
      console.log('Lobby did not come up — check errors above.');
      return;
    }
    console.log('');
    console.log('  Lobby open in your browser:');
    console.log('   ', lobby);
    if (joinCode) console.log('  Join code:', joinCode);
    console.log('  Share the code (and password, if any) with friends.');
    console.log('  Press Ctrl+C to stop the world.');
    console.log('');
    openUrl(lobby);
  });
}

main();
