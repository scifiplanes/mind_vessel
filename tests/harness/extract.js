'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const HTML = path.join(ROOT, 'mind-vessel.html');
const OUT = path.join(ROOT, 'sim', 'game.js');

function extract() {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/<script>\n([\s\S]*)\n<\/script>/);
  if (!m) throw new Error('no <script> block in mind-vessel.html');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, m[1]);
  return OUT;
}

if (require.main === module) {
  const out = extract();
  console.log('extracted', out);
}

module.exports = { extract, OUT, HTML, ROOT };
