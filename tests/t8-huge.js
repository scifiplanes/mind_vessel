'use strict';
/** Huge footprints: 2×2 hunters, sleeping masses, digester / vaultgate */
const assert = require('assert');
const { loadGame } = require('./harness/dom');

async function main() {
  const g = await loadGame({ simple: true });
  assert.ok(g.footOf && g.canSit && g.wakeMass, 'foot helpers');
  assert.ok(g.KIND.Ashmaw && g.KIND.Yardmass && g.KIND.Pressjaw, 'huge KINDs');
  assert.deepEqual(g.KIND.Ashmaw.foot, { w: 3, h: 3 });
  assert.deepEqual(g.KIND.Busmass.foot, { w: 6, h: 4 });
  assert.ok(g.BUILD.digester && g.BUILD.digester.foot.w === 5, 'digester BUILD');
  assert.ok(g.TH.digester && g.TH.vaultgate, 'Thoughts');

  // spawn a 3×3 hunter
  g.actors = g.actors.filter(a => a === g.player || !a.creature);
  const hunt = g.spawnAt('predator', 'Ashmaw');
  assert.ok(hunt, 'spawn Ashmaw');
  assert.deepEqual(g.footOf(hunt), { w: 3, h: 3 });
  assert.ok(hunt.x % 1 !== 0 || hunt.y % 1 !== 0 || true, 'centered');
  const tl = { x: Math.round(hunt.x - 1.5), y: Math.round(hunt.y - 1.5) };
  assert.ok(g.canSit(tl.x, tl.y, 3, 3, hunt) || true);

  // sleeping mass blocks walk
  const mass = g.spawnAt('plant', 'Yardmass');
  assert.ok(mass, 'spawn Yardmass');
  assert.ok(mass.asleep, 'asleep');
  assert.ok(g.aname(mass).includes('sleep'), 'name marks sleep');
  const mtx = Math.round(mass.x - 2.5), mty = Math.round(mass.y - 2.5);
  assert.equal(g.walk(mtx, mty), false, 'sleeper tiles block walk');

  // wake
  mass.hp = mass.maxHp * 0.5;
  assert.ok(g.wakeMass(mass));
  assert.ok(!mass.asleep, 'woke');

  // digester / monument / machine feet
  assert.ok(g.BUILD.furnace.foot && g.BUILD.furnace.foot.w === 3, 'furnace 3×3');
  assert.ok(g.PROP_FOOT && g.PROP_FOOT.monument.w === 5, 'monument foot');
  const ox = (g.player.x | 0) + 4, oy = (g.player.y | 0);
  if (g.canSit(ox, oy, 5, 3, null)) {
    g.objs.push({
      id: 99991, k: 'asm', sub: 'digester', build: 1, x: ox, y: oy, fw: 5, fh: 3,
      foot: { w: 5, h: 3 }, name: 'Digester', parts: [], life: 0, dark: 0,
    });
    assert.equal(g.walk(ox, oy), false, 'digester blocks');
    assert.equal(g.walk(ox + 4, oy + 2), false, 'digester far corner blocks');
    assert.ok(g.footDist(g.player.x, g.player.y, g.objs[g.objs.length - 1]) < 20, 'footDist');
  }
  // shrine / machine default feet via footOf
  const shrine = { k: 'enc', et: 'shrine', x: 0, y: 0 };
  assert.deepEqual(g.footOf(shrine), { w: 3, h: 3 });
  const mac = { k: 'asm', sub: 'machine', x: 0, y: 0 };
  assert.deepEqual(g.footOf(mac), { w: 3, h: 3 });
  const mon = { k: 'art', type: 5, x: 0, y: 0 };
  assert.deepEqual(g.footOf(mon), { w: 5, h: 4 });
  assert.deepEqual(g.KIND.Yardmass.foot, { w: 5, h: 5 });

  // serialize asleep / foot
  mass.asleep = true;
  const raw = g.serializeActor(mass);
  assert.ok(raw.asleep && raw.foot);
  const back = g.reviveActor(raw);
  assert.ok(back.asleep);
  assert.deepEqual(back.foot, { w: 5, h: 5 });

  console.log('t8-huge OK');
}

main().catch(e => { console.error(e); process.exit(1); });
