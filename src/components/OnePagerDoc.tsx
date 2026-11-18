// The trip one-pager as a PDF (react-pdf). Loaded only when someone taps the button.
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { OnePager, Status } from '@/lib/onepager';

let fontsReady = false;
export function registerFonts(origin: string) {
  if (fontsReady) return;
  fontsReady = true;
  Font.register({ family: 'Barlow', fonts: [
    { src: `${origin}/pdf-fonts/barlow-condensed-latin-600-normal.woff`, fontWeight: 600 },
    { src: `${origin}/pdf-fonts/barlow-condensed-latin-700-normal.woff`, fontWeight: 700 },
  ] });
  Font.register({ family: 'Instrument', fonts: [
    { src: `${origin}/pdf-fonts/instrument-sans-latin-400-normal.woff`, fontWeight: 400 },
    { src: `${origin}/pdf-fonts/instrument-sans-latin-500-normal.woff`, fontWeight: 500 },
    { src: `${origin}/pdf-fonts/instrument-sans-latin-600-normal.woff`, fontWeight: 600 },
    { src: `${origin}/pdf-fonts/instrument-sans-latin-700-normal.woff`, fontWeight: 700 },
  ] });
  Font.registerHyphenationCallback((w) => [w]);
}

// The app's light theme.
const C = { green: '#1e5a3b', ink: '#16241c', muted: '#5b6a61', line: '#dce2d8', soft: '#eef1ea', paper: '#f7f8f4', flag: '#d9a62e', flagSoft: '#f7ecd0', good: '#2c7a4b', goodSoft: '#e1f0e6', warn: '#a8691a', warnSoft: '#f6ead6' };
const DOT: Record<Status, string> = { done: C.good, voting: C.flag, todo: '#c9d0c6' };
const WORD: Record<Status, string> = { done: 'Done', voting: 'In progress', todo: 'To do' };

const s = StyleSheet.create({
  page: { fontFamily: 'Instrument', fontSize: 9, color: C.ink, backgroundColor: '#ffffff', paddingBottom: 50 },
  band: { backgroundColor: C.green, color: '#ffffff', paddingTop: 22, paddingBottom: 18, paddingHorizontal: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: C.flag, marginBottom: 4 },
  title: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 34, lineHeight: 1, color: '#ffffff' },
  subtitle: { fontSize: 10.5, marginTop: 7, color: '#e3ece6' },
  count: { alignItems: 'flex-end' },
  countBig: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 26, color: C.flag, lineHeight: 1 },
  countSmall: { fontSize: 8, color: '#cfe0d5', marginTop: 3 },
  body: { paddingHorizontal: 34, paddingTop: 13 },
  facts: { flexDirection: 'row', marginBottom: 10 },
  fact: { flex: 1, backgroundColor: C.paper, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, borderLeftWidth: 3 },
  factK: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  factV: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 17, marginTop: 3, lineHeight: 1.05 },
  factN: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  cols: { flexDirection: 'row' },
  costStrip: { flexDirection: 'row', alignItems: 'center', marginTop: -4, marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  left: { flex: 1.55, marginRight: 16 },
  right: { flex: 1 },
  h: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.6, color: C.green, marginBottom: 4, marginTop: 2 },
  hNote: { fontSize: 7.5, color: C.muted, marginTop: -3, marginBottom: 5 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8, marginBottom: 10 },
  day: { flexDirection: 'row', paddingVertical: 3.5, borderTopWidth: 1, borderTopColor: C.line },
  dayFirst: { borderTopWidth: 0, paddingTop: 0 },
  dayLabel: { width: 62, fontWeight: 700, fontSize: 8.5 },
  round: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  course: { fontWeight: 600, fontSize: 9 },
  meta: { fontSize: 7.5, color: C.muted },
  tier: { fontWeight: 700, color: C.good, fontSize: 8 },
  pill: { fontSize: 6.5, fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2.5 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  li: { flexDirection: 'row', marginBottom: 4 },
  box: { width: 9, height: 9, borderWidth: 1.2, borderColor: C.warn, borderRadius: 2, marginRight: 6, marginTop: 1 },
  crew: { flexDirection: 'row', flexWrap: 'wrap' },
  person: { width: '33.33%', flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingRight: 4 },
  hl: { backgroundColor: C.flagSoft, borderRadius: 8, padding: 8, marginBottom: 10 },
  footer: { position: 'absolute', left: 34, right: 34, bottom: 18, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
});

function Facts({ facts }: { facts: OnePager['facts'] }) {
  return (
    <View style={s.facts}>
      {facts.map((f, i) => (
        <View key={f.label} style={[s.fact, { borderLeftColor: DOT[f.status], marginRight: i === facts.length - 1 ? 0 : 8 }]}>
          <Text style={s.factK}>{f.label}</Text>
          <Text style={s.factV}>{f.value}</Text>
          <Text style={s.factN}>{f.note}</Text>
        </View>
      ))}
    </View>
  );
}

