'use client';

import type { DateData, DestinationData } from '@/lib/shared';
import { destAirports, nightsOf, optionsOf, pickOf, rangeLabel, tripNights } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { Icon, useTrip } from '../ui';
import { whenSheet, whereSheet } from '../sheets';
import { WeatherStrip } from '../live';

/**
 * Where and when: the organizer sets them; nobody votes. Shown on Home until both are set,
 * after that they're in the plan card (where the organizer can change them).
 */
export function TripBasics() {
  const ctx = useTrip();
  const { state, me, act, toast } = ctx;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  if (date.locked && dest.locked) return null;
  const org = !!me?.is_organizer;
  const organizer = state.members.find((m) => m.is_organizer);
  // Trips from before the organizer decided: what people had suggested, one tap to use it.
  const oldDests = dest.locked ? [] : optionsOf<DestinationData>(state, 'destination');
  const oldDates = date.locked ? [] : optionsOf<DateData>(state, 'date');
  const use = async (kind: 'date' | 'destination', id: string, what: string) => { if (await act('set_plan', { kind, optionId: id })) toast(`${what} it is`); };
  const row = (k: string, icon: React.ReactNode, value: React.ReactNode, meta: string, edit: () => void, setLabel: string, isSet: boolean) => (
    <div className="basic-row">
      <span className="basic-icon" aria-hidden="true">{icon}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="k">{k}</div>
        {isSet ? <div className="row-title">{value}</div> : <div className="row-meta">{org ? 'Not set yet' : `${organizer ? firstName(organizer.name) : 'The organizer'} hasn’t set it yet`}</div>}
        {isSet && meta && <div className="row-meta">{meta}</div>}
      </div>
      {org && <button className={`btn small${isSet ? ' ghost' : ' primary'}`} onClick={edit}>{isSet ? 'Change' : setLabel}</button>}
    </div>
  );
  return (
    <section id="decide" className="section">
      <div className="section-head"><h2>Where and when</h2>{org && <span className="sub">You decide</span>}</div>
      <div className="card basics">
        {row('Where', Icon.pin, dest.locked ? dest.option!.data.name : null,
          dest.locked && destAirports(dest.option!.data).length ? `Fly into ${destAirports(dest.option!.data).join(' or ')}` : '',
          () => whereSheet(ctx, dest.locked ? dest.option! : undefined), 'Set where', dest.locked)}
        {row('When', Icon.calendar, date.locked ? rangeLabel(date.option!.data.start, nightsOf(state.trip, date.option!.data)) : null,
          date.locked ? `${nightsOf(state.trip, date.option!.data)} nights` : '',
          () => whenSheet(ctx, date.locked ? date.option! : undefined), 'Set dates', date.locked)}
        {org && (oldDests.length > 0 || oldDates.length > 0) && (
          <div className="basic-old">
            <div className="row-meta">Suggested earlier. Tap one to use it:</div>
            <div className="pick-row">
              {oldDests.map((d) => <button key={d.id} className="btn small" onClick={() => use('destination', d.id, d.data.name.split(',')[0])}>{d.data.name}</button>)}
              {oldDates.map((d) => <button key={d.id} className="btn small" onClick={() => use('date', d.id, rangeLabel(d.data.start, nightsOf(state.trip, d.data)))}>{rangeLabel(d.data.start, nightsOf(state.trip, d.data))}</button>)}
            </div>
          </div>
        )}
        {dest.locked && date.option && <WeatherStrip place={dest.option!.data.name} start={date.option.data.start} nights={tripNights(state)} />}
      </div>
      {!org && <p className="hint">The organizer picks the place and dates. Once they’re set you can line up flights.</p>}
    </section>
  );
}
