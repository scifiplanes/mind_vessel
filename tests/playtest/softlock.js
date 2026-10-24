'use strict';
/**
 * Softlock playtest: seed worlds × mind presets, tick the sim, fail on stuck travel/mind.
 * CLI: node tests/playtest/softlock.js [--seeds N] [--seconds S] [--minds all|core] [--json]
 */
const { loadGame } = require('../harness/dom');

const MINDS = {
  wayfarer: ['wayfarer'],
  stalker: ['stalker'],
  coward: ['coward', 'wayfarer'],
  forager: ['forager', 'wayfarer'],
  full: ['forager', 'coward', 'wayfarer', 'stalker'],
  lease: ['forager', 'coward', 'leaselife', 'wayfarer'],
};

const CORE = ['wayfarer', 'full', 'coward', 'stalker'];

function hushAutopause(g) {
  const ap = g.AUTOPAUSE;
  if (!ap) return;
  for (const k of Object.keys(ap)) ap[k] = false;
}

function bootWorld(g, seed) {
  try { g.clearCampaign(); } catch (e) {}
  g.RG = null;
  g.player = null;
  g.R = g.rngSeed(seed >>> 0);
  g.newVessel();
  g.dlgOpen = false;
  try { g.document.getElementById('dlg').hidden = true; } catch (e) {}
  g.paused = false;
  hushAutopause(g);
  g.ensureRegionConnected();
  return g.player;
}

function setMind(g, mind) {
  const p = g.player;
  p.mind = mind.slice();
  g.fitMind(p);
  p.intent = null;
  p.busy = null;
  p.exT = null;
  p.idleT = 0;
  p.bad = new Map();
}

function hasTravel(g, p) {
  return (p.mind || []).some(t => g.TH[t] && g.TH[t].v.some(v => v[0] === 'TRAVEL'));
}

function exploredOut(g, p) {
  return !g.bfs(p.x | 0, p.y | 0, i => g.unexploredFor(p, i), 900);
}

function pathableExits(g, p, lim) {
  const L = lim == null ? 1400 : lim;
  return g.exits.filter(e => g.pathToDuct(p, e, L));
}

function probe(g, hist) {
  const p = g.player;
  if (!p || p.dead) return { kind: 'dead', site: g.RG && g.RG.sites[g.RG.cur] && g.RG.sites[g.RG.cur].name };
  const site = g.RG.sites[g.RG.cur];
  g.ensureExits(site);
  const nNb = (site.nb || []).length;
  const pathable = pathableExits(g, p);
  const out = exploredOut(g, p);
  const travelMind = hasTravel(g, p);

  if (nNb > 0 && !g.exits.length && (p.siteT || 0) > 10) {
    return fail('no-exits', g, { nNb, siteT: p.siteT });
  }
  if (nNb > 0 && !pathable.length && (p.siteT || 0) > 20 && (p.idleT || 0) > 6) {
    return fail('no-pathable-duct', g, {
      nNb, nExits: g.exits.length,
      exits: g.exits.map(e => ({ to: e.to, name: g.RG.sites[e.to].name })),
      siteT: p.siteT, idleT: p.idleT,
    });
  }

  if (travelMind && out && (p.idleT || 0) > 14 && !p.intent && !p.busy) {
    const it = g.think(p);
    if (!it || it.v === 'WANDER') {
      const leave = g.VERB.TRAVEL(p, { to: 'deeper' });
      return fail('silent-mind', g, {
        think: it && { v: it.v, lab: it.lab },
        travel: leave && { to: leave.to, lab: leave.lab, act: leave.act },
        pathable: pathable.map(e => g.RG.sites[e.to].name),
        siteT: p.siteT, idleT: p.idleT, exploredOut: out,
      });
    }
  }

  if (p.intent && p.intent.v === 'TRAVEL' && p.intent.to != null) {
    const e = g.exits.find(x => x.to === p.intent.to);
    const can = e && g.pathToDuct(p, e, 1400);
    if (e && !can && pathable.some(x => x.to !== p.intent.to)) {
      hist.seekUnreach = (hist.seekUnreach || 0) + 1;
      if (hist.seekUnreach >= 12) {
        return fail('seek-unreachable', g, {
          want: g.RG.sites[p.intent.to].name,
          pathable: pathable.map(x => g.RG.sites[x.to].name),
          lab: p.intent.lab,
        });
      }
    } else hist.seekUnreach = 0;
  } else hist.seekUnreach = 0;

  // finished site, travel mind, still here too long with nothing to do
  if (travelMind && out && (p.siteT || 0) > 100 && (p.idleT || 0) > 25) {
    const leave = g.VERB.TRAVEL(p, { to: 'deeper' });
    if (!leave || leave.to == null) {
      return fail('site-stuck', g, {
        siteT: p.siteT, idleT: p.idleT,
        pathable: pathable.map(e => g.RG.sites[e.to].name),
        travel: leave,
      });
    }
  }

  // region island from current site
  if ((hist.ticks || 0) % 40 === 0) {
    const seen = new Set([g.RG.cur]);
    const q = [g.RG.cur];
    while (q.length) {
      const id = q.pop();
      for (const j of g.RG.sites[id].nb || []) if (!seen.has(j)) { seen.add(j); q.push(j); }
    }
    if (seen.size < Math.min(8, g.RG.sites.length) && g.RG.sites.length > 20) {
      return fail('region-island', g, { comp: seen.size, nSites: g.RG.sites.length });
    }
  }

  return null;
}

