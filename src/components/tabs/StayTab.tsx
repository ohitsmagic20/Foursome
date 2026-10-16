'use client';

import type { LodgingData } from '@/lib/shared';
import { bedsNeeded, leaderOf, lockedOf, lodgingShare, money, optionsOf, tally } from '@/lib/shared';
import { Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { lodgingSheet } from '../sheets';

export function StayTab() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const opts = optionsOf<LodgingData>(state, 'lodging');
  const locked = lockedOf<LodgingData>(state, 'lodging');
  const leader = leaderOf<LodgingData>(state, 'lodging');
  const need = bedsNeeded(state.members);
  const own = state.members.find((m) => m.bed === 'own');
  const share = state.members.find((m) => m.bed === 'share');
  const shown = locked ? [locked, ...opts.filter((o) => o.id !== locked.id)] : opts.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);

  return (
    <section className="section">
      <div className="section-head"><h2>Where we stay</h2><button className="btn small" onClick={() => lodgingSheet(ctx)}>{Icon.plus} Place</button></div>
      <p className="sub">Paste an Airbnb, Vrbo or hotel link and add the total for your dates. The group votes, then the organizer books it on that site.</p>
      <Callout>The group needs <strong>{need} beds</strong>: {state.members.filter((m) => m.bed === 'own').length} want their own and {state.members.filter((m) => m.bed === 'share').length} will share.</Callout>
      {opts.length === 0 && <button className="card empty dashed" onClick={() => lodgingSheet(ctx)}>Suggest the first place to stay.</button>}
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
            <div className="tally" style={{ gap: 6 }}>
              {o.locked ? <Chip kind="good">Locked</Chip> : !locked && leader?.id === o.id && tally(state, o.id).yes > 0 ? <Chip kind="flag">Leading</Chip> : null}
              {o.data.beds > 0 && (fits ? <Chip kind="good">Fits everyone</Chip> : <Chip kind="bad">{need - o.data.beds} bed{need - o.data.beds > 1 ? 's' : ''} short</Chip>)}
              <span>About {own ? money(lodgingShare(state.members, o.data.total, own)) : ''}{own && share ? ' / ' : ''}{share ? `${money(lodgingShare(state.members, o.data.total, share))} sharing` : ''} each</span>
            </div>
            {!locked && <VoteControl option={o} />}
            <Tally option={o} />
            <div className="opt-foot">
              {o.data.url && <a className="btn small" href={o.data.url} target="_blank" rel="noopener noreferrer">Open listing</a>}
              <LockButton option={o} />
              {canEdit(me, o) && <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => lodgingSheet(ctx, o)}>Edit</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
