'use client';

import { useState } from 'react';
import type { DateData, DestinationData, FlightLeg, FlightOffer } from '@/lib/shared';
import { addDays, airlineSite, andList, clockLabel, destAirports, firstTee, landsTooLate, LANDING_BUFFER_MIN, isoDay, money, parseDay, pickOf, rangeLabel, tripNights } from '@/lib/shared';
import { api, firstName } from '@/lib/client';
import { Callout, Chip, ConfLine, useTrip, type TripCtx } from '../ui';
import { manualFlightSheet, meSheet } from '../sheets';
import { RentalCars } from '../RentalCars';

interface SearchResult {
  query: { origin: string; destination: string; outDate: string; backDate: string; datesLocked: boolean; destLocked: boolean };
  offers: FlightOffer[];
  testMode: boolean;
}

const stopsLabel = (l: FlightLeg) => (l.stops === 0 ? 'Nonstop' : `${l.stops} stop${l.stops > 1 ? 's' : ''}`);

export function FlightsTab() {
  const ctx = useTrip();
  const { state, me, act, toast } = ctx;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [toPick, setToPick] = useState('');

  if (!me) return null;
  const tee = firstTee(state);
  const airports = dest.option ? destAirports(dest.option.data) : [];
  const to = airports.includes(toPick) ? toPick : airports[0] || '';
  const ready = date.option && to && me.airport;
  const outDate = date.option?.data.start;
  const backDate = outDate ? isoDay(addDays(parseDay(outDate), tripNights(state))) : '';
  const airline = airlineSite(me.flight_summary);
  const gflights = ready ? `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${me.airport} to ${to} on ${outDate} through ${backDate}`)}` : '';

  async function search() {
    setErr('');
    setBusy(true);
    setResult(null);
    try {
      setResult(await api<SearchResult>(`/api/trips/${state.trip.code}/flights`, { code: state.trip.code, body: { destination: to } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }
  async function pick(o: FlightOffer) {
    const ok = await act('set_flight', {
      price: Math.round(o.price),
      summary: `${o.airline} · ${o.out.from}→${o.out.to} · ${stopsLabel(o.out).toLowerCase()} out${o.back ? `, ${stopsLabel(o.back).toLowerCase()} back` : ''}`,
      arriveAt: o.out.arrive,
      departAt: o.back?.depart || null,
      newPick: true,
    });
    if (ok) { toast(`Picked. Book it on ${airlineSite(o.airline)?.name || 'the airline'}’s site, then tap “I booked it”.`); setResult(null); }
  }

  return (
    <>
      <section className="section">
        <h2>Your flight</h2>
        {me.flight_price !== null ? (
          <div className="card opt">
            <div className="opt-head">
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{me.flight_summary || 'Flight'}</div>
                <div className="row-meta">
                  {me.flight_arrive_at ? `Lands ${clockLabel(me.flight_arrive_at)}` : 'Arrival time not set'}
                  {me.flight_depart_at ? ` · Leaves ${clockLabel(me.flight_depart_at)}` : ''}
                </div>
              </div>
              <div className="fee">{money(me.flight_price)}<small>round trip</small></div>
            </div>
            {landsTooLate(state, me.flight_arrive_at) && tee && <Callout kind="bad">This lands too late for the {tee.time} tee time on arrival day. Allow {LANDING_BUFFER_MIN} minutes to get bags, a car and to the course.</Callout>}
            {me.flight_booked && me.flight_confirmation && <ConfLine label="Confirmation" value={me.flight_confirmation} />}
            {me.flight_summary !== 'Driving' && !me.flight_booked && (
              <p className="hint" style={{ margin: 0 }}>Book it on {airline ? `${airline.name}’s site` : 'the airline’s site'}, then tap “I booked it” so the group knows.</p>
            )}
            <div className="opt-foot">
              {me.flight_summary !== 'Driving' && !me.flight_booked && (
                <a className="btn small" href={airline?.url || gflights} target="_blank" rel="noopener noreferrer">Book on {airline?.name || 'Google Flights'} ↗</a>
              )}
              {me.flight_summary !== 'Driving' && 'flight_booked' in me && (me.flight_booked
                ? <button className="btn small booked" aria-pressed="true" onClick={() => flightBookedSheet(ctx)}>✓ Booked</button>
                : <button className="btn small primary" onClick={() => flightBookedSheet(ctx)}>I booked it</button>)}
              <button className="btn small ghost" onClick={() => manualFlightSheet(ctx)}>Edit</button>
              {!me.flight_booked && <button className="btn small ghost" onClick={() => act('clear_flight')}>Clear</button>}
            </div>
          </div>
        ) : (
          <p className="sub">No flight yet.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Search</h2>{me.airport && to && <span className="sub">{me.airport} → {to}</span>}</div>
        {!me.airport && <Callout kind="warn">Add your home airport first. <button className="link-btn" onClick={() => meSheet(ctx)}>Add it</button></Callout>}
        {!date.option && <Callout kind="warn">Add dates on the Home tab first.</Callout>}
        {date.option && !airports.length && <Callout kind="warn">The destination needs an airport. Add it on the Home tab.</Callout>}
        {ready && (!date.locked || !dest.locked) && <Callout>Not locked yet. Showing the current leader.</Callout>}
        {ready && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row-title">{rangeLabel(outDate!, tripNights(state))} · round trip, 1 adult, economy</div>
            {airports.length > 1 && (
              <div className="seg" role="group" aria-label="Fly into">
                {airports.map((a) => <button key={a} type="button" aria-pressed={a === to} onClick={() => { setToPick(a); setResult(null); }}>{a}</button>)}
              </div>
            )}
            {state.flightSearch
              ? <button className="btn primary block" onClick={search} disabled={busy}>{busy ? <><span className="spinner" /> Searching airlines…</> : 'Search flights'}</button>
              : <a className="btn primary block" href={gflights} target="_blank" rel="noopener noreferrer">Find flights on Google Flights</a>}
            <div className="btn-row">
              {state.flightSearch && <a className="btn small" href={gflights} target="_blank" rel="noopener noreferrer">Compare on Google Flights</a>}
              <button className="btn small ghost" onClick={() => manualFlightSheet(ctx)}>Enter a flight myself</button>
              <button className="btn small ghost" onClick={async () => { if (await act('set_flight', { price: 0, summary: 'Driving' })) toast('Saved: you’re driving'); }}>I’m driving</button>
            </div>
            {busy && <p className="hint">Up to 20 seconds…</p>}
          </div>
        )}
        {err && <Callout kind="bad">{err}</Callout>}
        {result && (
          <>
            {result.testMode && <Callout>Sample fares (test mode).</Callout>}
            {result.offers.length === 0 && <Callout kind="warn">No flights found. Try Google Flights.</Callout>}
            <div className="list">
              {result.offers.map((o) => (
                <div className="row" key={o.id} style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="row-title">{o.airline}</div>
                    <div className="row-meta">Out: {clockLabel(o.out.depart)} → lands {clockLabel(o.out.arrive, false)} · {stopsLabel(o.out)}</div>
                    {o.back && <div className="row-meta">Back: {clockLabel(o.back.depart)} → {clockLabel(o.back.arrive, false)} · {stopsLabel(o.back)}</div>}
                    {landsTooLate(state, o.out.arrive) && tee && <span className="late-note">Lands too late for the {tee.time} tee</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="fee">{o.currency === 'USD' ? money(o.price) : `${Math.round(o.price)} ${o.currency}`}</div>
                    <button className="btn small primary" onClick={() => pick(o)}>Pick</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="hint">Picking saves it to the trip. You book it yourself on the airline’s site; the app links you there.</p>
          </>
        )}
      </section>

      <RentalCars />

      <section className="section">
        <h2>The group</h2>
        <div className="list">
          {state.members.slice().sort((a, b) => (a.flight_arrive_at || 'z').localeCompare(b.flight_arrive_at || 'z')).map((m) => (
            <div className="row" key={m.id}>
              <div className="grow">
                <div className="row-title">{m.name}{m.id === me.id && <span className="row-meta"> (you)</span>}</div>
                <div className="row-meta">{m.flight_summary || (m.airport ? `From ${m.airport}` : 'No airport yet')}</div>
              </div>
              <div className="flight-chips">
                {m.flight_arrive_at ? <Chip kind={landsTooLate(state, m.flight_arrive_at) ? 'bad' : 'good'}>Lands {clockLabel(m.flight_arrive_at)}</Chip>
                  : m.flight_price !== null ? <Chip kind="good">{m.flight_summary === 'Driving' ? 'Driving' : 'Flight set'}</Chip>
                  : <Chip kind="plain">No flight yet</Chip>}
                {m.flight_price !== null && m.flight_summary !== 'Driving' && 'flight_booked' in m && (m.flight_booked ? <Chip kind="good">Booked</Chip> : <Chip kind="warn">Not booked</Chip>)}
              </div>
            </div>
          ))}
        </div>
        <p className="hint">{andList(state.members.filter((m) => m.flight_price === null).map((m) => firstName(m.name))) || 'Everyone'}{state.members.filter((m) => m.flight_price === null).length === 1 ? ' still needs to pick a flight.' : state.members.some((m) => m.flight_price === null) ? ' still need to pick a flight.' : ' has a flight.'}{tee ? ` First tee: ${tee.time} on arrival day.` : ''}</p>
      </section>
    </>
  );
}

/** "I booked it": the confirmation code (only you ever see it), what it really cost, and the flights. */
function FlightBookedForm({ ctx }: { ctx: TripCtx }) {
  const me = ctx.me!;
  const [conf, setConf] = useState(me.flight_confirmation && me.flight_confirmation !== '•' ? me.flight_confirmation : '');
  const [price, setPrice] = useState(me.flight_price ? String(me.flight_price) : '');
  const [summary, setSummary] = useState(me.flight_summary || '');
  const [busy, setBusy] = useState(false);
  const save = async (booked: boolean) => {
    setBusy(true);
    const ok = await ctx.act('set_flight_booked', booked ? { booked, confirmation: conf, price: Number(price) || undefined, summary } : { booked, confirmation: '' });
    setBusy(false);
    if (ok) { ctx.sheet(null); ctx.toast(booked ? 'Booked. The group can see you’re set.' : 'Marked not booked'); }
  };
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); save(true); }}>
      <div className="field">
        <label htmlFor="fb-conf">Confirmation code <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input id="fb-conf" value={conf} onChange={(e) => setConf(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" autoCapitalize="characters" placeholder="ABC123" />
        <p className="hint">Only you see it. Handy at the airport.</p>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="fb-price">What you paid ($)</label>
          <input id="fb-price" type="number" inputMode="decimal" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fb-sum">Airline and flights</label>
          <input id="fb-sum" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={160} placeholder="Delta 1423 / 1890" />
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button className="btn primary" style={{ flex: 1 }} disabled={busy}>{busy ? <span className="spinner" /> : me.flight_booked ? 'Save' : 'I booked it'}</button>
        {me.flight_booked && <button type="button" className="btn ghost" disabled={busy} onClick={() => save(false)}>Not booked</button>}
      </div>
    </form>
  );
}

function flightBookedSheet(ctx: TripCtx) {
  ctx.sheet({ title: ctx.me?.flight_booked ? 'Your flight booking' : 'You booked your flight', body: <FlightBookedForm ctx={ctx} /> });
}
