'use strict';
/**
 * Long-run lag profiler: dwell-in-site vs travel-many-sites.
 * Measures update() wall time + state growth. Draw is stubbed in jsdom (sim-side only).
 *
 * Usage: node scripts/lag-profile.js
 */
const { loadGame } = require('../tests/harness/dom');

function median(xs) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((p, q) => p - q);
  const m = (a.length / 2) | 0;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function pct(xs, p) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((p, q) => p - q);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
}

function benchUpdate(g, dt, n) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    g.update(dt);
    samples.push(performance.now() - t0);
  }
  return {
    n,
    mean: +mean(samples).toFixed(3),
    med: +median(samples).toFixed(3),
    p95: +pct(samples, 95).toFixed(3),
    max: +Math.max(...samples).toFixed(3),
  };
}

function benchSave(g) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try { g.saveCampaign(); } catch (e) {}
    samples.push(performance.now() - t0);
  }
  return { mean: +mean(samples).toFixed(2), max: +Math.max(...samples).toFixed(2) };
}

function forceVis(g) {
  // Make the whole map visible so gossip/pose/draw-side loops see everyone (worst case)
  const vis = g.vis;
  if (vis) for (let i = 0; i < vis.length; i++) vis[i] = 1;
  const ex = g.explored;
  if (ex) for (let i = 0; i < ex.length; i++) if (!ex[i]) ex[i] = 1;
}

async function scenarioDwell(g, seconds, sampleEvery) {
  const rows = [];
  g.paused = false;
  g.dlgOpen = false;
  forceVis(g);
  const dt = 0.05;
  const stepsPerSample = Math.max(1, Math.round(sampleEvery / dt));
  const totalSteps = Math.round(seconds / dt);
  let step = 0;
  while (step < totalSteps) {
    const batch = Math.min(stepsPerSample, totalSteps - step);
    for (let i = 0; i < batch; i++) g.update(dt);
    step += batch;
    const upd = benchUpdate(g, dt, 40);
    const snap = g.snapLag();
    rows.push({ at: +(step * dt).toFixed(1), kind: 'dwell', upd, save: benchSave(g), snap });
  }
  return rows;
}

async function scenarioTravel(g, hops, settleSec) {
  const rows = [];
  g.paused = false;
  g.dlgOpen = false;
  const dt = 0.05;
  const settleSteps = Math.round(settleSec / dt);
  for (let h = 0; h <= hops; h++) {
    forceVis(g);
    for (let i = 0; i < settleSteps; i++) g.update(dt);
    const upd = benchUpdate(g, dt, 40);
    const snap = g.snapLag();
    rows.push({ at: h, kind: 'travel', upd, save: benchSave(g), snap });
    if (h === hops) break;
    const exits = g.exits || [];
    const next = exits.find(e => e && e.to != null && e.to !== g.RG.cur);
    if (!next) break;
    try {
      g.travel(next.to);
    } catch (e) {
      break;
    }
  }
  return rows;
}

function delta(a, b, key) {
  return (b.snap[key] ?? 0) - (a.snap[key] ?? 0);
}

function summarize(label, rows) {
  if (rows.length < 2) return { label, error: 'too few rows' };
  const first = rows[0], last = rows[rows.length - 1];
  const keys = [
    'actors', 'liveActors', 'objs', 'parts', 'barks', 'newsWait', 'heardN', 'news',
    'scanned', 'tileFeed', 'envLights', 'dunN', 'dunCanvasN', 'dunBytes', 'vmemN',
    'logN', 'poseN', 'barkSeen', 'softTint', 'walks', 'regrow',
  ];
  const growth = {};
  for (const k of keys) growth[k] = { from: first.snap[k], to: last.snap[k], d: delta(first, last, k) };
  return {
    label,
    samples: rows.length,
    updateMs: {
      first: first.upd,
      last: last.upd,
      meanGrowth: +(last.upd.mean - first.upd.mean).toFixed(3),
      p95Growth: +(last.upd.p95 - first.upd.p95).toFixed(3),
    },
    saveMs: { first: first.save, last: last.save, growth: +(last.save.mean - first.save.mean).toFixed(2) },
    growth,
    series: rows.map(r => ({
      at: r.at,
      updMean: r.upd.mean,
      updP95: r.upd.p95,
      actors: r.snap.liveActors,
      objs: r.snap.objs,
      parts: r.snap.parts,
      dunN: r.snap.dunN,
      dunCanvasN: r.snap.dunCanvasN,
      dunKB: Math.round(r.snap.dunBytes / 1024),
      heardN: r.snap.heardN,
      envLights: r.snap.envLights,
      poseN: r.snap.poseN,
      saveMs: r.save.mean,
    })),
  };
}

function correlate(rows, xKey, yPick) {
  // Simple Pearson between snap[xKey] and upd.mean across series
  const xs = rows.map(r => (xKey in r.snap ? r.snap[xKey] : r.upd[xKey]));
  const ys = rows.map(r => yPick(r));
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den ? +(num / den).toFixed(3) : 0;
}

