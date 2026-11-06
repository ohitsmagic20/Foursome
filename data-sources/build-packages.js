// Read packages/*.txt (Resort|Package|Town|ST|courses;…|shape|price|basis|URL), geocode the town,
// write src/data/listings.json. Run from a folder where all-the-cities@3.1.0 is installed:
//   node build-packages.js data-sources/packages src/data/listings.json
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cities = require('all-the-cities').filter((r) => r.country === 'US');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(st\.?|saint) /, 'saint ').replace(/^mt\.? /, 'mount ').replace(/[^a-z ]/g, '').trim();
const idx = new Map();
for (const c of cities) for (const n of [c.name, c.altName].filter(Boolean)) { const k = `${norm(n)}|${c.adminCode}`; const prev = idx.get(k); if (!prev || prev.population < c.population) idx.set(k, c); }
const alias = require(path.join(__dirname, 'alias.json'));
const SOURCES = { 'golfpass.com': 'GolfPass' };
const sourceOf = (url) => { const h = new URL(url).hostname.replace(/^www\./, ''); return SOURCES[h] || h; };
const dir = process.argv[2], out = [], miss = [], seen = new Set();
for (const f of fs.readdirSync(dir).filter((f) => /^[A-Z]{2}\.txt$/.test(f))) {
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => l.includes('|'))) {
    const p = line.split('|').map((s) => s.trim());
    if (p.length !== 9) { console.error('bad line', f, p.length, line); continue; }
    const [resort, name, city, st, courses, shape, price, basis, url] = p;
    if (seen.has(url)) continue; seen.add(url);
    const a = alias[`${st}|${city}`];
    const [acity, ast] = a ? a.split('|') : [city, st];
    const c = idx.get(`${norm(acity)}|${ast || st}`);
    if (!c) { miss.push(`${st}|${city}`); continue; }
    const from = Number(price);
    let pr;
    if (from > 0) {
      if (basis === 'night') pr = { from, per: 'person per night' };
      else if (basis === 'trip') pr = { from, per: 'golfer per trip' };
      else if (basis === 'golf-only') pr = { from, per: 'golfer per trip', note: 'Golf only; lodging is priced separately.' };
      else if (basis === 'group-night') pr = { from, per: 'as listed', note: 'Per night for a group of four.' };
      else if (basis === 'room-night') pr = { from, per: 'as listed', note: 'Per room per night for two golfers.' };
      else pr = { from, per: 'as listed' };
    }
    out.push({
      id: 'l' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 8), resort, name, city, state: st,
      courses: courses.split(';').map((s) => s.trim()).filter(Boolean), ...(shape ? { shape } : {}), ...(pr ? { price: pr } : {}),
      url, source: sourceOf(url), lat: +c.loc.coordinates[1].toFixed(3), lon: +c.loc.coordinates[0].toFixed(3),
    });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('listings', out.length, 'priced', out.filter((x) => x.price).length, 'states', new Set(out.map((x) => x.state)).size, 'missing', miss.length);
if (miss.length) console.log([...new Set(miss)].join('\n'));
