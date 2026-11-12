'use client';

import type { DateData, DestinationData, LodgingData, Option } from '@/lib/shared';
import { andList, bedsNeeded, destAirports, inPlace, leaderOf, lockedOf, lodgingShare, money, optionsOf, pickOf, tally } from '@/lib/shared';
import { PlaceSwitcher, usePlaces } from '../Places';
import { firstName } from '@/lib/client';
import { PackagesNear } from '../Packages';
import { StaySearch } from '../live';
import { BookingRow, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { lodgingSheet } from '../sheets';
import { Deadline } from '../Deadline';

export function StayTab() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const place = ctx.place;
  const opts = inPlace<LodgingData>(state, 'lodging', place);
  const locked = lockedOf<LodgingData>(state, 'lodging', place);
  const leader = leaderOf<LodgingData>(state, 'lodging', place);
  const choosing = usePlaces().length > 1;
  const need = bedsNeeded(state.members);
  const own = state.members.find((m) => m.bed === 'own');
  const share = state.members.find((m) => m.bed === 'share');
  const dest = (optionsOf<DestinationData>(state, 'destination').find((d) => d.id === place) || null) as Option<DestinationData> | null;
  const where = dest ? dest.data.name.split(',')[0] : '';
  const date = pickOf<DateData>(state, 'date').option;
  const shown = locked ? [locked, ...opts.filter((o) => o.id !== locked.id)] : opts.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);

  return (
    <section className="section">
      <PlaceSwitcher kind="lodging" />
      <div className="section-head"><h2>{choosing && where ? `Stays in ${where}` : 'Where we stay'}</h2><button className="btn small" onClick={() => lodgingSheet(ctx)}>{Icon.plus} Place</button></div>
      <p className="sub">Paste an Airbnb, Vrbo or hotel link and the total. Need {need} beds.</p>
      <Deadline kind="lodging" />
      {dest && date
        ? <StaySearch dest={dest.data.name} start={date.data.start} />
        : <p className="hint">Pick dates and a destination to search rentals.</p>}
      {opts.length === 0 && <button className="card empty dashed" onClick={() => lodgingSheet(ctx)}>{choosing && where ? `Suggest the first place to stay in ${where}.` : 'Suggest the first place to stay.'}</button>}
      {shown.map((o) => {
        const fits = !o.data.beds || o.data.beds >= need;
        return (
          <div key={o.id} className={`card opt ${o.locked ? 'locked' : ''}`} style={locked && !o.locked ? { opacity: .6 } : undefined}>
            {o.data.image && <img className="opt-img" src={o.data.image} alt="" loading="lazy" />}
            <div className="opt-head">
              <div style={{ minWidth: 0 }}>
                <div className="row-title" style={{ fontSize: 17 }}>{o.data.name}</div>
                <div className="row-meta">{o.data.bedrooms ? `${o.data.bedrooms} bedrooms` : 'Bedrooms not listed'} · {o.data.beds ? `${o.data.beds} beds` : 'beds not listed'}</div>
              </div>
              <div className="fee">{money(o.data.total)}<small>total</small></div>
            </div>
            <div className="opt-status">
              {o.locked ? <span className="good">{choosing ? `Picked for ${where}` : 'Locked'}</span> : !locked && leader?.id === o.id && tally(state, o.id).yes > 0 ? <span className="flag">Leading</span> : null}
              {o.data.beds > 0 && (fits ? <span className="good">Fits everyone</span> : <span className="bad">{need - o.data.beds} bed{need - o.data.beds > 1 ? 's' : ''} short</span>)}
              <span>{own ? money(lodgingShare(state.members, o.data.total, own)) : ''}{own && share ? ' / ' : ''}{share ? `${money(lodgingShare(state.members, o.data.total, share))} sharing` : ''} each</span>
            </div>
            <BookingRow option={o} />
            {!locked && <VoteControl option={o} />}
            <Tally option={o} />
            <div className="opt-foot">
              {o.data.url && <a className="btn small" href={o.data.url} target="_blank" rel="noopener noreferrer">Open listing</a>}
              <LockButton option={o} lockLabel={choosing ? `Pick for ${where}` : undefined} />
              {canEdit(me, o) && <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => lodgingSheet(ctx, o)}>Edit</button>}
            </div>
          </div>
        );
      })}
      {locked && !choosing && <Rooms stay={locked} />}
      {!locked && dest && <PackagesNear dest={dest.data.name} airports={destAirports(dest.data)} />}
    </section>
  );
}

/** Who sleeps where. Anyone can move themselves; the organizer can auto-assign by bed preference. */
function Rooms({ stay }: { stay: Option<LodgingData> }) {
  const { state, me, act, toast } = useTrip();
  if (!me) return null;
  const n = Math.max(1, stay.data.bedrooms || 1);
  const ids = new Set(state.members.map((m) => m.id));
  const rooms = Array.from({ length: n }, (_, i) => (stay.data.rooms?.[i] || []).filter((id) => ids.has(id)));
  const placed = new Set(rooms.flat());
  const unplaced = state.members.filter((m) => !placed.has(m.id));
  const mine = rooms.findIndex((r) => r.includes(me.id));
  const who = (id: string) => { const m = state.members.find((x) => x.id === id); return m ? (m.id === me.id ? 'You' : firstName(m.name)) : ''; };
  const wantsOwn = (id: string) => state.members.find((m) => m.id === id)?.bed === 'own';
  return (
    <div className="rooms-wrap">
      <div className="section-head"><h3>Rooms</h3>{me.is_organizer && <div className="btn-row">
        <button className="btn small" onClick={async () => { if (await act('rooms', { op: 'auto' })) toast('Rooms assigned. Everyone can still move.'); }}>{placed.size ? 'Re-assign' : 'Assign rooms'}</button>
      </div>}</div>
      <div className="rooms">
        {rooms.map((r, i) => {
          const crowded = r.length > 1 ? r.filter(wantsOwn).map(who) : [];
          return (
            <div key={i} className={`room${i === mine ? ' mine' : ''}`}>
              <div className="room-name">Room {i + 1}</div>
              <div className="room-who">{r.length ? andList(r.map(who)) : <span className="row-meta">Open</span>}</div>
              {crowded.length > 0 && <div className="row-meta warn-text">{andList(crowded)} wanted {crowded.length > 1 ? 'their own beds' : crowded[0] === 'You' ? 'your own bed' : 'their own bed'}</div>}
              {i !== mine && <button className="link-btn" onClick={() => act('rooms', { op: 'move', room: i })}>{mine >= 0 ? 'Move here' : 'Take this one'}</button>}
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && placed.size > 0 && <p className="hint">No room yet: {andList(unplaced.map((m) => who(m.id)))}.</p>}
      {!placed.size && <p className="hint">{stay.data.bedrooms ? `${n} bedrooms.` : 'Add the number of bedrooms to the listing to see them all here.'} Tap a room to claim it{me.is_organizer ? ', or assign everyone by who wants their own bed' : ''}.</p>}
    </div>
  );
}
