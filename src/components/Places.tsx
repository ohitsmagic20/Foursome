'use client';

import type { DestinationData, Option } from '@/lib/shared';
import { inPlace, money, optionsOf, placePlan, tally } from '@/lib/shared';
import { useTrip, type TabId } from './ui';

const short = (name: string) => name.split(',')[0];

/** The destinations still in the running, best-liked first. Empty once one is locked. */
export function usePlaces(): Option<DestinationData>[] {
  const { state } = useTrip();
  const ds = optionsOf<DestinationData>(state, 'destination');
  if (ds.some((d) => d.locked)) return [];
  return ds.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);
}

/**
 * On the Stay and Golf tabs while the group hasn't picked a place: switch between destinations,
 * each with its own stays and rounds, so every option can be planned before anyone votes on the place.
 */
export function PlaceSwitcher({ kind }: { kind: 'lodging' | 'round' }) {
  const { state, place, view, go } = useTrip();
  const places = usePlaces();
  if (places.length < 2) return null;
  return (
    <div className="place-switch">
      <div className="place-tabs" role="tablist" aria-label="Destinations">
        {places.map((d) => {
          const n = inPlace(state, kind, d.id).length;
          const on = d.id === place;
          return (
            <button key={d.id} role="tab" aria-selected={on} className={`place-tab${on ? ' on' : ''}`} onClick={() => view(d.id)}>
              <span className="place-name">{short(d.data.name)}</span>
              <span className="place-count">{n ? `${n} ${kind === 'lodging' ? (n === 1 ? 'stay' : 'stays') : n === 1 ? 'round' : 'rounds'}` : 'None yet'}</span>
            </button>
          );
        })}
      </div>
      <p className="hint">Each place gets its own {kind === 'lodging' ? 'stays' : 'rounds'}. Plan them all, then the group compares and picks the place on the <button className="link-btn" onClick={() => go('vote')}>Plan tab</button>.</p>
    </div>
  );
}

/** On a destination card: that place's stay and golf, priced per person, with links to plan them. */
export function PlacePackage({ d }: { d: Option<DestinationData> }) {
  const { state, view } = useTrip();
  const p = placePlan(state, d.id);
  const open = (t: TabId) => () => view(d.id, t);
  const n = state.members.length;
  const nStays = p.stays.length;
  const nRounds = p.rounds.length;
  return (
    <div className="place-pkg">
      <button type="button" className="place-line" onClick={open('stay')}>
        <span className="place-k">Stay</span>
        <span className="place-v">
          {p.stay ? <>{p.stay.data.name}<small>{p.stayLocked ? 'Picked' : nStays > 1 ? `Leading of ${nStays}` : 'Only one suggested'}</small></> : <span className="row-meta">No stays yet. Add some</span>}
        </span>
        <span className="place-amt">{p.stay ? money(p.stayEach) : ''}</span>
      </button>
      <button type="button" className="place-line" onClick={open('golf')}>
        <span className="place-k">Golf</span>
        <span className="place-v">
          {p.golfRounds.length ? <>{p.golfRounds.length} round{p.golfRounds.length === 1 ? '' : 's'}<small>{p.golfPlanned ? 'In the plan' : `Best-liked per day, of ${nRounds} suggested`}{p.golfRounds.length ? ` · ${p.golfRounds.slice(0, 3).map((r) => r.data.course).join(', ')}${p.golfRounds.length > 3 ? '…' : ''}` : ''}</small></> : <span className="row-meta">No rounds yet. Add some</span>}
        </span>
        <span className="place-amt">{p.golfRounds.length ? money(p.golfEach) : ''}</span>
      </button>
      {p.stay && p.golfRounds.length > 0 ? (
        <>
          <div className="place-total">
            <span>Stay and golf, each</span>
            <b>{money(p.each)}</b>
          </div>
          <div className="row-meta">Stay split evenly by {n}; flights and food not included.</div>
        </>
      ) : (p.stay || p.golfRounds.length > 0) ? (
        <div className="row-meta" style={{ paddingTop: 8 }}>Add {p.stay ? 'rounds' : 'a stay'} to see the full price for {d.data.name.split(',')[0]}.</div>
      ) : null}
    </div>
  );
}
