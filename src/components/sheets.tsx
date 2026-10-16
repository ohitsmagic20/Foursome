'use client';

import { useState } from 'react';
import type { DestinationData, LodgingData, Option, RoundData, TripCtx } from './sheetTypes';
import { api, todayLabel } from '@/lib/client';
import { ConfirmButton, Field, Select, SheetForm } from './ui';

async function save(ctx: TripCtx, type: string, payload: Record<string, unknown>, msg: string) {
  if (await ctx.act(type, payload)) {
    ctx.sheet(null);
    ctx.toast(msg);
  }
}
const num = (v: string | undefined) => (v === undefined || v === '' ? 0 : Number(v));

export function tripSheet(ctx: TripCtx) {
  const t = ctx.state.trip;
  ctx.sheet({
    title: 'Trip details',
    body: (
      <SheetForm submit="Save" onSubmit={(fd) => save(ctx, 'update_trip', { name: fd.name, nights: num(fd.nights), deposit: num(fd.deposit), food: num(fd.food) }, 'Trip updated')}>
        <Field name="name" label="Trip name" defaultValue={t.name} required />
        <div className="grid2">
          <Field name="nights" label="Nights" type="number" defaultValue={t.nights} min={1} max={10} step={1} />
          <Field name="deposit" label="Deposit each ($)" type="number" defaultValue={t.deposit} />
        </div>
        <Field name="food" label="Food and extras per person ($)" type="number" defaultValue={t.food} />
      </SheetForm>
    ),
  });
}

export function meSheet(ctx: TripCtx) {
  const m = ctx.me!;
  ctx.sheet({
    title: 'Your details',
    body: (
      <SheetForm submit="Save" onSubmit={(fd) => save(ctx, 'update_me', { name: fd.name, airport: fd.airport, budget: num(fd.budget), bed: fd.bed }, 'Saved')}>
        <Field name="name" label="Name" defaultValue={m.name} required />
        <div className="grid2">
          <Field name="airport" label="Home airport" defaultValue={m.airport} placeholder="ORD" autoCapitalize="characters" maxLength={3} />
          <Field name="budget" label="Budget, all-in ($)" type="number" defaultValue={m.budget} />
        </div>
        <Select name="bed" label="Sleeping" defaultValue={m.bed} options={[['own', 'I want my own bed'], ['share', 'I’m fine sharing a bed']]} />
      </SheetForm>
    ),
  });
}

export function dateSheet(ctx: TripCtx) {
  const d = new Date();
  d.setMonth(d.getMonth() + 4);
  const iso = d.toISOString().slice(0, 10);
  ctx.sheet({
    title: 'Suggest dates',
    body: (
      <SheetForm submit="Add to the vote" onSubmit={(fd) => save(ctx, 'add_option', { kind: 'date', data: { start: fd.start } }, 'Dates added to the vote')}>
        <Field name="start" label="Arrival date" type="date" defaultValue={iso} required />
        <p className="hint">The trip runs {ctx.state.trip.nights} nights from this date. Your vote counts as “in”.</p>
      </SheetForm>
    ),
  });
}

export function destSheet(ctx: TripCtx, opt?: Option<DestinationData>) {
  ctx.sheet({
    title: opt ? 'Edit destination' : 'Suggest a destination',
    body: (
      <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
        onSubmit={(fd) => opt
          ? save(ctx, 'update_option', { optionId: opt.id, data: { name: fd.name, airport: fd.airport } }, 'Saved')
          : save(ctx, 'add_option', { kind: 'destination', data: { name: fd.name, airport: fd.airport } }, 'Destination added')}
        extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
        <Field name="name" label="Destination" defaultValue={opt?.data.name} placeholder="Myrtle Beach, SC" required />
        <Field name="airport" label="Closest airport code" defaultValue={opt?.data.airport} placeholder="MYR" autoCapitalize="characters" maxLength={3} />
        <p className="hint">The airport code is what flight search uses for everyone.</p>
      </SheetForm>
    ),
  });
}