export function OnePagerDoc({ d, url, qr }: { d: OnePager; url: string; qr: string }) {
  return (
    <Document title={`${d.title} · trip one-pager`} author="Foresome" creator="Foresome">
      {/* One page: every list is capped (see buildOnePager) so a full trip still fits. */}
      <Page size="LETTER" style={s.page}>
        <View style={s.band}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={s.eyebrow}>Foresome · Trip one-pager</Text>
            <Text style={[s.title, d.title.length > 26 ? { fontSize: 26 } : {}]}>{d.title}</Text>
            <Text style={s.subtitle}>{d.subtitle}</Text>
          </View>
          {d.countdown && (
            <View style={s.count}>
              <Text style={s.countBig}>{d.countdown}</Text>
              <Text style={s.countSmall}>as of {d.asOf}</Text>
            </View>
          )}
        </View>

        <View style={s.body}>
          <Facts facts={d.facts} />
          <View style={s.costStrip}>
            <Text style={[s.factK, { marginRight: 8 }]}>Per person so far</Text>
            {d.cost.map((c) => <Text key={c.label} style={{ marginRight: 12 }}><Text style={s.meta}>{c.label} </Text><Text style={{ fontWeight: 700 }}>{c.value}</Text></Text>)}
            <Text style={[s.meta, { flex: 1, textAlign: 'right', fontSize: 7 }]}>{d.costNote || 'Averages; the stay splits by bed.'}</Text>
          </View>

          {d.highlights.length > 0 && (
            <View style={s.hl}>
              <Text style={[s.factK, { color: C.warn, marginBottom: 3 }]}>Highlights</Text>
              <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{d.highlights.join('   ·   ')}</Text>
            </View>
          )}

          <View style={s.cols}>
            <View style={s.left}>
              {d.places && (
                <>
                  <Text style={s.h}>Places on the table</Text>
                  <View style={s.card}>
                    {d.places.map((p, i) => (
                      <View key={p.name} style={[s.costRow, i ? { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 4 } : {}]}>
                        <Text style={{ fontWeight: 600 }}>{p.name}{p.leading ? '  ·  leading' : ''}</Text>
                        <Text style={s.meta}>{p.yes} in · {p.each}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.h}>The golf</Text>
              <Text style={s.hNote}>{d.daysNote}</Text>
              <View style={s.card}>
                {d.days.length === 0 && <Text style={s.meta}>Add courses on the Golf tab and they show up here.</Text>}
                {d.days.map((day, i) => (
                  <View key={day.label} style={[s.day, i === 0 ? s.dayFirst : {}]}>
                    <Text style={s.dayLabel}>{day.label}</Text>
                    <View style={{ flex: 1 }}>
                      {day.rounds.map((r, k) => (
                        <View key={k} style={s.round}>
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={s.course}>{r.course}</Text>
                            <Text style={s.meta}>{[r.time, r.booked ? 'Booked' : r.suggested ? 'Suggested' : 'Not booked yet'].filter(Boolean).join(' · ')}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {r.tier ? <Text style={s.tier}>{r.tier}<Text style={{ color: C.line }}>{'$$$'.slice(r.tier.length)}</Text></Text> : null}
                            <Text style={s.meta}>{r.fee}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <Text style={s.h}>Where we stay</Text>
              <View style={s.card}>
                {d.stay ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.course}>{d.stay.name}</Text>
                        <Text style={[s.pill, { backgroundColor: d.stay.status === 'done' ? C.goodSoft : C.flagSoft, color: d.stay.status === 'done' ? C.good : C.warn }]}>{d.stay.status === 'done' ? 'LOCKED' : 'LEADING'}</Text>
                      </View>
                      <Text style={s.meta}>{d.stay.detail}</Text>
                    </View>
                    <Text style={{ fontWeight: 700 }}>{d.stay.each}</Text>
                  </View>
                ) : <Text style={s.meta}>No houses or hotels suggested yet.</Text>}
              </View>

            </View>

            <View style={s.right}>
              <Text style={s.h}>Where things stand</Text>
              <View style={s.card}>
                {d.checklist.map((c) => (
                  <View key={c.title} style={s.row}>
                    <View style={[s.dot, { backgroundColor: DOT[c.status] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 600 }}>{c.title} <Text style={[s.meta, { fontWeight: 400 }]}>· {WORD[c.status]}</Text></Text>
                      <Text style={s.meta}>{c.note}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={s.h}>Still to work on</Text>
              <View style={[s.card, { backgroundColor: C.warnSoft, borderColor: C.warnSoft }]}>
                {d.todo.length === 0 && <Text style={{ fontWeight: 600, color: C.good }}>Nothing left. Just show up and play.</Text>}
                {d.todo.map((t) => (
                  <View key={t} style={s.li}><View style={s.box} /><Text style={{ flex: 1 }}>{t}</Text></View>
                ))}
              </View>

              {d.cup && (
                <View style={[s.card, { backgroundColor: C.flagSoft, borderColor: C.flag }]}>
                  <Text style={[s.factK, { color: C.warn }]}>{d.cup.title}</Text>
                  <Text style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{d.cup.line}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={s.h}>The crew · {d.crew.length}</Text>
            <Text style={[s.meta, { fontSize: 7 }]}>Green: flight picked.{d.crew.some((p) => p.organizer) ? ` Organizer: ${d.crew.find((p) => p.organizer)!.full}.` : ''}</Text>
          </View>
          <View style={s.card}>
            {/* One flowing line of names: it fits any crew size. Green: flight picked. */}
            <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>
              {d.crew.map((p, k) => (
                <Text key={p.full}>
                  <Text style={{ fontWeight: 700, color: p.flight ? C.good : C.ink }}>{p.name.replace(/ /g, '\u00a0')}</Text>
                  {p.from && d.crew.length <= 16 ? <Text style={s.meta}>{'\u00a0'}{p.from}</Text> : null}
                  {k < d.crew.length - 1 ? <Text style={{ color: C.line }}>{'   ·   '}</Text> : null}
                </Text>
              ))}
            </Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          {qr ? <Image src={qr} style={{ width: 34, height: 34, marginRight: 10 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700, fontSize: 9 }}>Vote, add ideas and see the latest plan</Text>
            <Link src={url} style={{ color: C.green, fontSize: 9, textDecoration: 'none' }}>{url.replace(/^https?:\/\//, '')}</Link>
          </View>
          <Text style={s.meta}>Snapshot from {d.asOf} · Foresome</Text>
        </View>
      </Page>
    </Document>
  );
}
