'use strict';
/** Ecology systems Red→Green: assembly, competency, caps, focus, clearance, LOD, boundaries */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame({ simple: true });
  assert.ok(g.RG && g.RG.sites.length, 'region');
  const s = g.RG.sites[g.RG.cur];

  // --- Slice 1: assembly field ---
  assert.equal(typeof g.bumpAssembly, 'function', 'bumpAssembly');
  s.A = 0;
  assert.equal(g.bumpAssembly(s, 2), 2);
  assert.equal(s.A, 2);
  g.bumpAssembly(s, 100);
  assert.ok(s.A <= 24, 'A clamped');
  g.bumpAssembly(s, -3);
  const afterDown = s.A;
  assert.ok(afterDown < 24);
  // verb hooks: build / salvage / leaveRemains scar
  const A0 = s.A;
  g.bumpAssembly(s, 1); // simulate craft/build hook path exists
  assert.ok(s.A > A0);
  const blob = g.saveCampaignBlob();
  assert.ok(blob && blob.RG && blob.RG.sites, 'campaign blob');
  const saved = blob.RG.sites.find(x => x.id === s.id);
  assert.ok(saved, 'site in blob');
  assert.ok('A' in saved, 'A persisted');
  assert.equal(saved.A, s.A);

  // --- Slice 2: competency ---
  assert.equal(typeof g.competency, 'function', 'competency');
  assert.equal(typeof g.hasComp, 'function', 'hasComp');
  const mold = g.competency('Moldbloom');
  assert.ok(mold.grad >= 0.5, 'flora grad high');
  assert.ok((mold.metabo || 0) < mold.grad, 'flora metabo < grad');
  const ward = g.competency('Warden');
  assert.ok(ward.nomos >= 0.5, 'warden nomos');
  const duct = g.competency('Ductrat');
  assert.ok(duct.metabo >= 0.5, 'forager metabo');
  assert.ok(g.hasComp({ comp: { species: 'Ductrat' }, role: 'forager' }, 'metabo'));

  // --- Slice 3: caps from gradients + A ---
  assert.equal(typeof g.faunaRoom, 'function', 'faunaRoom');
  // clear creatures for a clean room reading
  g.actors = g.actors.filter(a => a === g.player || !a.creature);
  s.A = 0;
  const lowA = g.faunaRoom('forager');
  s.A = 12;
  const highA = g.faunaRoom('forager');
  assert.ok(highA > lowA, 'forager room grows with A');
  s.A = 0;
  const predRoom = g.faunaRoom('predator');
  assert.ok(predRoom >= 0);

  // --- Slice 4: focus transfer ---
  assert.equal(typeof g.taxFocus, 'function', 'taxFocus');
  assert.equal(typeof g.refundFocus, 'function', 'refundFocus');
  const dst = g.player;
  dst.focus = dst.focus || { all: 0 };
  dst.focus.all = 10;
  const src = { energy: 20, maxEnergy: 100, focus: { all: 40 } };
  const taxed = g.taxFocus(src, dst, 12);
  assert.equal(taxed, 12);
  assert.ok(dst.focus.all >= 22, 'dst focus rose');
  assert.ok(src.focus.all < 40, 'src focus eased');
  const before = dst.focus.all;
  g.refundFocus(dst, 5);
  assert.ok(dst.focus.all <= before - 5 + 0.01);

  // --- Slice 5: clearance ambient ---
  assert.equal(typeof g.ambient, 'function', 'ambient');
  s.clearT = g.RG.tick + 50;
  const wardenLike = {
    comp: { species: 'Warden' },
    role: 'predator',
    creature: true,
    x: g.player.x,
    y: g.player.y,
  };
  // diet power + nomos under clearance weather
  const i = (g.player.y | 0) * g.MW + (g.player.x | 0);
  const amb = g.ambient(wardenLike, i);
  assert.ok(amb > 0, 'clearance weather feeds nomos/power bodies');

  // --- Slice 6: residue LOD ---
  assert.equal(typeof g.assemblyWake, 'function', 'assemblyWake');
  assert.equal(typeof g.assemblySleep, 'function', 'assemblySleep');
  s.A = 6;
  s.phase = 'competitive';
  const beforeActors = g.actors.length;
  // force wake by calling until true or cap (RNG inside)
  let woke = false;
  for (let k = 0; k < 40 && !woke; k++) woke = !!g.assemblyWake(s);
  assert.ok(woke, 'assemblyWake can instantiate from A>=6 + competitive');
  assert.ok(g.actors.length >= beforeActors, 'wake added actor');
  s.A = 1;
  s.phase = 'collapse';
  // tag a creature with assemb parts for sleep
  const prey = g.actors.find(a => a.creature && a !== g.player);
  if (prey) {
    prey.compVec = Object.assign({}, g.competency(prey), { assemb: 0.9 });
    g.assemblySleep(s);
  }

  // --- Slice 7: coalesce / split (bond-space) ---
  assert.equal(typeof g.coalesce, 'function', 'coalesce');
  assert.equal(typeof g.split, 'function', 'split');
  assert.equal(typeof g.splitNear, 'function', 'splitNear');
  assert.equal(typeof g.bondSpaceFor, 'function', 'bondSpaceFor');
  assert.equal(g.domBond(g.competency('Ductrat')), 'metabo', 'forager dominant metabo');
  assert.equal(g.domBond(g.competency('Moldbloom')), 'grad', 'flora dominant grad');
  assert.equal(g.domBond(g.competency('Warden')), 'nomos', 'warden dominant nomos');

  const a1 = g.spawnAt('forager', 'Ductrat');
  const a2 = g.spawnAt('forager', 'Ductrat');
  assert.ok(a1 && a2, 'spawnAt for coalesce');
  a2.x = a1.x + 1.5; a2.y = a1.y;
  a1.compVec = g.competency(a1); a2.compVec = g.competency(a2);
  assert.equal(g.bondSpaceFor(a1, a2), 'metabo');
  const merged = g.coalesce(a1, a2);
  assert.ok(merged, 'coalesce merges aligned foragers');
  assert.equal(merged.bondSpace, 'metabo', 'bondSpace tagged');
  // wrong space filter should not split
  assert.equal(g.splitNear(merged.x, merged.y, 2, ['assemb']), 0, 'assemb filter skips metabo bond');
  assert.ok(g.splitNear(merged.x, merged.y, 2, ['metabo', 'nomos']) >= 1, 'metabo filter splits');

  // mismatch: warden + ductrat should not bond
  g.RG.tick++;
  const w = g.spawnAt('predator', 'Warden');
  const d = g.spawnAt('forager', 'Ductrat');
  assert.ok(w && d);
  w.x = d.x; w.y = d.y;
  w.compVec = g.competency(w); d.compVec = g.competency(d);
  assert.equal(g.bondSpaceFor(w, d), null, 'nomos vs metabo no bond');
  assert.equal(g.coalesce(w, d), null, 'cross-dominant coalesce blocked');

  // flora–flora on grad
  g.RG.tick++;
  const f1 = g.spawnAt('plant', 'Moldbloom');
  const f2 = g.spawnAt('plant', 'Moldbloom');
  assert.ok(f1 && f2);
  f2.x = f1.x; f2.y = f1.y;
  f1.compVec = g.competency(f1); f2.compVec = g.competency(f2);
  assert.equal(g.bondSpaceFor(f1, f2), 'grad');
  const fm = g.coalesce(f1, f2);
  assert.ok(fm && fm.bondSpace === 'grad', 'flora coalesce on grad');
  assert.ok(g.splitNear(fm.x, fm.y, 2, ['auto', 'grad']) >= 1, 'chill/seal spaces split grad');

  // telegraph / inspect surfaces
  assert.equal(typeof g.assemblyFeel, 'function');
  assert.ok(/yard|residue|work|mark/i.test(g.assemblyFeel(s)), 'assemblyFeel diegetic');
  s.A = 8; s.phase = 'complex';
  assert.ok(g.describeSite(s).includes('ready to stir') || /thick|residue|remembers/i.test(g.describeSite(s)), 'site card telegraphs A');
  const d0 = g.spawnAt('forager', 'Ductrat');
  assert.ok(d0);
  d0.compVec = g.competency(d0);
  assert.ok(/channel|weather|pile|clearance|together/i.test(g.describeActor(d0)), 'actor card telegraphs habit');
  d0.fromAssembly = 1;
  assert.ok(g.describeActor(d0).includes('residue'), 'fromAssembly on card');
  assert.ok(String(g.aname(d0)).includes('residue'), 'aname telegraphs residue');

  // near-miss telegraph does not throw
  g.RG.tick++;
  const t1 = g.spawnAt('forager', 'Ductrat');
  const t2 = g.spawnAt('forager', 'Ductrat');
  assert.ok(t1 && t2);
  t2.x = t1.x + 1; t2.y = t1.y;
  t1.compVec = g.competency(t1); t2.compVec = g.competency(t2);
  g.telegraphBonds();

  console.log('PASS t7-ecology');
}

main().catch(e => {
  console.error('FAIL t7-ecology', e);
  process.exit(1);
});
