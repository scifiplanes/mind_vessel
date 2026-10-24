'use strict';
/** Short softlock playtest — keeps CI honest without a long soak. */
const assert = require('assert');
const { runSuite } = require('./playtest/softlock');

async function main() {
  const r = await runSuite({
    seeds: 2,
    seconds: 40,
    mindList: ['wayfarer', 'full'],
    revisit: false,
    keepGoing: false,
    baseSeed: 0x510ce,
  });
  assert.ok(r.ok, 'softlock smoke: ' + JSON.stringify(r.failures[0] || {}, null, 2));
  console.log('PASS t13-playtest-smoke');
}

main().catch(e => {
  console.error('FAIL t13-playtest-smoke', e);
  process.exit(1);
});
