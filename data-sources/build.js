// Read resorts/*.txt (Resort|City|courses;...), geocode city+state, write resorts.json
const fs = require('fs'), path = require('path');
const cities = require('all-the-cities').filter((r) => r.country === 'US');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(st\.?|saint) /, 'saint ').replace(/^mt\.? /, 'mount ').replace(/[^a-z ]/g, '').trim();
const idx = new Map();
for (const c of cities) for (const n of [c.name, c.altName].filter(Boolean)) { const k = `${norm(n)}|${c.adminCode}`; const prev = idx.get(k); if (!prev || prev.population < c.population) idx.set(k, c); }
const dir = process.argv[2];
const out = [], miss = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
  const st = f.replace('.txt', '');
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const [resort, city, courses] = line.split('|');
    const alias = require('./alias.json')[`${st}|${city}`];
    const [acity, ast] = alias ? alias.split('|') : [city, st];
    const c = idx.get(`${norm(acity)}|${ast || st}`);
    if (!c) miss.push(`${st}|${resort}|${city}`);
    out.push({ resort, city, state: st, courses: (courses || '').split(';').map((s) => s.trim()).filter(Boolean), lat: c ? +c.loc.coordinates[1].toFixed(3) : null, lon: c ? +c.loc.coordinates[0].toFixed(3) : null });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('resorts', out.length, 'missing', miss.length); console.log(miss.join('\n'));
