'use strict';
/**
 * Expose local host port via Cloudflare quick tunnel (no account).
 * Downloads cloudflared once into tools/bin if needed.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { createWriteStream } = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'tools', 'bin');
const BIN = path.join(BIN_DIR, 'cloudflared');

function which(cmd) {
  try {
    return execSync(`command -v ${cmd}`, { encoding: 'utf8' }).trim() || null;
  } catch (e) {
    return null;
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const get = (u, redirects = 0) => {
      if (redirects > 8) return reject(new Error('too many redirects'));
      const lib = u.startsWith('https') ? https : http;
      lib.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('download failed: HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', reject);
    };
    get(url);
  });
}

async function ensureCloudflared() {
  const fromPath = which('cloudflared');
  if (fromPath) return fromPath;
  if (fs.existsSync(BIN)) return BIN;

  fs.mkdirSync(BIN_DIR, { recursive: true });
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    throw new Error('Global invite tunnel is only auto-set up on macOS/Linux');
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  console.log('  Downloading cloudflared (one-time, for worldwide invites)…');

  if (process.platform === 'darwin') {
    const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${arch}.tgz`;
    const tgz = path.join(BIN_DIR, 'cloudflared.tgz');
    await download(url, tgz);
    execSync(`tar -xzf "${tgz}" -C "${BIN_DIR}"`, { stdio: 'ignore' });
    fs.unlinkSync(tgz);
    const extracted = path.join(BIN_DIR, 'cloudflared');
    if (!fs.existsSync(extracted)) throw new Error('cloudflared missing from archive');
    fs.chmodSync(extracted, 0o755);
    return extracted;
  }

  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  const tmp = BIN + '.download';
  await download(url, tmp);
  fs.renameSync(tmp, BIN);
  fs.chmodSync(BIN, 0o755);
  return BIN;
}

function parseTunnelUrl(chunk) {
  const s = String(chunk);
  const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return m ? m[0].replace(/\/$/, '') : null;
}

/**
 * Start a quick tunnel to http://127.0.0.1:port.
 * Resolves with { url, child } when the public https URL appears.
 */
async function startTunnel(port, opts = {}) {
  const bin = await ensureCloudflared();
  const local = `http://127.0.0.1:${port}`;
  const child = spawn(bin, ['tunnel', '--url', local, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('tunnel timed out waiting for public URL'));
      }
    }, opts.timeoutMs || 45000);

    const onData = chunk => {
      if (opts.onLog) opts.onLog(chunk);
      const url = parseTunnelUrl(chunk);
      if (url && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ url, child });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', err => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on('exit', code => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('cloudflared exited early (' + code + ')'));
      }
    });
  });
}

function postTunnelStatus(port, publicUrl) {
  const body = JSON.stringify({ publicUrl });
  return new Promise(resolve => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/tunnel',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

module.exports = { ensureCloudflared, startTunnel, parseTunnelUrl, postTunnelStatus, BIN };

if (require.main === module) {
  const port = +(process.argv[2] || 7777);
  startTunnel(port, { onLog: c => process.stderr.write(c) })
    .then(({ url, child }) => {
      console.log('PUBLIC', url);
      postTunnelStatus(port, url).then(() => {});
      child.on('exit', () => process.exit(0));
    })
    .catch(e => {
      console.error(e.message || e);
      process.exit(1);
    });
}
