'use strict';

const C2H = new Set(['hello', 'mind.set', 'vote', 'signal', 'abandon', 'crew', 'claim']);
const H2C = new Set(['welcome', 'site.delta', 'region.soft', 'vote.state', 'you.vessel', 'kick', 'error', 'party', 'signal.fx', 'pong']);

function encode(msg) {
  return JSON.stringify(msg);
}

function decode(raw) {
  const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
  if (!msg || typeof msg.t !== 'string') throw new Error('bad message');
  return msg;
}

function validateClient(msg) {
  if (!C2H.has(msg.t)) throw new Error('unknown client type ' + msg.t);
  return msg;
}

function validateHost(msg) {
  if (!H2C.has(msg.t)) throw new Error('unknown host type ' + msg.t);
  return msg;
}

module.exports = { encode, decode, validateClient, validateHost, C2H, H2C };
