'use client';

import { useState } from 'react';
import type { Car, DateData, DestinationData, TripState } from '@/lib/shared';
import { andList, carSearchUrl, carShare, destAirports, money, pickOf, rideGroups, tripNights } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { Chip, ConfLine, ConfirmButton, Fold, useTrip, type TripCtx } from './ui';

const carIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v4.5" /><path d="M3 12h18v4.5H3z" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" />
  </svg>
);

const driving = (state: TripState) => new Set(state.members.filter((m) => m.flight_summary === 'Driving').map((m) => m.id));

/** Who a new car is probably for: the next group landing together that isn't in a car yet, else everyone flying in who isn't. */
function suggestRiders(state: TripState): string[] {
  const inCar = new Set((state.trip.cars || []).flatMap((c) => c.riders));
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const group = rideGroups(state.members, dest ? destAirports(dest.data) : []).find((g) => g.members.every((m) => !inCar.has(m.id)));
  if (group) return group.members.map((m) => m.id);
  const drives = driving(state);
  return state.members.filter((m) => !inCar.has(m.id) && !drives.has(m.id)).slice(0, 5).map((m) => m.id);
}

/** On the Flights tab: rental cars, folded away since not every trip needs one. */
export function RentalCars() {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (!me) return null;
  if (state.trip.cars === undefined && !me.is_organizer) return null; // database not updated yet
  const cars = state.trip.cars || [];
  const mine = carShare(state, me);
  const meta = cars.length
    ? `${cars.length} car${cars.length === 1 ? '' : 's'} · ${cars.some((c) => c.riders.includes(me.id)) ? `your share ${money(mine)}` : 'you’re not in one'}`
    : 'Optional. Add one if the group is renting';
  const drives = driving(state);
  const inCar = new Set(cars.flatMap((c) => c.riders));
  // Kayak at the destination airport for the trip's dates; book there, then mark it booked here.
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const ap = dest.locked && dest.option ? destAirports(dest.option.data)[0] : '';
  const search = ap && date.locked && date.option ? carSearchUrl(ap, date.option.data.start, tripNights(state)) : '';
  const without = state.members.filter((m) => !inCar.has(m.id) && !drives.has(m.id));
  return (
    <section className="section">
      <Fold title="Rental car" meta={meta} icon={carIcon}>
        {cars.length > 0 && (
          <div className="list car-list">
            {cars.map((c, i) => <CarRow key={c.id} car={c} n={i + 1} ctx={ctx} />)}
          </div>
        )}
        <div className="btn-row">
          <button className="btn" style={{ flex: 1 }} onClick={() => carSheet(ctx)}>+ Add a rental car</button>
          {search && <a className="btn" href={search} target="_blank" rel="noopener noreferrer">Search cars ↗</a>}
        </div>
        <p className="hint">
          Each car’s total splits evenly between the people in it and shows up in everyone’s cost on Home.
          {cars.length > 0 && without.length > 0 ? ` Not in a car yet: ${andList(without.map((m) => firstName(m.name)))}.` : ''}
        </p>
      </Fold>
    </section>
  );
}

function CarRow({ car, n, ctx }: { car: Car; n: number; ctx: TripCtx }) {
  const { state, me, act } = ctx;
  const name = (id: string) => { const m = state.members.find((x) => x.id === id); return m ? (m.id === me?.id ? 'You' : firstName(m.name)) : ''; };
  const riders = car.riders.filter((id) => state.members.some((m) => m.id === id));
  const canEdit = !!me && (me.is_organizer || car.by === me.id);
  const canBook = canEdit || (!!me && car.riders.includes(me.id));
  return (
    <div className="row car-row">
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row-title">{car.company || `Car ${n}`} {car.booked ? <Chip kind="good">Booked</Chip> : <Chip kind="warn">Not booked</Chip>}</div>
        <div className="row-meta">{riders.length ? andList(riders.map(name)) : 'No one in it yet'}</div>
        {car.booked && car.confirmation && <ConfLine label="Confirmation" value={car.confirmation} />}
        {(canEdit || canBook) && (
          <div className="car-actions">
            {canBook && (car.booked
              ? <button className="btn small ghost" onClick={() => act('car', { op: 'booked', id: car.id, booked: false })}>Mark not booked</button>
              : <button className="btn small primary" onClick={() => ctx.sheet({ title: `Booked ${car.company || 'the car'}`, body: <CarBookedForm ctx={ctx} car={car} /> })}>Mark booked</button>)}
            {canEdit && <button className="btn small ghost" onClick={() => carSheet(ctx, car)}>Edit</button>}
          </div>
        )}
      </div>
      <div className="fee">{money(car.total)}<small>{riders.length ? `${money(car.total / riders.length)} each` : 'total'}</small></div>
    </div>
  );
}