function LodgingForm({ ctx, opt }: { ctx: TripCtx; opt?: Option<LodgingData> }) {
  const [url, setUrl] = useState(opt?.data.url || '');
  const [name, setName] = useState(opt?.data.name || '');
  const [image, setImage] = useState(opt?.data.image || '');
  const [looking, setLooking] = useState(false);
  async function lookup(u: string) {
    if (!/^https?:\/\//.test(u)) return;
    setLooking(true);
    try {
      const r = await api<{ title: string; image: string }>('/api/preview', { body: { url: u } });
      if (r.title && !name) setName(r.title);
      if (r.image) setImage(r.image);
    } catch { /* type it in by hand */ } finally { setLooking(false); }
  }
  return (
    <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
      onSubmit={(fd) => {
        const data = { name: fd.name, url: fd.url, image, total: num(fd.total), bedrooms: num(fd.bedrooms), beds: num(fd.beds) };
        return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'lodging', data }, 'Added to the vote');
      }}
      extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
      <div className="field">
        <label htmlFor="f-url">Listing link (Airbnb, Vrbo, hotel)</label>
        <input id="f-url" name="url" type="url" inputMode="url" placeholder="https://" value={url}
          onChange={(e) => setUrl(e.target.value)} onBlur={() => lookup(url)}
          onPaste={(e) => { const t = e.clipboardData.getData('text'); setTimeout(() => lookup(t), 0); }} />
      </div>
      {looking && <p className="hint">Reading the listing…</p>}
      {image && <img className="opt-img" src={image} alt="" />}
      <div className="field">
        <label htmlFor="f-name">Name</label>
        <input id="f-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="6-bedroom beach house" />
      </div>
      <Field name="total" label={`Total for ${ctx.state.trip.nights} nights, with fees ($)`} type="number" defaultValue={opt?.data.total || ''} required />
      <div className="grid2">
        <Field name="bedrooms" label="Bedrooms" type="number" defaultValue={opt?.data.bedrooms || ''} />
        <Field name="beds" label="Beds" type="number" defaultValue={opt?.data.beds || ''} />
      </div>
      <p className="hint">Copy the total from the listing for your dates. Booking still happens on the listing’s site.</p>
    </SheetForm>
  );
}
export function lodgingSheet(ctx: TripCtx, opt?: Option<LodgingData>) {
  ctx.sheet({ title: opt ? 'Edit place' : 'Suggest a place to stay', body: <LodgingForm ctx={ctx} opt={opt} /> });
}

export function roundSheet(ctx: TripCtx, opt?: Option<RoundData>, day = 1) {
  const days = ctx.state.trip.nights + 1;
  const d = opt?.data;
  ctx.sheet({
    title: opt ? 'Edit round' : 'Suggest a round',
    body: (
      <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
        onSubmit={(fd) => {
          const priceChanged = !d || Number(fd.fee) !== Number(d.fee);
          const data = { course: fd.course, day: num(fd.day), time: fd.time, fee: num(fd.fee), booked: d?.booked || false, checked: priceChanged ? todayLabel() : d?.checked || todayLabel() };
          return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'round', data }, 'Round added to the vote');
        }}
        extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
        <Field name="course" label="Course" defaultValue={d?.course} placeholder="Course name" required />
        <div className="grid2">
          <Select name="day" label="Day" defaultValue={d?.day || day} options={Array.from({ length: days }, (_, i) => [i + 1, `Day ${i + 1}`])} />
          <Field name="time" label="First tee time" defaultValue={d?.time || '9:00 AM'} placeholder="8:30 AM" />
        </div>
        <Field name="fee" label="Greens fee per player, with cart ($)" type="number" defaultValue={d?.fee ?? ''} required />
        <p className="hint">Check the course’s booking page for the real rate. Saving a new price records today, {todayLabel()}, as the date it was checked.</p>
      </SheetForm>
    ),
  });
}

export function manualFlightSheet(ctx: TripCtx) {
  const m = ctx.me!;
  ctx.sheet({
    title: 'Enter your flight',
    body: (
      <SheetForm submit="Save my flight" onSubmit={(fd) => save(ctx, 'set_flight', {
        price: num(fd.price), summary: fd.summary, arriveAt: fd.arrive || null, departAt: fd.depart || null,
      }, 'Flight saved')}>
        <Field name="summary" label="Airline and flight" defaultValue={m.flight_summary || ''} placeholder="Southwest 1432, nonstop" />
        <Field name="price" label="Round-trip price ($), or 0 if driving" type="number" defaultValue={m.flight_price ?? ''} required />
        <Field name="arrive" label="Arrival at destination (local time)" type="datetime-local" defaultValue={m.flight_arrive_at?.slice(0, 16) || ''} />
        <Field name="depart" label="Departure for home (local time)" type="datetime-local" defaultValue={m.flight_depart_at?.slice(0, 16) || ''} />
      </SheetForm>
    ),
  });
}
