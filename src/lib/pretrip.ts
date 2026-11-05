import 'server-only';
import type { Trip } from './shared';
import { addDays, isoDay } from './shared';
import { forMember, openItems } from './openItems';
import { db, firstIn, loadState } from './server';
import { notify } from './push';
import { APP_URL, emailMembers } from './email';

/** Days before the trip to check what's still open. */
export const PRETRIP_DAYS = [7, 2];

/** Daily: 7 and 2 days before each trip, tell the organizer what's open and each person what's theirs. */
export async function pretripChecks(now = new Date()): Promise<number> {
  const targets = new Map(PRETRIP_DAYS.map((d) => [isoDay(addDays(now, d)), d]));
  const { data: dates } = await db().from('options').select('trip_id,data').eq('kind', 'date').eq('locked', true).limit(5000);
  const due = (dates || []).filter((o) => targets.has(String((o.data as { start?: string }).start)));
  let sent = 0;
  for (const o of due) {
    const start = String((o.data as { start: string }).start);
    const days = targets.get(start)!;
    const { data: trip } = await db().from('trips').select('id,code,name,nights,food').eq('id', o.trip_id).maybeSingle();
    if (!trip) continue;
    if (!(await firstIn(`pretrip:${trip.id}:${start}:${days}`, 3 * 24 * 60))) continue;
    const state = await loadState(trip as Trip, null);
    const items = openItems(state);
    const when = days === 2 ? 'in 2 days' : 'in a week';
    const link = (tab: string) => `${APP_URL}/t/${trip.code}#${tab}`;
    const organizers = state.members.filter((m) => m.is_organizer);

    // Organizer: the whole list, or an all-clear a week out.
    if (items.length || days === 7) {
      const body = items.length ? `${items.length} thing${items.length > 1 ? 's' : ''} still open before the trip.` : 'Everything’s booked. Nice work.';
      await notify(trip.id, organizers.map((m) => m.id), { title: `${trip.name} is ${when}`, body, url: `/t/${trip.code}`, tag: 'pretrip' });
      sent += await emailMembers(organizers.map((m) => m.id), {
        subject: `${trip.name} is ${when}: ${items.length ? `${items.length} still open` : 'all set'}`,
        heading: `${trip.name} is ${when}`,
        lines: items.length ? items.map((i) => `• ${i.text}`) : ['Rounds, stay and flights are all booked.'],
        button: { label: 'Open the trip', url: link(items[0]?.tab || 'trip') },
      });
    }
    // Everyone else: just their own to-dos.
    for (const m of state.members.filter((x) => !x.is_organizer)) {
      const mine = forMember(items, m);
      if (!mine.length) continue;
      const tab = items.find((i) => i.who.includes(m.id))!.tab;
      await notify(trip.id, [m.id], { title: `${trip.name} is ${when}`, body: mine[0], url: `/t/${trip.code}#${tab}`, tag: 'pretrip' });
      sent += await emailMembers([m.id], { subject: `${trip.name} is ${when}: ${mine.length > 1 ? `${mine.length} things for you` : mine[0]}`, heading: `${trip.name} is ${when}`, lines: mine.map((t) => `• ${t}`), button: { label: 'Open the trip', url: link(tab) } });
    }
  }
  return sent;
}
