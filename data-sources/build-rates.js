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

// typical.txt: what golfers actually paid (association trips, packagers, trip reports), one report per line.
// A key is a package id, or "@Resort name|ST" to match every package of that resort.
const rep = {};
for (const line of fs.readFileSync(path.join(__dirname, 'typical.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  let p = line.split('|').map((s) => s.trim());
  if (p[0].startsWith('@')) p = [`${p[0]}|${p[1]}`, ...p.slice(2)];
  if (p.length !== 8) { console.error('bad typical line', p.length, line.slice(0, 60)); process.exitCode = 1; continue; }
  const [id, low, high, shape, when, covers, label, url] = p;
  const r = { low: Number(low), high: Number(high), shape, when, covers, label, url };
  if (!(r.low > 0) || r.high < r.low || !/^https:/.test(url)) { console.error('bad report', line.slice(0, 60)); process.exitCode = 1; continue; }
  (rep[id] = rep[id] || []).push(r);
}
fs.writeFileSync(path.join(__dirname, '../src/data/reported.json'), JSON.stringify(rep, null, 1));
console.log('reported', Object.keys(rep).length, 'resorts,', Object.values(rep).flat().length, 'reports');
