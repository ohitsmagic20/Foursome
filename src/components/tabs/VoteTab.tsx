'use client';

import type { DateData, DestinationData, VoteValue } from '@/lib/shared';
import { leaderOf, lockedOf, optionsOf, rangeLabel, tally, votesFor } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { dateSheet, destSheet } from '../sheets';

const NEXT: Record<string, VoteValue | null> = { none: 'yes', yes: 'maybe', maybe: 'no', no: null };
const SYM: Record<string, string> = { yes: '✓', maybe: '?', no: '✕', none: '' };

export function VoteTab() {
  return (<><When /><Where /></>);
}

function When() {
  const ctx = useTrip();
  const { state, me, vote } = ctx;
  const dates = optionsOf<DateData>(state, 'date').slice().sort((a, b) => a.data.start.localeCompare(b.data.start));
  const locked = lockedOf<DateData>(state, 'date');
  const leader = leaderOf<DateData>(state, 'date');
  const colClass = (id: string) => (locked ? (locked.id === id ? 'won' : '') : leader?.id === id ? 'best' : '');
  const members = state.members.slice().sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));

  return (
    <section className="section">
      <div className="section-head"><h2>When</h2><button className="btn small" onClick={() => dateSheet(ctx)}>{Icon.plus} Dates</button></div>
      {dates.length === 0 ? (
        <button className="card empty dashed" onClick={() => dateSheet(ctx)}>Suggest the first set of dates. Everyone else marks if they’re in.</button>
      ) : (
        <>
          <p className="sub">Tap your row to mark each option: in, maybe, or out. {state.trip.nights} nights each.</p>
          <div className="scroll">
            <table className="sc">
              <thead><tr><th className="name">Golfer</th>{dates.map((d) => <th key={d.id} className={colClass(d.id)}>{rangeLabel(d.data.start, state.trip.nights)}</th>)}</tr></thead>
              <tbody>
                {members.map((m) => {
                  const mine = m.id === me?.id;
                  return (
                    <tr key={m.id} className={mine ? 'me' : ''}>
                      <td className="name">{firstName(m.name)}{mine && <span className="row-meta"> (you)</span>}</td>
                      {dates.map((d) => {
                        const v = (votesFor(state, d.id)[m.id] as VoteValue | undefined) ?? 'none';
                        const mark = <span className={`mark ${v}`}>{SYM[v]}</span>;
                        return (
                          <td key={d.id} className={colClass(d.id)}>
                            {mine && !locked
                              ? <button className="cell" aria-label={`${rangeLabel(d.data.start, state.trip.nights)}: ${v === 'none' ? 'not voted' : v}. Tap to change.`} onClick={() => vote(d.id, NEXT[v])}>{mark}</button>
                              : <div className="cell" aria-label={`${m.name}: ${v}`}>{mark}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td className="name">In</td>{dates.map((d) => <td key={d.id} className={colClass(d.id)}>{tally(state, d.id).yes}/{state.members.length}</td>)}</tr></tfoot>
            </table>
          </div>
          <div className="list">
            {dates.map((d) => {
              const t = tally(state, d.id);
              return (
                <div className="row" key={d.id}>
                  <div className="grow">
                    <div className="row-title">{rangeLabel(d.data.start, state.trip.nights)} {d.locked ? <Chip kind="good">Locked</Chip> : !locked && leader?.id === d.id && t.yes > 0 ? <Chip kind="flag">Leading</Chip> : null}</div>
                    <div className="row-meta">{t.yes} in{t.maybe ? ` · ${t.maybe} maybe` : ''}{t.no ? ` · ${t.no} out` : ''}{t.waiting ? ` · ${t.waiting} waiting` : ''}</div>
                  </div>
                  <LockButton option={d} />
                  {canEdit(me, d) && !d.locked && <button className="btn small ghost danger" onClick={() => ctx.act('delete_option', { optionId: d.id })} aria-label="Remove these dates">Remove</button>}
                </div>
              );
            })}
          </div>
          {!me?.is_organizer && !locked && <p className="hint">The organizer locks the dates once the group agrees.</p>}
        </>
      )}
    </section>
  );
}

function Where() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const dests = optionsOf<DestinationData>(state, 'destination');
  const locked = lockedOf<DestinationData>(state, 'destination');
  const leader = leaderOf<DestinationData>(state, 'destination');
  const shown = locked ? [locked, ...dests.filter((d) => d.id !== locked.id)] : dests.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);
  return (
    <section className="section">
      <div className="section-head"><h2>Where</h2><button className="btn small" onClick={() => destSheet(ctx)}>{Icon.plus} Place</button></div>
      {dests.length === 0 && <button className="card empty dashed" onClick={() => destSheet(ctx)}>Suggest a destination, like Myrtle Beach, Scottsdale or Pinehurst.</button>}
      {locked && <Callout kind="good"><strong>{locked.data.name}</strong> is locked in.</Callout>}
      {shown.map((d) => (
        <div key={d.id} className={`card opt ${d.locked ? 'locked' : ''}`} style={locked && !d.locked ? { opacity: .6 } : undefined}>
          <div className="opt-head">
            <div style={{ minWidth: 0 }}>
              <div className="row-title" style={{ fontSize: 17 }}>{d.data.name}</div>
              <div className="row-meta">{d.data.airport ? `Fly into ${d.data.airport}` : 'No airport code yet: flight search needs one'}</div>
            </div>
            {d.locked ? <Chip kind="good">Locked</Chip> : !locked && leader?.id === d.id && tally(state, d.id).yes > 0 ? <Chip kind="flag">Leading</Chip> : null}
          </div>
          {!locked && <VoteControl option={d} />}
          <Tally option={d} />
          {(me?.is_organizer || canEdit(me, d)) && (
            <div className="opt-foot">
              <LockButton option={d} />
              {canEdit(me, d) && <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => destSheet(ctx, d)}>Edit</button>}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
