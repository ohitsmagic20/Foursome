import 'server-only';
import type { Option, RoundData, Trip } from './shared';
import { bookingOpens, dayLabel, inPlace, pickOf, tripPlace } from './shared';
import type { DateData } from './shared';
import { db, firstIn, loadState } from './server';
import { notify } from './push';
import { APP_URL, emailMembers } from './email';

/**
 * Rounds whose tee times open for booking soon: remind whoever is booking (or the organizer and whoever set it)
 * the morning before and the morning of. Runs from the daily cron. Returns how many reminders went out.
 */
export async function remindTeeTimes(now = new Date()): Promise<number> {
  const { data, error } = await db().from('options').select('id,trip_id,kind,data,locked,created_by').eq('kind', 'round').not('data->bookBy', 'is', null).limit(2000);
  if (error || !data?.length) return 0;
  const byTrip = new Map<string, Option<RoundData>[]>();
  for (const o of data as (Option<RoundData> & { trip_id: string })[]) byTrip.set(o.trip_id, [...(byTrip.get(o.trip_id) || []), o]);
  let sent = 0;
  for (const [tripId] of byTrip) {
    const { data: trip } = await db().from('trips').select('id,code,name,nights,food,deadlines').eq('id', tripId).maybeSingle();
    if (!trip) continue;
    const state = await loadState(trip as Trip, null);
    const date = pickOf<DateData>(state, 'date');
    if (!date.locked || !date.option) continue; // reminders only once the dates are final
    const here = new Set(inPlace<RoundData>(state, 'round', tripPlace(state)).map((r) => r.id));
    for (const r of state.options.filter((o) => o.kind === 'round' && here.has(o.id)) as Option<RoundData>[]) {
      if (r.data.booked) continue;
      const open = bookingOpens(state, r, now);
      if (!open || (open.daysAway !== 0 && open.daysAway !== 1)) continue;
      if (!(await firstIn(`teetime:${r.id}:${open.iso}:${open.daysAway}`, 3 * 24 * 60))) continue;
      const organizers = state.members.filter((m) => m.is_organizer).map((m) => m.id);
      const who = r.data.owner ? [r.data.owner] : [...new Set([...organizers, ...(r.data.bookBy?.by ? [r.data.bookBy.by] : [])])];
      const when = open.daysAway === 0 ? 'Today' : 'Tomorrow';
      const at = open.at ? ` at ${open.at}` : '';
      const round = `${r.data.course} on ${dayLabel(date.option.data.start, r.data.day)}`;
      const body = `${when}${at}: tee times open for ${round}.`;
      const url = `/t/${trip.code}#golf`;
      await notify(trip.id, who, { title: trip.name, body, url, tag: `teetime-${r.id}` });
      sent += await emailMembers(who, {
        subject: `${trip.name}: ${body}`,
        heading: body,
        lines: [
          `${r.data.course} takes bookings ${open.days} day${open.days === 1 ? '' : 's'} ahead${at}. Book ${Math.ceil(state.members.length / 4)} tee time${state.members.length > 4 ? 's' : ''} for ${r.data.time}.`,
          ...(r.data.notes ? [`Notes: ${r.data.notes}`] : []),
          'Once it’s booked, mark it booked in the app so everyone knows.',
        ],
        button: { label: 'Open the round', url: `${APP_URL}${url}` },
      });
    }
  }
  return sent;
}
