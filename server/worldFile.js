'use strict';
const fs = require('fs');
const path = require('path');

const WORLD_NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

function saveWorld(file, blob) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(blob, null, 0));
  fs.renameSync(tmp, file);
}

function loadWorld(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || !raw.RG) throw new Error('invalid world file');
  return raw;
}

function safeWorldName(name) {
  const n = String(name || '').trim();
  if (!WORLD_NAME_RE.test(n)) return null;
  return n;
}

function worldPath(dir, name) {
  const n = safeWorldName(name);
  if (!n) return null;
  return path.join(dir, n + '.json');
}

/** List *.json world files in dir (basename without .json). */
function listWorlds(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    const name = ent.name.slice(0, -5);
    if (!WORLD_NAME_RE.test(name)) continue;
    const full = path.join(dir, ent.name);
    let st;
    try { st = fs.statSync(full); } catch (e) { continue; }
    out.push({ name, mtime: st.mtimeMs, bytes: st.size });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

function deleteWorld(dir, name) {
  const p = worldPath(dir, name);
  if (!p) throw new Error('bad_name');
  if (!fs.existsSync(p)) throw new Error('missing');
  fs.unlinkSync(p);
  return true;
}

/** Promote a solo campaign blob (ver 1 or vessel-only) into a ver 2 multiplayer world blob. */
function importSoloCampaign(soloBlob) {
  if (!soloBlob || !soloBlob.RG) throw new Error('invalid campaign');
  const out = JSON.parse(JSON.stringify(soloBlob));
  out.ver = 2;
  out.settings = Object.assign({ pvp: false, maxPlayers: 32, passwordHash: null, alwaysOn: false, remainsLockSec: 600, banned: [] }, out.settings || {});
  if (out.players && out.players.length) return out;
  const v = out.vessel;
  if (!v || !v.player) {
    out.players = [];
    return out;
  }
  const id = 'p1';
  const token = 't_import_' + Date.now().toString(36);
  out.players = [{
    id,
    token,
    displayName: (v.player.comp && v.player.comp.name) || 'Vessel',
    claimName: null,
    claimPass: null,
    siteId: out.RG.cur,
    stashed: true,
    lastX: v.player.x,
    lastY: v.player.y,
    party: true,
    save: v.save,
    vmem: v.vmem,
    stats: v.stats,
    vessel: v.player,
    followers: v.followers || [],
    met: [],
    crew: [],
  }];
  out.vessel = null;
  return out;
}

module.exports = {
  saveWorld,
  loadWorld,
  importSoloCampaign,
  safeWorldName,
  worldPath,
  listWorlds,
  deleteWorld,
  WORLD_NAME_RE,
};