async function main() {
  const g = await loadGame({ simple: false });
  if (typeof g.snapLag !== 'function') throw new Error('snapLag missing — harness patch failed');

  // Quiet UI churn that isn't gameplay
  try {
    for (const k of Object.keys(g.AUTOPAUSE || {})) g.AUTOPAUSE[k] = false;
  } catch (e) {}

  console.error('Profiling dwell (180s sim)…');
  const dwell = await scenarioDwell(g, 180, 30);
  const dwellSum = summarize('dwell_180s', dwell);

  console.error('Profiling travel (12 hops × 8s settle)…');
  g.newVessel();
  g.paused = false;
  g.dlgOpen = false;
  const travel = await scenarioTravel(g, 12, 8);
  const travelSum = summarize('travel_12hops', travel);

  // Correlations (dwell): what tracks update cost?
  const corrDwell = {};
  for (const k of ['liveActors', 'objs', 'parts', 'envLights', 'poseN', 'heardN', 'news']) {
    corrDwell[k] = correlate(dwell, k, r => r.upd.mean);
  }
  const corrTravel = {};
  for (const k of ['liveActors', 'objs', 'dunN', 'dunBytes', 'visited', 'vmemN', 'poseN']) {
    // visited not in snap directly for travel series — use dunN / visited from snap
    const key = k === 'visited' ? 'visited' : k;
    corrTravel[key] = correlate(travel, key === 'visited' ? 'dunN' : key, r => r.upd.mean);
  }
  corrTravel.saveVsDunN = correlate(travel, 'dunN', r => r.save.mean);
  corrTravel.saveVsDunBytes = correlate(travel, 'dunBytes', r => r.save.mean);

  const out = {
    when: new Date().toISOString(),
    dwell: dwellSum,
    travel: travelSum,
    corrDwell,
    corrTravel,
    hypotheses: [],
  };

  // Auto-score hypotheses from numbers
  const H = out.hypotheses;
  const dUp = dwellSum.updateMs.meanGrowth;
  const tUp = travelSum.updateMs.meanGrowth;
  const dActors = dwellSum.growth.liveActors.d;
  const dObjs = dwellSum.growth.objs.d;
  const tDun = travelSum.growth.dunN.d;
  const tCanvas = travelSum.growth.dunCanvasN.d;
  const tSave = travelSum.saveMs.growth;

  H.push({
    id: 'H1_actors_dwell',
    claim: 'Live actor count grows during long dwell and drives update() cost',
    evidence: { actorDelta: dActors, updMeanGrowthMs: dUp, corrActorsUpd: corrDwell.liveActors },
    verdict: dActors > 5 && corrDwell.liveActors > 0.5 && dUp > 0.05 ? 'SUPPORTED' : dActors > 5 && dUp > 0.05 ? 'PARTIAL' : 'REJECTED',
  });
  H.push({
    id: 'H2_objs_dwell',
    claim: 'Object/corpse/item pile-up during dwell slows nearestObj / think',
    evidence: { objDelta: dObjs, corrObjsUpd: corrDwell.objs, updMeanGrowthMs: dUp },
    verdict: dObjs > 20 && corrDwell.objs > 0.5 && dUp > 0.05 ? 'SUPPORTED' : dObjs > 20 ? 'PARTIAL' : 'REJECTED',
  });
  H.push({
    id: 'H3_dun_travel_ram',
    claim: 'Travel accumulates dungeon typed-array state (dunN / dunBytes)',
    evidence: { dunNDelta: tDun, dunBytesDelta: travelSum.growth.dunBytes.d, canvasDelta: tCanvas },
    verdict: tDun > 3 ? (tCanvas > 0 ? 'SUPPORTED_WITH_CANVAS_LEAK' : 'SUPPORTED') : 'REJECTED',
  });
  H.push({
    id: 'H4_lvlCanvas_leak',
    claim: 'lvlCanvas still retained on cold sites after travel',
    evidence: { canvasFrom: travelSum.growth.dunCanvasN.from, canvasTo: travelSum.growth.dunCanvasN.to },
    verdict: travelSum.growth.dunCanvasN.to > 1 ? 'SUPPORTED' : 'REJECTED',
  });
  H.push({
    id: 'H5_save_hitch',
    claim: 'Campaign save wall time grows with visited dungeons',
    evidence: { saveGrowthMs: tSave, corrSaveDunN: corrTravel.saveVsDunN, corrSaveBytes: corrTravel.saveVsDunBytes },
    verdict: tSave > 5 && corrTravel.saveVsDunN > 0.5 ? 'SUPPORTED' : tSave > 2 ? 'PARTIAL' : 'REJECTED',
  });
  H.push({
    id: 'H6_parts_fx',
    claim: 'Particle buffer grows unboundedly over dwell',
    evidence: { partsFrom: dwellSum.growth.parts.from, partsTo: dwellSum.growth.parts.to },
    verdict: dwellSum.growth.parts.to > 1200 && dwellSum.growth.parts.d > 400 ? 'SUPPORTED' : 'REJECTED',
  });
  H.push({
    id: 'H7_news_heard',
    claim: 'News / heardN growth correlates with dwell update cost',
    evidence: { heardDelta: dwellSum.growth.heardN.d, newsDelta: dwellSum.growth.news.d, corr: corrDwell.heardN },
    verdict: dwellSum.growth.heardN.d > 50 && corrDwell.heardN > 0.5 ? 'SUPPORTED' : 'PARTIAL',
  });
  H.push({
    id: 'H8_travel_upd',
    claim: 'update() itself gets slower after many site visits (not only save)',
    evidence: { updMeanGrowthMs: tUp, corrDunUpd: corrTravel.dunN },
    verdict: tUp > 0.1 && corrTravel.dunN > 0.4 ? 'SUPPORTED' : tUp > 0.05 ? 'PARTIAL' : 'REJECTED',
  });

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '../.preview-res/lag-profile.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.error('Wrote', outPath);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
