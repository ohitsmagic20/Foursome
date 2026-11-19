'use client';

import type { DateData, DestinationData, LodgingData, Option } from '@/lib/shared';
import { listingSite } from '@/lib/shared';
import { andList, bedsNeeded, destAirports, inPlace, leaderOf, lockedOf, lodgingShare, money, optionsOf, pickOf, tally } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { PackagesNear } from '../Packages';
import { StaySearch } from '../live';
import { BookButton, BookingTag, DriveLine, Fold, Icon, LockButton, MoreMenu, Tally, VoteControl, bookingItems, canEdit, useTrip } from '../ui';
import { lodgingSheet } from '../sheets';
import { StayMap, driveLabel, useStayDistances } from '../StayMap';
import { Deadline } from '../Deadline';

export function StayTab() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const place = ctx.place;
  const opts = inPlace<LodgingData>(state, 'lodging', place);
  const locked = lockedOf<LodgingData>(state, 'lodging', place);
  const leader = leaderOf<LodgingData>(state, 'lodging', place);
  const need = bedsNeeded(state.members);
  const own = state.members.find((m) => m.bed === 'own');
  const share = state.members.find((m) => m.bed === 'share');
  const dest = (optionsOf<DestinationData>(state, 'destination').find((d) => d.id === place) || null) as Option<DestinationData> | null;
  const date = pickOf<DateData>(state, 'date').option;
  const shown = locked ? [locked, ...opts.filter((o) => o.id !== locked.id)] : opts.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);
  const dist = useStayDistances(dest, shown);

  const card = (o: Option<LodgingData>) => {
    const fits = !o.data.beds || o.data.beds >= need;
    const far = dist.get(o.id);
    const drive = far && far.avgMin !== null
      ? `${driveLabel(far.avgMin)} avg to golf${far.airportMin !== null ? ` · ${driveLabel(far.airportMin)} from ${far.airportCode}` : ''}`
      : far && far.letter && far.airportMin !== null ? `${driveLabel(far.airportMin)} from ${far.airportCode}` : '';
    return (
      <div key={o.id} className={`card opt ${o.locked ? 'locked' : ''}`}>
        {o.data.image && <img className="opt-img" src={o.data.image} alt="" loading="lazy" />}
        <div className="opt-head">
          <div style={{ minWidth: 0 }}>
            <div className="row-title" style={{ fontSize: 17 }}>{far?.letter && <span className="pin pin-home stay-letter">{far.letter}</span>}{o.data.name}</div>
            <div className="row-meta">{o.data.bedrooms ? `${o.data.bedrooms} bedrooms` : 'Bedrooms not listed'} · {o.data.beds ? `${o.data.beds} beds` : 'beds not listed'}</div>
            {drive && <DriveLine text={drive} />}
            {far && !far.letter && <div className="row-meta">Not on the map yet{canEdit(me, o) ? '. Add an address from ••• below' : ''}.</div>}
          </div>
          <div className="fee">{money(o.data.total)}<small>total</small></div>
        </div>
        <div className="opt-status">
          {o.locked ? <span className="good">Locked</span> : !locked && leader?.id === o.id && tally(state, o.id).yes > 0 ? <span className="flag">Leading</span> : null}
          <BookingTag option={o} />
          {o.data.beds > 0 && (fits ? <span className="good">Fits everyone</span> : <span className="bad">{need - o.data.beds} bed{need - o.data.beds > 1 ? 's' : ''} short</span>)}
          <span>{own ? money(lodgingShare(state.members, o.data.total, own)) : ''}{own && share ? ' / ' : ''}{share ? `${money(lodgingShare(state.members, o.data.total, share))} sharing` : ''} each</span>
        </div>
        {!locked && <VoteControl option={o} />}
        {!locked && <Tally option={o} />}
        <div className="opt-foot">
          {o.locked && <BookButton option={o} />}
          {!o.locked && <LockButton option={o} />}
          {o.data.url && <a className="btn small" href={o.data.url} target="_blank" rel="noopener noreferrer">{o.locked && !o.data.booked ? `Book on ${listingSite(o.data.url)} ↗` : 'Open listing'}</a>}
          <span style={{ marginLeft: 'auto' }} />
          <MoreMenu items={[
            ...bookingItems(ctx, o),
            canEdit(me, o) && { label: far && !far.letter ? 'Edit (add an address)' : 'Edit', onClick: () => lodgingSheet(ctx, o) },
            o.locked && me?.is_organizer && { label: 'Unlock', onClick: () => ctx.act('unlock', { optionId: o.id }) },
          ]} />
        </div>
      </div>
    );
  };

  return (
    <section className="section">
      <div className="section-head"><h2>Where we stay</h2><button className="btn small" onClick={() => lodgingSheet(ctx)}>{Icon.plus} Place</button></div>
      <p className="sub">Paste an Airbnb, Vrbo or hotel link and the total. Need {need} bed{need === 1 ? '' : 's'}.</p>
      <Deadline kind="lodging" />
      {dest && date
        ? <StaySearch dest={dest.data.name} start={date.data.start} />
        : <p className="hint">Pick dates and a destination to search rentals.</p>}
      {dest && opts.length > 0 && <StayMap dest={dest} stays={shown} />}
      {opts.length === 0 && <button className="card empty dashed" onClick={() => lodgingSheet(ctx)}>Suggest the first place to stay.</button>}
      {(locked ? [locked] : shown).map((o) => card(o))}
      {locked && shown.length > 1 && (
        <Fold title={`Other options (${shown.length - 1})`} meta="Not picked. Kept here in case plans change.">
          <div className="stack" style={{ gap: 10 }}>{shown.filter((o) => o.id !== locked.id).map((o) => card(o))}</div>
        </Fold>
      )}
      {locked && <Rooms stay={locked} />}
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
      <div className="list rooms-list">
        {rooms.map((r, i) => {
          const crowded = r.length > 1 ? r.filter(wantsOwn).map(who) : [];
          return (
            <div key={i} className={`row room-row${i === mine ? ' mine' : ''}`}>
              <span className="room-num">{i + 1}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row-title">{r.length ? andList(r.map(who)) : <span className="room-open">Open</span>}</div>
                {crowded.length > 0 && <div className="row-meta warn-text">{andList(crowded)} wanted {crowded.length > 1 ? 'their own beds' : crowded[0] === 'You' ? 'your own bed' : 'their own bed'}</div>}
              </div>
              {i === mine ? <span className="chip good">Yours</span> : <button className="btn small" onClick={() => act('rooms', { op: 'move', room: i })}>{mine >= 0 ? 'Move here' : 'Take it'}</button>}
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && placed.size > 0 && <p className="hint">No room yet: {andList(unplaced.map((m) => who(m.id)))}.</p>}
      {!placed.size && <p className="hint">{stay.data.bedrooms ? `${n} bedrooms.` : 'Add the number of bedrooms to the listing to see them all here.'} Tap a room to claim it{me.is_organizer ? ', or assign everyone by who wants their own bed' : ''}.</p>}
    </div>
  );
}