function CarForm({ ctx, car }: { ctx: TripCtx; car?: Car }) {
  const { state, me } = ctx;
  const [company, setCompany] = useState(car?.company || '');
  const [total, setTotal] = useState(car ? String(car.total) : '');
  const [riders, setRiders] = useState<string[]>(car?.riders || suggestRiders(state));
  const [busy, setBusy] = useState(false);
  const drives = driving(state);
  const otherCar = (id: string) => (state.trip.cars || []).find((c) => c.id !== car?.id && c.riders.includes(id));
  const nm = (id: string) => { const m = state.members.find((x) => x.id === id)!; return m.id === me?.id ? 'you' : firstName(m.name); };
  const taken = state.members.filter((m) => otherCar(m.id)).map((m) => nm(m.id));
  const drivers = state.members.filter((m) => drives.has(m.id)).map((m) => nm(m.id));
  const each = riders.length && Number(total) > 0 ? Number(total) / riders.length : 0;
  const submit = async (payload: Record<string, unknown>, msg: string) => {
    setBusy(true);
    if (await ctx.act('car', payload)) { ctx.sheet(null); ctx.toast(msg); }
    setBusy(false);
  };
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); submit({ op: 'save', id: car?.id, company, total: Number(total), riders }, car ? 'Car updated' : 'Car added'); }}>
      <div className="grid2">
        <div className="field">
          <label htmlFor="car-total">Total for the car ($)</label>
          <input id="car-total" type="number" inputMode="decimal" min={1} step="0.01" required value={total} onChange={(e) => setTotal(e.target.value)} placeholder="420" />
        </div>
        <div className="field">
          <label htmlFor="car-co">Company <span className="row-meta">(optional)</span></label>
          <input id="car-co" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Enterprise" maxLength={40} />
        </div>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>The whole rental for the trip, with taxes and fees.</p>
      <div className="field">
        <label>Who’s riding in it {each ? <span style={{ fontWeight: 500 }}>· {money(each)} each</span> : null}</label>
        <div className="split-list">
          {state.members.map((m) => {
            return (
              <label key={m.id} className="split-item">
                <input type="checkbox" checked={riders.includes(m.id)} onChange={(e) => setRiders(e.target.checked ? [...riders, m.id] : riders.filter((x) => x !== m.id))} />
                {m.id === me?.id ? 'Me' : firstName(m.name)}
              </label>
            );
          })}
        </div>
        {(taken.length > 0 || drivers.length > 0) && <p className="hint">
          {taken.length > 0 ? `Already in another car: ${andList(taken)}. Checking them moves them here. ` : ''}
          {drivers.length > 0 ? `Driving: ${andList(drivers)}.` : ''}
        </p>}
      </div>
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button className="btn primary" style={{ flex: 1 }} disabled={busy || !riders.length}>{busy ? <span className="spinner" /> : car ? 'Save' : 'Add car'}</button>
        {car && <ConfirmButton label="Remove" onConfirm={() => submit({ op: 'delete', id: car.id }, 'Car removed')} />}
      </div>
    </form>
  );
}

export function carSheet(ctx: TripCtx, car?: Car) {
  ctx.sheet({ title: car ? 'Edit rental car' : 'Add a rental car', body: <CarForm ctx={ctx} car={car} /> });
}

/** "Mark booked" for a car: the confirmation number, and what you paid (into Settle up, split between the riders). */
function CarBookedForm({ ctx, car }: { ctx: TripCtx; car: Car }) {
  const [conf, setConf] = useState('');
  const [prepaid, setPrepaid] = useState(true);
  const [paid, setPaid] = useState(String(car.total));
  const [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const ok = await ctx.act('car', { op: 'booked', id: car.id, booked: true, confirmation: conf, paid: prepaid ? Number(paid) || 0 : 0 });
      setBusy(false);
      if (ok) { ctx.sheet(null); ctx.toast(prepaid && Number(paid) ? 'Booked, and added to settle up' : 'Car marked booked'); }
    }}>
      <div className="field">
        <label htmlFor="cb-conf">Confirmation number <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input id="cb-conf" value={conf} onChange={(e) => setConf(e.target.value)} maxLength={40} autoComplete="off" />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={prepaid} onChange={(e) => setPrepaid(e.target.checked)} />
        <span>I paid for it</span>
      </label>
      {prepaid && (
        <div className="field">
          <label htmlFor="cb-paid">Amount paid ($)</label>
          <input id="cb-paid" type="number" inputMode="decimal" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <p className="hint">Goes into Settle up, split between the {car.riders.length} people in the car.</p>
        </div>
      )}
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Mark booked'}</button>
    </form>
  );
}
