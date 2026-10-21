'use strict';
const assert = require('assert');
const { encode, decode, validateClient, validateHost } = require('./protocol');

const m = { t: 'hello', token: 'x' };
assert.deepStrictEqual(decode(encode(m)), m);
validateClient(m);
validateHost({ t: 'welcome', playerId: 'p1' });
try { validateClient({ t: 'welcome' }); assert.fail('should throw'); } catch (e) { assert.ok(/unknown/.test(e.message)); }
console.log('PASS protocol.test');
