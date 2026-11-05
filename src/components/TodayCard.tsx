'use client';

import type { DateData, DestinationData, LodgingData, RoundData } from '@/lib/shared';
import { addDays, andList, cashAppLink, clockLabel, dayLabel, venmoLink, groupNames, isoDay, money, nightsOf, parseDay, pickOf, plannedRounds, settleUp, teeAfter, teeMinutes } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { useTrip } from './ui';
import { useWeather } from './live';

/** Arrive this long before your tee time: check in, pay, warm up. */
const ARRIVE_EARLY_MIN = 30;
const minutesToClock = (m: number) => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60), mi = ((m % 60) + 60) % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

/** Directions in Google Maps (opens the app on phones; free, no key). */
const directions = (q: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

/** During the trip (and the day before): what's happening today, with directions. */
export function TodayCard() {
  const { state, me } = useTrip();
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const stay = pickOf<LodgingData>(state, 'lodging').option;
  const start = date.locked ? date.option?.data.start : undefined;
  const nights = nightsOf(state.trip, date.option?.data);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = start ? Math.round((today.getTime() - parseDay(start).getTime()) / 864e5) + 1 : -1; // 1 = arrival day
  const during = !!start && day >= 0 && day <= nights + 1;
  const wx = useWeather(during ? dest?.data.name : undefined, start, nights);
  if (!start || !during) return null;
  const shown = day === 0 ? 1 : day; // the day before shows tomorrow
  const iso = isoDay(addDays(parseDay(start), shown - 1));

  const rounds = plannedRounds(state).filter((r) => r.data.day === shown).sort((a, b) => teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const landing = state.members.filter((m) => m.flight_arrive_at?.startsWith(iso)).sort((a, b) => a.flight_arrive_at!.localeCompare(b.flight_arrive_at!));
  const leaving = state.members.filter((m) => m.flight_depart_at?.startsWith(iso)).sort((a, b) => a.flight_depart_at!.localeCompare(b.flight_depart_at!));
  const wxDay = wx.data?.mode === 'forecast' ? wx.data.days.find((d) => d.date === iso) : undefined;
  const where = dest?.data.name || '';
  const owe = me ? settleUp(state).payments.filter((p) => p.from === me.id) : [];

  const myTee = (r: { data: RoundData }) => {
    const i = (r.data.groups || []).findIndex((g) => me && g.includes(me.id));
    if (i < 0) return null;
    const others = (r.data.groups![i] || []).filter((id) => id !== me!.id).map((id) => firstName(state.members.find((m) => m.id === id)?.name || '')).filter(Boolean);
    return `You tee off ${teeAfter(r.data.time, i)}${others.length ? ` with ${andList(others)}` : ''}`;
  };

  return (
    <section className="today">
      <div className="today-head">
        <div>
          <div className="today-when">{day === 0 ? 'Tomorrow' : 'Today'}</div>
          <div className="row-meta">Day {shown} · {dayLabel(start, shown)}{shown === 1 ? ' · arrival day' : shown === nights + 1 ? ' · travel home' : ''}</div>
        </div>
        {wxDay && (wxDay.hi !== null
          ? <div className="today-wx">{wxDay.hi}°<small>/{wxDay.lo ?? '–'}°{wxDay.rain ? ` · ${wxDay.rain}% rain` : ''}{wxDay.wind !== null && wxDay.wind >= 15 ? ` · ${wxDay.wind} mph wind` : ''}</small></div>
          : wxDay.lo !== null && <div className="today-wx"><small>Tonight </small>{wxDay.lo}°</div>)}
      </div>

      <div className="list">
        {rounds.map((r) => {
          const mine = myTee(r);
          const to = r.data.lat && r.data.lon ? `${r.data.lat},${r.data.lon}` : `${r.data.course} ${r.data.where || where}`;
          const groups = groupNames(state, r.data.groups);
          const myGroup = (r.data.groups || []).findIndex((g) => me && g.includes(me.id));
          const arrive = minutesToClock(teeMinutes(teeAfter(r.data.time, Math.max(0, myGroup))) - ARRIVE_EARLY_MIN);
          return (
            <div className="row today-round" key={r.id}>
              <div className="tee" style={{ minWidth: 56 }}>{r.data.time.replace(/\s*(AM|PM)/i, '')}<small>{(r.data.time.match(/AM|PM/i) || [''])[0].toUpperCase()}</small></div>
              <div className="grow">
                <div className="row-title">{r.data.course}</div>
                <div className="row-meta">{mine || (groups.length ? `${groups.length} groups` : 'No pairings yet')}</div>
                <div className="row-meta">Be there by {arrive}{r.data.booked ? (r.data.confirmation ? ` · Conf. ${r.data.confirmation}` : ' · Booked') : ''}</div>
                {!r.data.booked && <div className="row-meta warn-text">Not marked booked yet</div>}
                {groups.length > 1 && (
                  <details className="today-groups">
                    <summary>All groups</summary>
                    {groups.map((g, i) => <div className="row-meta" key={i}><strong>{teeAfter(r.data.time, i)}</strong> · {g}</div>)}
                  </details>
                )}
              </div>
              <a className="btn small" href={directions(to)} target="_blank" rel="noopener noreferrer">Directions</a>
            </div>
          );
        })}
        {!rounds.length && <div className="row"><div className="grow row-meta">No golf in the plan {day === 0 ? 'tomorrow' : 'today'}.</div></div>}
        {landing.map((m) => (
          <div className="row" key={`in-${m.id}`}>
            <div className="grow"><div className="row-title">{m.id === me?.id ? 'You land' : `${firstName(m.name)} lands`}</div><div className="row-meta">{m.flight_summary || 'Flight'}</div></div>
            <span className="row-meta">{clockLabel(m.flight_arrive_at!, false)}</span>
          </div>
        ))}
        {leaving.map((m) => (
          <div className="row" key={`out-${m.id}`}>
            <div className="grow"><div className="row-title">{m.id === me?.id ? 'Your flight home' : `${firstName(m.name)} flies home`}</div><div className="row-meta">{m.flight_summary || 'Flight'}</div></div>
            <span className="row-meta">{clockLabel(m.flight_depart_at!, false)}</span>
          </div>
        ))}
        {shown === nights + 1 && owe.length > 0 && (
          <div className="row">
            <div className="grow"><div className="row-title">Settle up before you go</div><div className="row-meta">You owe {andList(owe.map((p) => `${firstName(state.members.find((m) => m.id === p.to)?.name || '')} ${money(Math.round(p.amount))}`))}</div></div>
            {(() => {
              const p = owe[0], to = state.members.find((m) => m.id === p.to);
              const href = owe.length === 1 && to?.venmo ? venmoLink(to.venmo, p.amount, state.trip.name) : owe.length === 1 && to?.cashapp ? cashAppLink(to.cashapp, p.amount) : '';
              return href
                ? <a className="btn small primary" href={href} target="_blank" rel="noopener noreferrer">{to?.venmo ? 'Venmo' : 'Cash App'}</a>
                : <button className="btn small" onClick={() => document.getElementById('settle-up')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Pay</button>;
            })()}
          </div>
        )}
        {stay && (
          <div className="row">
            <div className="grow"><div className="row-title">Staying at {stay.data.name}</div></div>
            {stay.data.url && <a className="btn small" href={stay.data.url} target="_blank" rel="noopener noreferrer">Listing</a>}
          </div>
        )}
      </div>
    </section>
  );
}
