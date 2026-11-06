'use client';

import { useEffect, useState } from 'react';
import type { MyTrip } from '@/lib/shared';
import { rangeLabel } from '@/lib/shared';
import { api, getSession, savedTrips } from '@/lib/client';
import { countdown, dateTile, groupTrips, mergeTrips, type TripItem } from '@/lib/tripList';
import { Icon } from './ui';

/** Every trip this person is on: their account's trips plus the ones remembered on this phone. */
export function useMyTrips(account?: MyTrip[] | null): TripItem[] | null {
  const [list, setList] = useState<TripItem[] | null>(null);
  useEffect(() => {
    const local = savedTrips();
    if (account !== undefined) { setList(mergeTrips(account, local)); return; }
    setList(mergeTrips(null, local));
    if (!getSession()) return;
    let live = true;
    api<{ trips: MyTrip[] }>('/api/me').then((r) => live && setList(mergeTrips(r.trips, savedTrips()))).catch(() => {});
    return () => { live = false; };
  }, [account]);
  return list;
}

function TripRow({ t, current }: { t: TripItem; current?: string }) {
  const tile = dateTile(t);
  const here = t.code === current;
  const when = countdown(t);
  const meta = [
    t.destination ? t.destination.split(',')[0] + (t.tentative ? '?' : '') : 'Place TBD',
    t.start ? rangeLabel(t.start, t.nights) + (t.tentative ? '?' : '') : null,
    t.members ? `${t.members} going` : null,
  ].filter(Boolean).join(' · ');
  return (
    <a className={`trip-row${here ? ' here' : ''}`} href={`/t/${t.code}`} aria-current={here ? 'page' : undefined}>
      <span className={`trip-tile${t.start ? '' : ' none'}`}><span>{tile.top}</span><b>{tile.big}</b></span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="row-title trip-name">{t.name}</span>
        <span className="row-meta trip-meta">{meta}</span>
      </span>
      {here ? <span className="chip good">Viewing</span> : when ? <span className="chip plain">{when}</span> : Icon.chev}
    </a>
  );
}

/** Trips grouped by when they happen: coming up (soonest first), not dated yet, and past (folded away). */
export function TripList({ trips, current }: { trips: TripItem[]; current?: string }) {
  const { upcoming, undated, past } = groupTrips(trips);
  const showHeads = [upcoming, undated].filter((g) => g.length).length > 1;
  return (
    <div className="trip-groups">
      {upcoming.length > 0 && (
        <div>
          {showHeads && <div className="trip-group-h">Coming up</div>}
          <div className="list">{upcoming.map((t) => <TripRow key={t.code} t={t} current={current} />)}</div>
        </div>
      )}
      {undated.length > 0 && (
        <div>
          {showHeads && <div className="trip-group-h">Dates not set yet</div>}
          <div className="list">{undated.map((t) => <TripRow key={t.code} t={t} current={current} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <details className="trip-past">
          <summary>Past trips · {past.length}</summary>
          <div className="list">{past.map((t) => <TripRow key={t.code} t={t} current={current} />)}</div>
        </details>
      )}
    </div>
  );
}

/** The sheet behind the trip name: jump to another trip or start a new one. */
export function SwitcherSheet({ current }: { current: string }) {
  const trips = useMyTrips();
  return (
    <div className="stack" style={{ gap: 14 }}>
      {!trips ? <div className="empty"><span className="spinner" style={{ display: 'inline-block' }} /></div> : <TripList trips={trips} current={current} />}
      <a className="btn primary block" href="/#start">{Icon.plus} Start a new trip</a>
    </div>
  );
}
