'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const tests = fs.readdirSync(dir).filter(f => /^t\d[\w-]*\.js$/.test(f)).sort();
let pass = 0, fail = 0;
for (const t of tests) {
  const r = spawnSync(process.execPath, [path.join(dir, t)], { stdio: 'inherit', cwd: path.join(dir, '..') });
  if (r.status === 0) pass++;
  else fail++;
}
// also run server/relay unit tests if present
const extras = [
  'server/worldFile.test.js',
  'server/host.test.js',
  'relay/relay.test.js',
  'net/protocol.test.js',
].filter(p => fs.existsSync(path.join(dir, '..', p)));
for (const p of extras) {
  const r = spawnSync(process.execPath, [path.join(dir, '..', p)], { stdio: 'inherit', cwd: path.join(dir, '..') });
  if (r.status === 0) pass++;
  else fail++;
}
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
