'use strict';
/**
 * Authoritative host logic over an injected game handle `g` (from jsdom harness or future Node sim).
 * Transport-agnostic: call onMessage / tick; use send(playerId, msg) callback.
 */
const { validateClient } = require('../net/protocol');

function createHost(g, opts = {}) {
  const send = opts.send || (() => {});
  const broadcast = opts.broadcast || ((msg, except) => {
    if (!g.MP) return;
    for (const id of g.MP.connected) {
      if (id !== except) send(id, msg);
    }
  });
  const sessions = new Map(); // playerId -> meta
  const lastSiteSig = new Map();
  const lastVesselSig = new Map();
  const lastMindKey = new Map();
  let vote = null;

  function siteSnapshot(siteId, forPlayerId) {
    if (!g.MP.hot.has(siteId)) return { siteId, actors: [], objs: [] };
    return g.withSite(siteId, () => {
      const actors = g.actors.filter(a => !a.dead).map(a => ({
        id: a.id,
        x: a.x,
        y: a.y,
        name: a.comp && a.comp.name,
        species: a.comp && a.comp.species,
        ownerId: a.ownerId || null,
        isVessel: !!a.isVessel,
        hp: a.hp,
        maxHp: a.maxHp,
      }));
      const objs = (g.objs || []).slice(0, 80).map(o => ({ k: o.k, sub: o.sub, x: o.x, y: o.y }));
      return { siteId, actors, objs, tick: g.RG.tick, gameTime: g.gameTime };
    });
  }

  function siteSig(snap) {
    let s = snap.siteId + '@' + snap.tick + '#' + (snap.gameTime | 0) + '|';
    for (const a of snap.actors) s += a.id + ':' + (a.x * 10 | 0) + ',' + (a.y * 10 | 0) + ',' + (a.hp | 0) + ';';
    for (const o of snap.objs) s += (o.k || '') + (o.sub || '') + (o.x | 0) + ',' + (o.y | 0) + ';';
    return s;
  }

  function clearNetCache(playerId) {
    lastSiteSig.delete(playerId);
    lastVesselSig.delete(playerId);
    lastMindKey.delete(playerId);
  }

  function regionSoft(viewerId) {
    const presence = g.partyPresence(viewerId);
    return {
      t: 'region.soft',
      tick: g.RG.tick,
      news: (g.RG.news || []).slice(-8),
      presence,
      sites: g.RG.sites.map(s => ({ id: s.id, name: s.name, heardOf: !!s.heardOf, visited: !!s.visited, marked: !!s.marked, pulseT: s.pulseT || 0 })),
    };
  }

  function worldForClient() {
    if (typeof g.saveCampaignBlob !== 'function') return null;
    const blob = g.saveCampaignBlob({ slim: true });
    if (!blob || !blob.RG) return null;
    // Region + clocks only — each client keeps its own vessel from welcome.vessel
    return {
      ver: blob.ver || 2,
      RG: blob.RG,
      cyc: blob.cyc,
      newsId: blob.newsId,
      nextId: blob.nextId,
      gameTime: blob.gameTime,
      settings: {
        pvp: !!g.worldSettings.pvp,
        maxPlayers: g.worldSettings.maxPlayers,
        alwaysOn: !!g.worldSettings.alwaysOn,
      },
    };
  }

  function welcomePayload(playerId) {
    const rec = g.MP.players.get(playerId);
    const vesselActor = typeof g.serializeActor === 'function' ? g.serializeActor(rec.vessel) : null;
    return {
      t: 'welcome',
      playerId,
      token: rec.token,
      vessel: {
        id: rec.vessel.id,
        mind: rec.vessel.mind.slice(),
        name: rec.displayName,
        lib: rec.save.lib.slice(),
        actor: vesselActor,
        vmem: typeof g.serializeVmem === 'function' ? g.serializeVmem(rec.vmem) : null,
        src: rec.save.src ? Object.assign({}, rec.save.src) : {},
        best: rec.save.best || 1,
      },
      site: rec.siteId != null ? siteSnapshot(rec.siteId, playerId) : null,
      world: worldForClient(),
      settings: { pvp: !!g.worldSettings.pvp, maxPlayers: g.worldSettings.maxPlayers },
      party: g.partyPresence(playerId),
    };
  }

  function onMessage(raw, ctx = {}) {
    const msg = validateClient(typeof raw === 'string' ? JSON.parse(raw) : raw);
    if (msg.t === 'hello') {
      if (g.worldSettings.passwordHash && msg.password !== g.worldSettings.passwordHash && msg.password !== g.worldSettings.password) {
        send(ctx.tempId || '?', { t: 'error', error: 'bad_password' });
        return null;
      }
      const res = g.mpHello({
        token: msg.token,
        displayName: msg.displayName,
        name: msg.name,
        password: msg.claimPass || msg.password,
        party: !!msg.party,
      });
      if (res.error) {
        send(ctx.tempId || '?', { t: 'error', error: res.error });
        return null;
      }
      const rec = g.MP.players.get(res.playerId);
      if (rec.stashed || rec.siteId == null) {
        g.respawnPlayer(res.playerId);
      } else if (!g.MP.hot.has(rec.siteId)) {
        g.enterSiteFor(res.playerId, rec.siteId);
      }
      sessions.set(res.playerId, { ws: ctx.ws });
      // Bind transport before welcome — otherwise send(playerId) misses the still-pending socket
      if (typeof ctx.bind === 'function') ctx.bind(res.playerId);
      const deliverTo = res.playerId;
      clearNetCache(deliverTo);
      send(deliverTo, welcomePayload(res.playerId));
      send(deliverTo, regionSoft(res.playerId));
      return res.playerId;
    }

    const playerId = ctx.playerId;
    if (!playerId || !g.MP.players.has(playerId)) {
      send(ctx.tempId || '?', { t: 'error', error: 'not_joined' });
      return null;
    }

    if (msg.t === 'mind.set') {
      g.setPlayerMind(playerId, msg.mind);
      lastMindKey.delete(playerId);
      lastVesselSig.delete(playerId);
      send(playerId, { t: 'you.vessel', mind: g.MP.players.get(playerId).vessel.mind.slice() });
      return playerId;
    }

    if (msg.t === 'vote') {
      handleVote(playerId, msg);
      return playerId;
    }

    if (msg.t === 'signal') {
      handleSignal(playerId, msg);
      return playerId;
    }

    if (msg.t === 'abandon') {
      const rec = g.MP.players.get(playerId);
      if (rec && rec.siteId != null) {
        g.withSite(rec.siteId, () => {
          g.bindPlayerView && g.bindPlayerView(rec);
          // leave remains via existing helper if available
          try { g.window && g.window.eval('leaveRemains(player)'); } catch (e) {}
        });
      }
      g.despawnPlayer(playerId);
      const neu = g.mpHello({ displayName: rec.displayName });
      // replace: copy token onto new? simpler: kick and ask rehello — for abandon create new vessel under same id
      // Minimal: respawn fresh vessel at start
      g.MP.players.delete(neu.playerId);
      rec.vessel = neu && g.MP.players.get(neu.playerId) ? null : rec.vessel;
      send(playerId, { t: 'kick', reason: 'abandon_rejoin' });
      return playerId;
    }

    if (msg.t === 'crew') {
      const rec = g.MP.players.get(playerId);
      const other = g.MP.players.get(msg.otherId);
      if (rec && other) {
        rec.crew.add(msg.otherId);
        other.crew.add(playerId);
        rec.met.add(msg.otherId);
        other.met.add(playerId);
        send(playerId, { t: 'party', party: g.partyPresence(playerId) });
        send(msg.otherId, { t: 'party', party: g.partyPresence(msg.otherId) });
      }
      return playerId;
    }

    if (msg.t === 'claim') {
      const rec = g.MP.players.get(playerId);
      if (rec && msg.name && msg.password) {
        rec.claimName = String(msg.name);
        rec.claimPass = String(msg.password);
      }
      return playerId;
    }

    return playerId;
  }

  function handleVote(playerId, msg) {
    const connected = [...g.MP.connected];
    if (msg.force && playerId === g.MP.hostPlayerId) {
      applyVote(msg.action, msg.speed);
      vote = null;
      broadcast({ t: 'vote.state', active: false, paused: g.paused, speed: g.speed, forced: true });
      return;
    }
    if (!vote || vote.action !== msg.action) {
      vote = { action: msg.action, speed: msg.speed, yes: new Set([playerId]), ends: Date.now() + 15000 };
    } else {
      vote.yes.add(playerId);
    }
    const need = Math.floor(connected.length / 2) + 1;
    broadcast({ t: 'vote.state', active: true, action: vote.action, speed: vote.speed, yes: [...vote.yes], need, paused: g.paused, speedCur: g.speed });
    if (vote.yes.size >= need) {
      applyVote(vote.action, vote.speed);
      vote = null;
      broadcast({ t: 'vote.state', active: false, paused: g.paused, speed: g.speed });
    }
  }

  function applyVote(action, spd) {
    if (action === 'pause') g.paused = true;
    if (action === 'resume') g.paused = false;
    if (action === 'speed' && (spd === 1 || spd === 2 || spd === 4)) g.speed = spd;
  }

  function handleSignal(playerId, msg) {
    const rec = g.MP.players.get(playerId);
    if (!rec || rec.siteId == null) return;
    const text = String(msg.text || msg.code || '...').slice(0, 48);
    const targets = [];
    for (const p of g.MP.players.values()) {
      if (p.id === playerId || p.stashed) continue;
      const sameSite = p.siteId === rec.siteId;
      const party = g.partyPresence(playerId).some(x => x.id === p.id);
      if (sameSite || party) {
        targets.push(p.id);
        send(p.id, { t: 'signal.fx', from: playerId, name: rec.displayName, text, siteId: rec.siteId });
      }
    }
    send(playerId, { t: 'signal.fx', from: playerId, name: rec.displayName, text, siteId: rec.siteId, self: true, to: targets });
  }

  function onDisconnect(playerId) {
    if (!playerId) return;
    g.despawnPlayer(playerId);
    sessions.delete(playerId);
    clearNetCache(playerId);
  }

  function tick(dt) {
    if (g.paused) return;
    const n = g.speed || 1;
    for (let i = 0; i < n; i++) g.hostTick(dt);
    // one snapshot per hot site; skip unchanged site/vessel payloads
    const sitePacks = new Map();
    for (const playerId of g.MP.connected) {
      const rec = g.MP.players.get(playerId);
      if (!rec || rec.stashed || rec.siteId == null) continue;
      let pack = sitePacks.get(rec.siteId);
      if (!pack) {
        const snap = siteSnapshot(rec.siteId, playerId);
        pack = { snap, sig: siteSig(snap) };
        sitePacks.set(rec.siteId, pack);
      }
      if (lastSiteSig.get(playerId) !== pack.sig) {
        lastSiteSig.set(playerId, pack.sig);
        send(playerId, { t: 'site.delta', ...pack.snap });
      }
      const v = rec.vessel;
      const it = v.intent;
      const mindKey = v.mind.join('\0');
      const vesselSig = (v.x * 10 | 0) + ',' + (v.y * 10 | 0) + ',' + (v.hp | 0) + ',' + (v.energy | 0) + ','
        + ((v.idleT || 0) | 0) + '|' + mindKey + '|' + (it ? it.v + ':' + (it.lab || '') + ':' + (it.th || '') : '')
        + '|' + (v.busy ? v.busy.type : '') + '|' + ((v.focus && v.focus.all) | 0);
      if (lastVesselSig.get(playerId) === vesselSig) continue;
      lastVesselSig.set(playerId, vesselSig);
      const out = {
        t: 'you.vessel',
        x: v.x,
        y: v.y,
        hp: v.hp,
        energy: v.energy,
        idleT: v.idleT || 0,
        intent: it ? { v: it.v, lab: it.lab || '', th: it.th || null } : null,
        busy: v.busy ? { type: v.busy.type } : null,
        focus: v.focus ? { all: v.focus.all || 0 } : null,
      };
      if (lastMindKey.get(playerId) !== mindKey) {
        lastMindKey.set(playerId, mindKey);
        out.mind = v.mind.slice();
      }
      send(playerId, out);
    }
  }

  function kick(playerId, ban) {
    send(playerId, { t: 'kick', reason: ban ? 'banned' : 'kicked' });
    if (ban) {
      const rec = g.MP.players.get(playerId);
      if (rec) {
        g.MP.banned.add(rec.token);
        if (rec.claimName) g.MP.banned.add(rec.claimName);
      }
      g.mpBan && g.mpBan(playerId);
    }
    g.despawnPlayer(playerId);
    sessions.delete(playerId);
    clearNetCache(playerId);
  }

  // meet when same site
  function noteMeetings() {
    const bySite = new Map();
    for (const p of g.MP.players.values()) {
      if (p.stashed || p.siteId == null) continue;
      if (!bySite.has(p.siteId)) bySite.set(p.siteId, []);
      bySite.get(p.siteId).push(p);
    }
    for (const group of bySite.values()) {
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        group[i].met.add(group[j].id);
        group[j].met.add(group[i].id);
      }
    }
  }

  return { onMessage, onDisconnect, tick, kick, welcomePayload, worldForClient, siteSnapshot, regionSoft, noteMeetings, sessions, getVote: () => vote };
}

module.exports = { createHost };
