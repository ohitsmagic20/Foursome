// Turn rates.txt into src/data/rates.json: per package id, any of price, shape, includes, url, source, note.
// Empty fields leave the package as it is. Run: node data-sources/build-rates.js
const fs = require('fs'), path = require('path');
const out = {};
for (const line of fs.readFileSync(path.join(__dirname, 'rates.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const p = line.split('|');
  if (p.length !== 7) { console.error('bad line', p.length, line); process.exitCode = 1; continue; }
  const [id, from, basis, shape, includes, url, note] = p.map((s) => s.trim());
  const o = {};
  if (Number(from) > 0) {
    const n = Number(from);
    o.price = basis === 'night' ? { from: n, per: 'person per night' }
      : basis === 'trip' ? { from: n, per: 'golfer per trip' }
      : basis === 'golf-only' ? { from: n, per: 'golfer per trip', note: 'Golf only; lodging is priced separately.' }
      : basis === 'room-night' ? { from: n, per: 'as listed', note: 'Per room per night.' }
      : { from: n, per: 'as listed' };
  }
  if (shape) o.shape = shape;
  if (includes) o.includes = includes;
  if (url) { o.url = url; o.source = new URL(url).hostname.replace(/^www\./, ''); }
  if (note) o.detail = note;
  out[id] = o;
}
fs.writeFileSync(path.join(__dirname, '../src/data/rates.json'), JSON.stringify(out, null, 1));
console.log('rates', Object.keys(out).length);
