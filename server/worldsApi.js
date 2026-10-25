'use strict';
/**
 * HTTP handlers for host Region/world file management.
 * ctx: {
 *   g,                    // game (__MV_G)
 *   getWorldPath(),       // current args.world or null
 *   setWorldPath(p),      // update args.world
 *   worldsDir(),          // directory for *.json
 *   persist(),            // save active world to disk if path set
 *   playerCount(),        // connected players
 *   kickAll(reason),      // disconnect everyone
 * }
 */
const fs = require('fs');
const path = require('path');
const {
  saveWorld,
  loadWorld,
  listWorlds,
  deleteWorld,
  safeWorldName,
  worldPath,
} = require('./worldFile');

function activeName(ctx) {
  const w = ctx.getWorldPath();
  if (!w) return 'memory';
  return path.basename(w, '.json');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 65536) {
        req.destroy();
        reject(new Error('too_large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function mintFreshBlob(g) {
  if (typeof g.mintWorldBlob === 'function') return g.mintWorldBlob();
  const backup = g.saveCampaignBlob();
  g.genRegion();
  g.ensureMP();
  if (g.MpWorld) g.MpWorld.players.clear();
  const blob = g.saveCampaignBlob();
  if (blob) {
    blob.players = [];
    blob.vessel = null;
  }
  if (backup) g.loadCampaignBlob(backup);
  return blob;
}

function createWorldsApi(ctx) {
  async function handle(req, res, u) {
    const dir = ctx.worldsDir();

    if (u.pathname === '/api/worlds' && req.method === 'GET') {
      const worlds = listWorlds(dir);
      const active = activeName(ctx);
      if (active === 'memory' && !worlds.some(w => w.name === 'memory')) {
        // ephemeral — listed as synthetic entry when no file
        worlds.unshift({ name: 'memory', mtime: Date.now(), bytes: 0, ephemeral: true });
      }
      json(res, 200, { active, worlds });
      return true;
    }

    if (u.pathname === '/api/worlds' && req.method === 'POST') {
      let body;
      try {
        body = await readJson(req);
      } catch (e) {
        json(res, 400, { error: String(e.message || e) });
        return true;
      }
      let name = safeWorldName(body.name);
      if (!name) {
        name = 'region_' + Date.now().toString(36).slice(-6);
      }
      const dest = worldPath(dir, name);
      if (!dest) {
        json(res, 400, { error: 'bad_name' });
        return true;
      }
      if (fs.existsSync(dest)) {
        json(res, 409, { error: 'exists' });
        return true;
      }
      let blob;
      try {
        blob = mintFreshBlob(ctx.g);
      } catch (e) {
        json(res, 500, { error: String(e.message || e) });
        return true;
      }
      if (!blob || !blob.RG) {
        json(res, 500, { error: 'mint_failed' });
        return true;
      }
      saveWorld(dest, blob);
      json(res, 200, { ok: true, name });
      return true;
    }

    if (u.pathname === '/api/worlds/activate' && req.method === 'POST') {
      let body;
      try {
        body = await readJson(req);
      } catch (e) {
        json(res, 400, { error: String(e.message || e) });
        return true;
      }
      const name = safeWorldName(body.name);
      if (!name) {
        json(res, 400, { error: 'bad_name' });
        return true;
      }
      if (name === 'memory') {
        json(res, 400, { error: 'cannot_activate_memory' });
        return true;
      }
      const dest = worldPath(dir, name);
      if (!dest || !fs.existsSync(dest)) {
        json(res, 404, { error: 'missing' });
        return true;
      }
      try {
        ctx.persist();
      } catch (e) {
        /* keep going */
      }
      let raw;
      try {
        raw = loadWorld(dest);
      } catch (e) {
        json(res, 400, { error: 'invalid' });
        return true;
      }
      ctx.kickAll('world switched');
      if (!ctx.g.loadCampaignBlob(raw)) {
        json(res, 500, { error: 'load_failed' });
        return true;
      }
      ctx.g.ensureMP();
      ctx.setWorldPath(dest);
      json(res, 200, { ok: true, name, active: name });
      return true;
    }

    const delMatch = u.pathname.match(/^\/api\/worlds\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
      const name = safeWorldName(decodeURIComponent(delMatch[1]));
      if (!name) {
        json(res, 400, { error: 'bad_name' });
        return true;
      }
      if (name === 'memory') {
        json(res, 400, { error: 'cannot_delete_memory' });
        return true;
      }
      const isActive = activeName(ctx) === name;
      if (isActive && ctx.playerCount() > 0) {
        json(res, 403, { error: 'players_online' });
        return true;
      }
      try {
        if (isActive) {
          try {
            ctx.persist();
          } catch (e) {
            /* */
          }
        }
        deleteWorld(dir, name);
        if (isActive) {
          ctx.setWorldPath(null);
        }
        json(res, 200, { ok: true, name });
      } catch (e) {
        const err = String(e.message || e);
        json(res, err === 'missing' ? 404 : 400, { error: err });
      }
      return true;
    }

    return false;
  }

  return { handle, mintFreshBlob, activeName };
}

module.exports = { createWorldsApi, mintFreshBlob };
