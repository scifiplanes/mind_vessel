'use strict';
/**
 * Occasional-lag / hitch profiler.
 * Times each update frame and tags which intermittent systems ran.
 */
const { loadGame } = require('../tests/harness/dom');
const fs = require('fs');
const path = require('path');

function pct(xs, p) {
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] || 0;
}
function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

async function main() {
  const g = await loadGame({ simple: false });
  g.paused = false;
  g.dlgOpen = false;
  try {
    for (const k of Object.keys(g.AUTOPAUSE || {})) g.AUTOPAUSE[k] = false;
  } catch (e) {}
  if (g.vis) for (let i = 0; i < g.vis.length; i++) g.vis[i] = 1;
  if (g.explored) for (let i = 0; i < g.explored.length; i++) if (!g.explored[i]) g.explored[i] = 1;

  // Install per-call timers (not just counts)
  g.installHitchProbes =
    g.installHitchProbes ||
    null;
  // Use harness wrappers + manual timing around known intermittent calls via re-patched update path
  if (typeof g.installLagCounters === 'function') g.installLagCounters();

  const dt = 0.05;
  const frames = [];
  const N = 800; // 40s sim
  let lastRL = 0,
    lastRE = 0,
    lastBFS = 0,
    lastThink = 0;

  // Warm
  for (let i = 0; i < 40; i++) {
    g.update(dt);
    if (g.updFx) g.updFx(dt);
  }
  g.resetLagCounters();

  for (let i = 0; i < N; i++) {
    g.resetLagCounters();
    const t0 = performance.now();
    g.update(dt);
    if (g.updFx) g.updFx(dt);
    const ms = performance.now() - t0;
    // counts are totals for this one frame (countUpdateWork averages — resetLagCounters zeros before update)
    // installLagCounters increments during update; read raw _ via count by comparing
    // Use a dedicated single-frame counter API:
    const c = g.frameCounters ? g.frameCounters() : null;
    frames.push({ i, ms, c });
  }

  // If frameCounters missing, re-run with explicit probe install via eval in game — add to harness first
  const times = frames.map((f) => f.ms);
  const spikes = frames
    .filter((f) => f.ms >= Math.max(8, pct(times, 90)))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 25);

  // Subsystem microbenches (isolated)
  const iso = {};
  const bench = (name, fn, n = 30) => {
    const s = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      fn();
      s.push(performance.now() - t0);
    }
    iso[name] = {
      mean: +mean(s).toFixed(3),
      p95: +pct(s, 95).toFixed(3),
      max: +Math.max(...s).toFixed(3),
    };
  };

  if (typeof g.rebuildEnv === 'function') bench('rebuildEnv', () => g.rebuildEnv());
  if (typeof g.renderLevel === 'function') bench('renderLevel', () => g.renderLevel(), 5);
  if (typeof g.saveCampaign === 'function') bench('saveCampaign', () => g.saveCampaign(), 5);
  if (typeof g.uiTick === 'function') bench('uiTick', () => g.uiTick(), 40);
  // regionLive via forcing regAcc — call through update with dt that triggers it
  // Direct: expose regionLive bind
  if (typeof g.regionLive === 'function') bench('regionLive', () => g.regionLive(), 20);
  else {
    // Force via many updates and capture max when counters say regionLive fired
  }

  // Deep BFS like TRAVEL/EXPLORE
  if (typeof g.bfs === 'function' && g.player) {
    const p = g.player;
    bench('bfs_lim120', () => g.bfs(p.x | 0, p.y | 0, () => false, 120), 40);
    bench('bfs_lim320', () => g.bfs(p.x | 0, p.y | 0, () => false, 320), 20);
    bench('bfs_lim900', () => g.bfs(p.x | 0, p.y | 0, () => false, 900), 10);
  }

  const out = {
    when: new Date().toISOString(),
    summary: {
      n: N,
      mean: +mean(times).toFixed(3),
      p50: +pct(times, 50).toFixed(3),
      p95: +pct(times, 95).toFixed(3),
      p99: +pct(times, 99).toFixed(3),
      max: +Math.max(...times).toFixed(3),
      spikeShare: +(frames.filter((f) => f.ms > 8).length / N).toFixed(3),
    },
    topSpikes: spikes.map((f) => ({ i: f.i, ms: +f.ms.toFixed(3), c: f.c })),
    iso,
    snap: g.snapLag(),
  };

  const outPath = path.join(__dirname, '../.preview-res/lag-hitch.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.error('Wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
