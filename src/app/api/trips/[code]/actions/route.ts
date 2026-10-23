import { after } from 'next/server';
import type { Kind, Member, Trip } from '@/lib/shared';
import type { DateData } from '@/lib/shared';
import { nightsOf, openVotes, rangeLabel } from '@/lib/shared';
import { airport, bed, body, db, handle, HttpError, int, loadState, memberFromRequest, rateLimit, str, tripByCode } from '@/lib/server';
import { notify, type PushMessage } from '@/lib/push';
import { APP_URL, emailableCount, emailMembers, planEmail, type EmailBody } from '@/lib/email';

const KINDS: Kind[] = ['date', 'destination', 'lodging', 'round'];
const SINGLE_WINNER: Kind[] = ['date', 'destination', 'lodging'];
const TAB: Record<Kind, string> = { date: 'vote', destination: 'vote', lodging: 'stay', round: 'golf' };
const NUDGE_HOURS = 4;

/** How an option reads in a notification: "Mar 25–28", "Myrtle Beach, SC", "True Blue Golf Club at 8:30 AM". */
function label(kind: Kind, d: Record<string, unknown>, trip: Trip): string {
  if (kind === 'date') return rangeLabel(String(d.start), nightsOf(trip, d as unknown as DateData));
  if (kind === 'round') return `${d.course} at ${d.time}`;
  return String(d.name || '');
}
const first = (n: string) => n.split(/\s+/)[0];
const MAX_OPTIONS = 60;

function url(v: unknown): string {
  const s = str(v, 500);
  return /^https?:\/\//i.test(s) ? s : '';
}

function cleanData(kind: Kind, raw: unknown, trip: Trip): Record<string, unknown> {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  switch (kind) {
    case 'date': {
      const start = str(d.start, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new HttpError(400, 'Pick an arrival date.');
      const nights = int(d.nights, 0, 14, 0);
      return nights ? { start, nights } : { start };
    }
    case 'destination': {
      const name = str(d.name, 80);
      if (!name) throw new HttpError(400, 'Enter a destination.');
      // Up to 4 airports; `airport` stays as the first one for older code paths.
      const list = (Array.isArray(d.airports) ? d.airports : [d.airport])
        .map((a) => airport(a)).filter((a, i, arr) => a.length === 3 && arr.indexOf(a) === i).slice(0, 4);
      return { name, airport: list[0] || '', airports: list };
    }
    case 'lodging': {
      const name = str(d.name, 100);
      if (!name && !url(d.url)) throw new HttpError(400, 'Enter a name or paste a listing link.');
      return {
        name: name || 'Listing',
        url: url(d.url),
        image: url(d.image),
        total: int(d.total, 0, 1000000, 0),
        bedrooms: int(d.bedrooms, 0, 40, 0),
        beds: int(d.beds, 0, 80, 0),
      };
    }
    case 'round': {
      const course = str(d.course, 100);
      if (!course) throw new HttpError(400, 'Enter the course name.');
      return {
        course,
        day: int(d.day, 1, 15, 1),
        time: str(d.time, 12) || 'TBD',
        fee: int(d.fee, 0, 5000, 0),
        booked: d.booked === true,
        checked: str(d.checked, 24),
        // When the price was checked and which day of the week it was for (0 = Sunday, -1 = unknown).
        // These feed the shared greens-fee ranges other trips see.
        checkedAt: /^\d{4}-\d{2}-\d{2}T/.test(str(d.checkedAt, 30)) ? str(d.checkedAt, 30) : '',
        weekday: int(d.weekday, -1, 6, -1),
        url: url(d.url),
        ...(Array.isArray(d.groups) ? { groups: cleanGroups(d.groups) } : {}),
      };
    }
  }
}

/** Pairings: up to 12 groups of up to 6 member ids; nobody in two groups. */
function cleanGroups(raw: unknown[]): string[][] {
  const seen = new Set<string>();
  return raw.slice(0, 12).map((g) => (Array.isArray(g) ? g : []).map((id) => str(id, 40)).filter((id) => id && !seen.has(id) && seen.add(id)).slice(0, 6)).filter((g) => g.length);
}

async function optionFor(tripId: string, id: unknown) {
  const { data, error } = await db().from('options').select('id,kind,created_by,locked,data').eq('trip_id', tripId).eq('id', str(id, 40)).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'That option was removed. Pull down to refresh.');
  return data as { id: string; kind: Kind; created_by: string | null; locked: boolean; data: Record<string, unknown> };
}
function mustOrganize(me: Member) {
  if (!me.is_organizer) throw new HttpError(403, 'Only the organizer can do that.');
}

