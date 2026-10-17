'use client';

import { useState } from 'react';
import type { DateData, DestinationData, FlightLeg, FlightOffer } from '@/lib/shared';
import { addDays, clockLabel, destAirports, isoDay, money, parseDay, pickOf, rangeLabel } from '@/lib/shared';
import { api, firstName } from '@/lib/client';
import { Callout, Chip, useTrip } from '../ui';
import { manualFlightSheet, meSheet } from '../sheets';

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
  const airports = dest.option ? destAirports(dest.option.data) : [];
  const to = airports.includes(toPick) ? toPick : airports[0] || '';
  const ready = date.option && to && me.airport;
  const outDate = date.option?.data.start;
  const backDate = outDate ? isoDay(addDays(parseDay(outDate), state.trip.nights)) : '';
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
      summary: `${o.airline} · ${stopsLabel(o.out)} out${o.back ? `, ${stopsLabel(o.back).toLowerCase()} back` : ''}`,
      arriveAt: o.out.arrive,
      departAt: o.back?.depart || null,
    });
    if (ok) { toast('Flight saved. Everyone can see when you land.'); setResult(null); }
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
            <div className="opt-foot">
              <button className="btn small" onClick={() => manualFlightSheet(ctx)}>Edit</button>
              <button className="btn small ghost" onClick={() => act('clear_flight')}>Clear</button>
            </div>
          </div>
        ) : (
          <p className="sub">Search from your home airport, or enter a flight you already booked so the group can see when you land.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Search</h2>{me.airport && to && <span className="sub">{me.airport} → {to}</span>}</div>
        {!me.airport && <Callout kind="warn">Add your home airport first. <button className="link-btn" onClick={() => meSheet(ctx)}>Add it</button></Callout>}
        {!date.option && <Callout kind="warn">There are no dates to search yet. Suggest some on the Vote tab.</Callout>}
        {date.option && !airports.length && <Callout kind="warn">The destination needs an airport code before flights can be searched. Add it on the Vote tab.</Callout>}
        {ready && (!date.locked || !dest.locked) && <Callout>The group hasn’t locked {!date.locked && !dest.locked ? 'the dates or destination' : !date.locked ? 'the dates' : 'the destination'} yet, so this searches the current leader. Prices are a preview.</Callout>}
        {ready && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row-title">{rangeLabel(outDate!, state.trip.nights)} · round trip, 1 adult, economy</div>
            {airports.length > 1 && (
              <div className="seg" role="group" aria-label="Fly into">
                {airports.map((a) => <button key={a} type="button" aria-pressed={a === to} onClick={() => { setToPick(a); setResult(null); }}>{a}</button>)}
              </div>
            )}
            <button className="btn primary block" onClick={search} disabled={busy}>{busy ? <><span className="spinner" /> Searching airlines…</> : 'Search flights'}</button>
            <div className="btn-row">
              <a className="btn small" href={gflights} target="_blank" rel="noopener noreferrer">Compare on Google Flights</a>
              <button className="btn small ghost" onClick={() => manualFlightSheet(ctx)}>Enter a flight myself</button>
              <button className="btn small ghost" onClick={async () => { if (await act('set_flight', { price: 0, summary: 'Driving' })) toast('Saved: you’re driving'); }}>I’m driving</button>
            </div>
            {busy && <p className="hint">This can take up to 20 seconds while airlines respond.</p>}
          </div>
        )}
        {err && <Callout kind="bad">{err}</Callout>}
        {result && (
          <>
            {result.testMode && <Callout>Test mode: these are sample airlines from Duffel, not real fares. Switch to a live Duffel token for real prices.</Callout>}
            {result.offers.length === 0 && <Callout kind="warn">No flights came back for these dates. Try Google Flights or enter one yourself.</Callout>}
            <div className="list">
              {result.offers.map((o) => (
                <div className="row" key={o.id} style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="row-title">{o.airline}</div>
                    <div className="row-meta">Out: {clockLabel(o.out.depart)} → lands {clockLabel(o.out.arrive, false)} · {stopsLabel(o.out)}</div>
                    {o.back && <div className="row-meta">Back: {clockLabel(o.back.depart)} → {clockLabel(o.back.arrive, false)} · {stopsLabel(o.back)}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="fee">{o.currency === 'USD' ? money(o.price) : `${Math.round(o.price)} ${o.currency}`}</div>
                    <button className="btn small primary" onClick={() => pick(o)}>Pick</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="hint">Picking saves the flight to the trip so everyone sees your arrival. You still book it with the airline.</p>
          </>
        )}
      </section>

      <section className="section">
        <h2>The group</h2>
        <div className="list">
          {state.members.slice().sort((a, b) => (a.flight_arrive_at || 'z').localeCompare(b.flight_arrive_at || 'z')).map((m) => (
            <div className="row" key={m.id}>
              <div className="grow">
                <div className="row-title">{m.name}{m.id === me.id && <span className="row-meta"> (you)</span>}</div>
                <div className="row-meta">{m.flight_summary || (m.airport ? `From ${m.airport}` : 'No airport yet')}</div>
              </div>
              {m.flight_arrive_at ? <Chip kind="good">Lands {clockLabel(m.flight_arrive_at)}</Chip>
                : m.flight_price !== null ? <Chip kind="good">{m.flight_summary === 'Driving' ? 'Driving' : 'Flight set'}</Chip>
                : <Chip kind="plain">No flight yet</Chip>}
            </div>
          ))}
        </div>
        <p className="hint">{state.members.filter((m) => m.flight_price === null).map((m) => firstName(m.name)).join(', ') || 'Everyone'}{state.members.some((m) => m.flight_price === null) ? ' still need to pick a flight.' : ' has a flight.'}</p>
      </section>
    </>
  );
}
