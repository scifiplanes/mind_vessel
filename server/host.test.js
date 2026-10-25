'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { loadGame } = require('../tests/harness/dom');
const { createHost } = require('./hostCore');
const { encode, decode } = require('../net/protocol');
const { createWorldsApi } = require('./worldsApi');
const { listWorlds, loadWorld } = require('./worldFile');

function mockReq(method, body) {
  const req = new EventEmitter();
  req.method = method;
  process.nextTick(() => {
    if (body != null) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  return req;
}
function mockRes() {
  const res = {
    code: 0,
    body: '',
    writeHead(c) { res.code = c; },
    end(s) { res.body = s; res.ended = true; },
  };
  return res;
}

async function main() {
  const g = await loadGame();
  g.ensureMP();
  g.worldSettings.maxPlayers = 2;

  const inbox = new Map();
  const host = createHost(g, {
    send(id, msg) {
      if (!inbox.has(id)) inbox.set(id, []);
      inbox.get(id).push(msg);
    },
  });

  const idA = host.onMessage({ t: 'hello', displayName: 'A', party: true }, { tempId: 'tmpA' });
  assert.ok(idA);
  const welA = inbox.get(idA).find(m => m.t === 'welcome');
  assert.ok(welA && welA.vessel && welA.site, 'welcome with site');
  assert.ok(welA.world && welA.world.RG && welA.world.RG.sites && welA.world.RG.sites.length, 'welcome includes host world');
  assert.ok(welA.vessel.actor, 'welcome includes full vessel actor');
  assert.equal(welA.world.RG.sites[welA.world.RG.start].name, g.RG.sites[g.RG.start].name, 'world start site matches host');

  // second player different site
  const sites = g.RG.sites;
  const other = sites.find(s => s.id !== g.MP.players.get(idA).siteId);
  const idB = host.onMessage({ t: 'hello', displayName: 'B', party: true }, { tempId: 'tmpB' });
  assert.ok(idB);
  g.leaveSiteFor(idB);
  g.enterSiteFor(idB, other.id);
  inbox.clear();

  host.onMessage({ t: 'mind.set', mind: ['flee', 'survive'] }, { playerId: idA });
  const you = inbox.get(idA).find(m => m.t === 'you.vessel');
  assert.deepStrictEqual(you.mind, ['flee', 'survive']);

  // B does not get A's site actors in region.soft
  inbox.clear();
  const soft = host.regionSoft(idB);
  assert.equal(soft.t, 'region.soft');
  const snapA = host.siteSnapshot(g.MP.players.get(idA).siteId, idA);
  const snapB = host.siteSnapshot(g.MP.players.get(idB).siteId, idB);
  assert.notEqual(snapA.siteId, snapB.siteId);
  assert.ok(!snapB.actors.some(a => a.ownerId === idA), 'B site snapshot has no A vessel');

  // full
  const idC = host.onMessage({ t: 'hello', displayName: 'C' }, { tempId: 'tmpC' });
  assert.equal(idC, null);
  const err = inbox.get('tmpC') && inbox.get('tmpC').find(m => m.t === 'error');
  assert.ok(err && err.error === 'full', 'rejects when full');

  // encode roundtrip used by ws layer
  assert.equal(decode(encode({ t: 'hello' })).t, 'hello');

  // Unpaused host tick must simulate (harness boots paused — live host clears that)
  g.paused = true;
  const tPaused = g.gameTime;
  host.tick(0.5);
  assert.equal(g.gameTime, tPaused, 'paused host does not tick');
  g.paused = false;
  const t0 = g.gameTime;
  inbox.clear();
  for (let i = 0; i < 30; i++) host.tick(0.1);
  assert.ok(g.gameTime > t0, 'unpaused host advances time');
  const youTick = [...inbox.values()].flat().find(m => m.t === 'you.vessel');
  assert.ok(youTick, 'you.vessel pushed while ticking');
  assert.ok('intent' in youTick && 'idleT' in youTick, 'you.vessel carries mind status');

  // /api/worlds CRUD + activate + delete-active-with-players refused
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-worlds-'));
  let worldPath = path.join(dir, 'alpha.json');
  let players = 1;
  const kicked = [];
  const api = createWorldsApi({
    g,
    getWorldPath: () => worldPath,
    setWorldPath: p => { worldPath = p; },
    worldsDir: () => dir,
    persist: () => {
      const blob = g.saveCampaignBlob();
      if (blob && worldPath) {
        fs.writeFileSync(worldPath, JSON.stringify(blob));
      }
    },
    playerCount: () => players,
    kickAll: reason => { kicked.push(reason); players = 0; },
  });

  // seed active file
  fs.writeFileSync(worldPath, JSON.stringify(g.saveCampaignBlob()));

  {
    const res = mockRes();
    await api.handle(mockReq('GET'), res, new URL('http://x/api/worlds'));
    assert.equal(res.code, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.active, 'alpha');
    assert.ok(j.worlds.some(w => w.name === 'alpha'), 'lists alpha');
  }
  {
    const res = mockRes();
    await api.handle(mockReq('POST', { name: 'beta' }), res, new URL('http://x/api/worlds'));
    assert.equal(res.code, 200, res.body);
    const j = JSON.parse(res.body);
    assert.equal(j.name, 'beta');
    assert.ok(fs.existsSync(path.join(dir, 'beta.json')));
    assert.ok(loadWorld(path.join(dir, 'beta.json')).RG.sites.length);
  }
  {
    players = 2;
    const res = mockRes();
    await api.handle(mockReq('DELETE'), res, new URL('http://x/api/worlds/alpha'));
    assert.equal(res.code, 403);
    assert.equal(JSON.parse(res.body).error, 'players_online');
  }
  {
    players = 0;
    const res = mockRes();
    await api.handle(mockReq('POST', { name: 'beta' }), res, new URL('http://x/api/worlds/activate'));
    assert.equal(res.code, 200, res.body);
    assert.ok(kicked.length >= 1, 'activate kicks');
    assert.equal(path.basename(worldPath), 'beta.json');
  }
  {
    players = 0;
    const res = mockRes();
    await api.handle(mockReq('DELETE'), res, new URL('http://x/api/worlds/alpha'));
    assert.equal(res.code, 200, res.body);
    assert.ok(!listWorlds(dir).some(w => w.name === 'alpha'));
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS host.test');
}

main().catch(e => {
  console.error('FAIL host.test', e);
  process.exit(1);
});