export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id, true);
    const b = await body(req);
    // Notifications to send after the response goes out: [who, message, quiet minutes].
    const pings: [string[] | 'others', PushMessage, number][] = [];
    // Emails to send after the response (people with an account and trip emails on).
    const emails: [string[] | 'others', EmailBody][] = [];
    const link = (tab: string) => `${APP_URL}/t/${trip.code}#${tab}`;
    const url = (tab: string) => `/t/${trip.code}#${tab}`;

    switch (b.type) {
      case 'vote': {
        const opt = await optionFor(trip.id, b.optionId);
        if (b.value === null) {
          const r = await db().from('votes').delete().eq('option_id', opt.id).eq('member_id', me.id);
          if (r.error) throw r.error;
        } else {
          if (!['yes', 'maybe', 'no'].includes(String(b.value))) throw new HttpError(400, 'Vote yes, maybe or no.');
          const r = await db().from('votes').upsert({ option_id: opt.id, member_id: me.id, value: b.value, updated_at: new Date().toISOString() });
          if (r.error) throw r.error;
        }
        break;
      }
      case 'add_option': {
        const kind = b.kind as Kind;
        if (!KINDS.includes(kind)) throw new HttpError(400, 'Unknown option type.');
        const { count } = await db().from('options').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id).eq('kind', kind);
        if ((count || 0) >= MAX_OPTIONS) throw new HttpError(400, 'This list is full. Remove an option first.');
        const data = cleanData(kind, b.data, trip);
        const { data: row, error } = await db().from('options').insert({ trip_id: trip.id, kind, data, created_by: me.id }).select('id').single();
        if (error) throw error;
        // Adding something counts as a yes from the person who suggested it.
        await db().from('votes').upsert({ option_id: row.id, member_id: me.id, value: 'yes' });
        pings.push(['others', { title: trip.name, body: `${first(me.name)} suggested ${label(kind, data, trip)}. Are you in?`, url: url(TAB[kind]), tag: `new-${kind}` }, 15]);
        break;
      }
      case 'update_option': {
        const opt = await optionFor(trip.id, b.optionId);
        if (opt.created_by !== me.id && !me.is_organizer) throw new HttpError(403, 'Only the person who added this or the organizer can edit it.');
        const data = cleanData(opt.kind, b.data, trip);
        // Editing a round's course or time keeps its pairings.
        if (opt.kind === 'round' && !('groups' in data) && Array.isArray(opt.data.groups)) data.groups = opt.data.groups;
        const r = await db().from('options').update({ data }).eq('id', opt.id);
        if (r.error) throw r.error;
        break;
      }
      case 'delete_option': {
        const opt = await optionFor(trip.id, b.optionId);
        if (opt.created_by !== me.id && !me.is_organizer) throw new HttpError(403, 'Only the person who added this or the organizer can remove it.');
        const r = await db().from('options').delete().eq('id', opt.id);
        if (r.error) throw r.error;
        break;
      }
      case 'lock':
      case 'unlock': {
        mustOrganize(me);
        const opt = await optionFor(trip.id, b.optionId);
        const lock = b.type === 'lock';
        if (lock && SINGLE_WINNER.includes(opt.kind)) {
          const r = await db().from('options').update({ locked: false }).eq('trip_id', trip.id).eq('kind', opt.kind);
          if (r.error) throw r.error;
        }
        const r = await db().from('options').update({ locked: lock }).eq('id', opt.id);
        if (r.error) throw r.error;
        if (lock) {
          const what = label(opt.kind, opt.data, trip);
          const text = opt.kind === 'round' ? `${what} is in the plan.` : opt.kind === 'lodging' ? `You’re staying at ${what}.` : `${what} is locked in.`;
          pings.push(['others', { title: trip.name, body: text, url: url(TAB[opt.kind]), tag: `lock-${opt.kind}` }, 0]);
          if (SINGLE_WINNER.includes(opt.kind)) {
            const next = opt.kind === 'date' || opt.kind === 'destination' ? 'Time to look at flights.' : 'Check the cost per person on the Clubhouse tab.';
            emails.push(['others', { subject: `${trip.name}: ${text}`, heading: text, lines: [`${first(me.name)} locked it in for ${trip.name}.`, next], button: { label: 'Open the trip', url: link(TAB[opt.kind]) } }]);
          }
        }
        break;
      }
      case 'nudge': {
        mustOrganize(me);
        const { data: t } = await db().from('trips').select('last_nudge').eq('id', trip.id).single();
        if (t?.last_nudge && Date.now() - Date.parse(t.last_nudge) < NUDGE_HOURS * 3600000) {
          throw new HttpError(429, `You nudged the group recently. You can nudge again ${NUDGE_HOURS} hours after the last one.`);
        }
        const state = await loadState(trip, null);
        const waiting: string[] = [];
        for (const m of state.members) {
          if (m.id === me.id) continue;
          const open = openVotes({ ...state, meId: m.id });
          const n = open.date + open.destination + open.lodging + open.round;
          if (n > 0) {
            waiting.push(m.id);
            const body = `${first(me.name)} is waiting on you: ${n} thing${n > 1 ? 's' : ''} to vote on.`;
            pings.push([[m.id], { title: trip.name, body, url: url('trip'), tag: 'nudge' }, 0]);
            emails.push([[m.id], { subject: `${trip.name}: your vote is needed`, heading: body, lines: [`Open ${trip.name} and tap in, maybe or out on each option. It takes a minute.`], button: { label: 'Vote now', url: link('trip') } }]);
          }
        }
        if (!waiting.length) throw new HttpError(400, 'Everyone has voted on everything. Nothing to nudge.');
        await db().from('trips').update({ last_nudge: new Date().toISOString() }).eq('id', trip.id);
        if (pings.length) {
          const subs = await db().from('push_subs').select('member_id').eq('trip_id', trip.id).in('member_id', waiting);
          const reachable = new Set((subs.data || []).map((x) => x.member_id)).size;
          const emailed = await emailableCount(waiting);
          after(async () => {
            for (const [who, msg, quiet] of pings) await notify(trip.id, who as string[], msg, quiet);
            for (const [who, e] of emails) await emailMembers(who as string[], e);
          });
          return Response.json({ ok: true, waiting: waiting.length, reachable, emailed });
        }
        break;
      }
      case 'email_plan': {
        mustOrganize(me);
        await rateLimit(`plan:${trip.id}`, 3, 24 * 60, 'The plan was emailed a few times today already. Try again tomorrow.');
        const state = await loadState(trip, null);
        const sent = await emailMembers(state.members.map((m) => m.id), (id) => planEmail(state, id));
        return Response.json({ ok: true, sent, of: state.members.length });
      }
      case 'update_me': {
        const r = await db().from('members').update({
          name: str(b.name, 60) || me.name,
          airport: airport(b.airport),
          budget: int(b.budget, 0, 100000, me.budget),
          bed: bed(b.bed),
        }).eq('id', me.id);
        if (r.error) throw r.error;
        break;
      }
      case 'set_flight': {
        const iso = (v: unknown) => { const s = str(v, 25); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s : null; };
        const r = await db().from('members').update({
          flight_price: int(b.price, 0, 50000, 0),
          flight_summary: str(b.summary, 160) || null,
          flight_arrive_at: iso(b.arriveAt),
          flight_depart_at: iso(b.departAt),
        }).eq('id', me.id);
        if (r.error) throw r.error;
        break;
      }
      case 'clear_flight': {
        const r = await db().from('members').update({ flight_price: null, flight_summary: null, flight_arrive_at: null, flight_depart_at: null }).eq('id', me.id);
        if (r.error) throw r.error;
        break;
      }
      case 'leave': {
        if (me.is_organizer) throw new HttpError(400, 'Hand the organizer role to someone else before leaving, or delete the trip.');
        const r = await db().from('members').delete().eq('id', me.id);
        if (r.error) throw r.error;
        break;
      }
      case 'make_organizer': {
        mustOrganize(me);
        const id = str(b.memberId, 40);
        const { data: target } = await db().from('members').select('id').eq('trip_id', trip.id).eq('id', id).maybeSingle();
        if (!target || id === me.id) throw new HttpError(400, 'Pick someone else on the trip.');
        const a1 = await db().from('members').update({ is_organizer: true }).eq('id', id);
        if (a1.error) throw a1.error;
        const a2 = await db().from('members').update({ is_organizer: false }).eq('id', me.id);
        if (a2.error) throw a2.error;
        break;
      }
      case 'delete_trip': {
        mustOrganize(me);
        if (str(b.confirm, 80).trim().toLowerCase() !== trip.name.trim().toLowerCase()) throw new HttpError(400, 'Type the trip name exactly to delete it.');
        const r = await db().from('trips').delete().eq('id', trip.id);
        if (r.error) throw r.error;
        break;
      }
      case 'remove_member': {
        mustOrganize(me);
        const id = str(b.memberId, 40);
        if (id === me.id) throw new HttpError(400, "The organizer can't be removed.");
        const r = await db().from('members').delete().eq('trip_id', trip.id).eq('id', id);
        if (r.error) throw r.error;
        break;
      }
      case 'update_trip': {
        mustOrganize(me);
        const nights = int(b.nights, 1, 10, trip.nights);
        const r = await db().from('trips').update({
          name: str(b.name, 80) || trip.name,
          nights,
          food: int(b.food, 0, 100000, trip.food),
        }).eq('id', trip.id);
        if (r.error) throw r.error;
        break;
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
    if (pings.length || emails.length) {
      after(async () => {
        const { data: everyone } = await db().from('members').select('id').eq('trip_id', trip.id);
        const others = (everyone || []).map((m) => m.id).filter((id) => id !== me.id);
        for (const [who, msg, quiet] of pings) await notify(trip.id, who === 'others' ? others : who, msg, quiet);
        for (const [who, e] of emails) await emailMembers(who === 'others' ? others : who, e);
      });
    }
    return Response.json({ ok: true });
  });
}