function fail(kind, g, extra) {
  const p = g.player;
  const site = g.RG.sites[g.RG.cur];
  return {
    kind,
    site: site && site.name,
    siteId: g.RG.cur,
    prev: g.RG.prev,
    mind: p && p.mind && p.mind.slice(),
    gameTime: g.gameTime,
    ...extra,
  };
}

function tick(g, dt) {
  g.paused = false;
  g.dlgOpen = false;
  g.update(dt);
}

/**
 * One campaign: boot seed + mind, tick for `seconds`. Same seed re-booted = same world.
 * @returns {{ok:true,visited:number}|{ok:false,fail:object}}
 */
function runCase(g, opts) {
  const { seed, mind, seconds = 90, dt = 0.25 } = opts;
  bootWorld(g, seed);
  setMind(g, mind);

  const hist = { ticks: 0, seekUnreach: 0 };
  const visited = new Set([g.RG.cur]);
  const steps = Math.ceil(seconds / dt);
  let lastSite = g.RG.cur;

  for (let i = 0; i < steps; i++) {
    tick(g, dt);
    hist.ticks++;
    if (g.RG.cur !== lastSite) {
      lastSite = g.RG.cur;
      visited.add(lastSite);
      hist.seekUnreach = 0;
    }
    if (g.player && g.player.dead) {
      g.newVessel();
      setMind(g, mind);
      hushAutopause(g);
      continue;
    }
    if (i % Math.max(1, Math.round(1 / dt)) === 0) {
      const hit = probe(g, hist);
      if (hit) {
        return {
          ok: false,
          fail: {
            ...hit,
            seed,
            mindKey: mind.join('+'),
            visited: visited.size,
            seconds: (i + 1) * dt,
          },
        };
      }
    }
  }

  if (hasTravel(g, g.player) && visited.size < 2 && seconds >= 60) {
    const out = exploredOut(g, g.player);
    g.ensureExits(g.RG.sites[g.RG.cur]);
    const pathable = pathableExits(g, g.player);
    if (out && pathable.length) {
      const leave = g.VERB.TRAVEL(g.player, { to: 'deeper' });
      if (!leave || leave.to == null) {
        return {
          ok: false,
          fail: fail('never-left', g, {
            seed,
            mindKey: mind.join('+'),
            visited: visited.size,
            pathable: pathable.map(e => g.RG.sites[e.to].name),
          }),
        };
      }
    }
  }

  return { ok: true, seed, visited: visited.size };
}

async function runSuite(opts = {}) {
  const seedsN = opts.seeds != null ? opts.seeds : 6;
  const seconds = opts.seconds != null ? opts.seconds : 75;
  const mindNames = opts.minds === 'all' ? Object.keys(MINDS) : (opts.mindList || CORE);
  const baseSeed = opts.baseSeed != null ? opts.baseSeed : 0x6d1001;
  const revisit = !!opts.revisit;
  const g = await loadGame({ simple: true });
  hushAutopause(g);

  const failures = [];
  const results = [];
  for (let s = 0; s < seedsN; s++) {
    const seed = (baseSeed + s * 9973) >>> 0;
    const passes = revisit ? 2 : 1; // second pass = same world, different vessel roll / mind stress
    for (let pass = 0; pass < passes; pass++) {
      for (const name of mindNames) {
        const mind = MINDS[name] || (Array.isArray(name) ? name : name.split('+'));
        const label = pass ? `${name}@revisit` : name;
        process.stdout.write(`  seed ${seed} mind ${label} … `);
        const r = runCase(g, { seed, mind, seconds });
        if (r.ok) {
          console.log('ok', `(sites ${r.visited})`);
          results.push({ seed, mind: label, ok: true, visited: r.visited });
        } else {
          console.log('FAIL', r.fail.kind);
          failures.push(r.fail);
          results.push({ seed, mind: label, ok: false, fail: r.fail });
          if (!opts.keepGoing) return { ok: false, failures, results };
        }
      }
    }
  }
  return { ok: failures.length === 0, failures, results };
}

function parseArgs(argv) {
  const o = { seeds: 6, seconds: 75, minds: 'core', json: false, revisit: true, keepGoing: false, baseSeed: 0x6d1001 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seeds') o.seeds = +argv[++i];
    else if (a === '--seconds') o.seconds = +argv[++i];
    else if (a === '--minds') o.minds = argv[++i];
    else if (a === '--base') o.baseSeed = +argv[++i] >>> 0;
    else if (a === '--json') o.json = true;
    else if (a === '--no-revisit') o.revisit = false;
    else if (a === '--keep-going') o.keepGoing = true;
    else if (a === '--smoke') { o.seeds = 2; o.seconds = 45; o.minds = 'core'; o.revisit = false; }
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`playtest softlock: ${opts.seeds} seeds × ${opts.minds} minds × ${opts.seconds}s${opts.revisit ? ' +revisit' : ''}`);
  const r = await runSuite(opts);
  if (opts.json) console.log(JSON.stringify(r, null, 2));
  if (!r.ok) {
    console.error('\nSOFTLOCK', JSON.stringify(r.failures[0], null, 2));
    process.exit(1);
  }
  console.log(`\nPASS playtest softlock (${r.results.length} cases)`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('FAIL playtest', e);
    process.exit(1);
  });
}

module.exports = { MINDS, CORE, runCase, runSuite, probe, bootWorld, setMind };
