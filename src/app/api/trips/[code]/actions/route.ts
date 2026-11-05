import { after } from 'next/server';
import type { Kind, LodgingData, Member, Trip } from '@/lib/shared';
import type { DateData } from '@/lib/shared';
import { autoRooms, nightsOf, openVotes, payHandle, rangeLabel } from '@/lib/shared';
import { airport, bed, body, db, handle, HttpError, int, loadState, logError, memberFromRequest, firstIn, rateLimit, str, tripByCode } from '@/lib/server';
import { notify, type PushMessage } from '@/lib/push';
import { DEADLINE_KINDS, DECISION, type DeadlineKind } from '@/lib/deadlines';
import { ideaBySlug } from '@/lib/ideas';
import { typicalFee } from '@/data/templates';
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
        ...(d.booked === true ? { booked: true } : {}),
        ...(str(d.owner, 40) ? { owner: str(d.owner, 40) } : {}),
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
        ...(str(d.owner, 40) ? { owner: str(d.owner, 40) } : {}),
        checked: str(d.checked, 24),
        // When the price was checked and which day of the week it was for (0 = Sunday, -1 = unknown).
        // These feed the shared greens-fee ranges other trips see.
        checkedAt: /^\d{4}-\d{2}-\d{2}T/.test(str(d.checkedAt, 30)) ? str(d.checkedAt, 30) : '',
        weekday: int(d.weekday, -1, 6, -1),
        url: url(d.url),
        ...(Array.isArray(d.groups) ? { groups: cleanGroups(d.groups) } : {}),
        ...(typeof d.fromTemplate === 'string' && d.fromTemplate ? { fromTemplate: str(d.fromTemplate, 60) } : {}),
        // Picked from the course database.
        ...(/^[0-9a-f-]{36}$/i.test(str(d.courseId, 40)) ? {
          courseId: str(d.courseId, 40),
          lat: Number.isFinite(Number(d.lat)) ? Math.max(-90, Math.min(90, Number(d.lat))) : undefined,
          lon: Number.isFinite(Number(d.lon)) ? Math.max(-180, Math.min(180, Number(d.lon))) : undefined,
          access: ['public', 'semi-private', 'private', 'resort', 'municipal'].includes(String(d.access)) ? String(d.access) : '',
          where: str(d.where, 80),
        } : {}),
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
      case 'add_idea_rounds': {
        // Every round from a trip idea at once, as suggestions with my yes. Skips courses already on the list.
        const tpl = await ideaBySlug(str(b.slug, 60));
        if (!tpl) throw new HttpError(404, 'That trip idea isn’t available.');
        const { data: existing } = await db().from('options').select('data').eq('trip_id', trip.id).eq('kind', 'round');
        const have = new Set((existing || []).map((o) => String((o.data as { course?: string }).course || '').toLowerCase()));
        const days = nightsOf(trip) + 1;
        const fresh = tpl.rounds.filter((r) => !have.has(r.course.toLowerCase())).slice(0, Math.max(0, MAX_OPTIONS - (existing?.length || 0)));
        if (!fresh.length) throw new HttpError(400, 'Those courses are already on the list.');
        const rows = fresh.map((r) => ({
          trip_id: trip.id, kind: 'round', created_by: me.id,
          data: {
            course: r.course, day: Math.min(r.day, days), time: r.time, fee: typicalFee(r.fee), booked: false,
            checked: r.fee.verified ? `${r.fee.asOf} (trip idea)` : 'estimate (trip idea)', checkedAt: '', weekday: -1,
            url: r.url || '', fromTemplate: tpl.slug, ...(r.courseId ? { courseId: r.courseId } : {}),
          },
        }));
        const { data: added, error } = await db().from('options').insert(rows).select('id');
        if (error) throw error;
        if (added?.length) await db().from('votes').insert(added.map((o) => ({ option_id: o.id, member_id: me.id, value: 'yes' })));
        pings.push(['others', { title: trip.name, body: `${first(me.name)} suggested ${fresh.length} rounds from the ${tpl.name} trip idea. Are you in?`, url: url('golf'), tag: 'new-round' }, 15]);
        break;
      }
      case 'update_option': {
        const opt = await optionFor(trip.id, b.optionId);
        if (opt.created_by !== me.id && !me.is_organizer) throw new HttpError(403, 'Only the person who added this or the organizer can edit it.');
        const data = cleanData(opt.kind, b.data, trip);
        // Editing a round's course or time keeps its pairings, and editing a place keeps who's booking it.
        if (opt.kind === 'round' && !('groups' in data) && Array.isArray(opt.data.groups)) data.groups = opt.data.groups;
        const raw = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
        for (const k of ['owner', 'booked', 'confirmation', 'rooms'] as const) if (!(k in raw) && opt.data[k] !== undefined) data[k] = opt.data[k];
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
        if (lock && trip.deadlines?.[opt.kind as DeadlineKind]) {
          const next = { ...trip.deadlines };
          delete next[opt.kind as DeadlineKind];
          await db().from('trips').update({ deadlines: next }).eq('id', trip.id);
        }
        if (lock) {
          const what = label(opt.kind, opt.data, trip);
          const text = opt.kind === 'round' ? `${what} is in the plan.` : opt.kind === 'lodging' ? `You’re staying at ${what}.` : `${what} is locked in.`;
          pings.push(['others', { title: trip.name, body: text, url: url(TAB[opt.kind]), tag: `lock-${opt.kind}` }, 0]);
          // One email per decision type per 30 minutes, so locking and unlocking doesn't flood inboxes.
          if (SINGLE_WINNER.includes(opt.kind) && await firstIn(`lockmail:${trip.id}:${opt.kind}`, 30)) {
            const next = opt.kind === 'date' || opt.kind === 'destination' ? 'Time to look at flights.' : 'Check the cost per person on the trip’s Home tab.';
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
      case 'share_idea': {
        // Share the trip as a trip idea for other groups: destination, courses, tee times and prices. No names.
        mustOrganize(me);
        const state = await loadState(trip, null);
        const date = state.options.find((o) => o.kind === 'date' && o.locked);
        const dest = state.options.find((o) => o.kind === 'destination' && o.locked);
        const rounds = state.options.filter((o) => o.kind === 'round' && o.locked);
        if (!date || !dest || rounds.length < 2) throw new HttpError(400, 'Lock the dates and destination and put at least 2 rounds in the plan first.');
        const dd = date.data as { start: string; nights?: number }, de = dest.data as { name: string; airport?: string; airports?: string[] };
        const nights = dd.nights || trip.nights;
        const stay = state.options.find((o) => o.kind === 'lodging' && o.locked);
        const total = stay ? Number((stay.data as { total?: number }).total) || 0 : 0;
        const start = new Date(`${dd.start}T12:00:00`);
        const idea = {
          destination: str(de.name, 80),
          airports: (de.airports?.length ? de.airports : de.airport ? [de.airport] : []).slice(0, 4),
          nights,
          month: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          group: state.members.length,
          rounds: rounds.map((o) => o.data as Record<string, unknown>).sort((a, b) => Number(a.day) - Number(b.day)).slice(0, 12).map((r) => ({
            day: int(r.day, 1, 15, 1), time: str(r.time, 12), course: str(r.course, 100), fee: int(r.fee, 0, 5000, 0),
            ...(typeof r.courseId === 'string' ? { courseId: r.courseId } : {}),
            ...(typeof r.access === 'string' && r.access ? { access: r.access } : {}),
          })),
          lodgingPerNight: total && state.members.length ? Math.round(total / state.members.length / nights) : 0,
        };
        const r = await db().from('trip_ideas').upsert({ trip_id: trip.id, data: idea }, { onConflict: 'trip_id' }).select('id').single();
        if (r.error) throw r.error;
        return Response.json({ ok: true, id: r.data.id });
      }
      case 'unshare_idea': {
        mustOrganize(me);
        const r = await db().from('trip_ideas').delete().eq('trip_id', trip.id);
        if (r.error) throw r.error;
        break;
      }
      case 'rooms': {
        // Who sleeps where in the locked stay. Anyone can move themselves; the organizer can auto-assign or clear.
        const { data: stay } = await db().from('options').select('id,data').eq('trip_id', trip.id).eq('kind', 'lodging').eq('locked', true).maybeSingle();
        if (!stay) throw new HttpError(400, 'Lock in a place to stay first.');
        const d = stay.data as LodgingData;
        const n = Math.min(20, Math.max(1, d.bedrooms || 1));
        const { data: everyone } = await db().from('members').select('id,name,bed').eq('trip_id', trip.id);
        const ids = new Set((everyone || []).map((m) => m.id));
        let rooms: string[][] = Array.from({ length: n }, (_, i) => (d.rooms?.[i] || []).filter((id) => ids.has(id)));
        const op = str(b.op, 10);
        if (op === 'auto' || op === 'clear') {
          mustOrganize(me);
          rooms = op === 'auto' ? autoRooms((everyone || []) as Member[], n) : Array.from({ length: n }, () => []);
        } else if (op === 'move') {
          const to = int(b.room, -1, n - 1, -1);
          rooms = rooms.map((r) => r.filter((id) => id !== me.id));
          if (to >= 0) rooms[to].push(me.id);
        } else throw new HttpError(400, 'Unknown rooms change.');
        const r = await db().from('options').update({ data: { ...d, rooms } }).eq('id', stay.id);
        if (r.error) throw r.error;
        if (op === 'auto') pings.push(['others', { title: trip.name, body: `${first(me.name)} assigned rooms at ${d.name}. See where you’re sleeping.`, url: url('stay'), tag: 'rooms' }, 0]);
        break;
      }
      case 'set_booking': {
        // Who books a locked place or a planned round, and whether it's booked. The organizer assigns;
        // the person assigned (or the organizer) marks it booked.
        const opt = await optionFor(trip.id, b.optionId);
        if (!opt.locked || (opt.kind !== 'lodging' && opt.kind !== 'round')) throw new HttpError(400, 'Lock it in before assigning who books it.');
        const next = { ...opt.data };
        if ('owner' in b) {
          mustOrganize(me);
          const owner = str(b.owner, 40);
          if (owner) {
            const { data: who } = await db().from('members').select('id,name').eq('trip_id', trip.id).eq('id', owner).maybeSingle();
            if (!who) throw new HttpError(400, 'Pick someone on the trip.');
            next.owner = owner;
            if (owner !== me.id) {
              const what = opt.kind === 'round' ? `${opt.data.course} at ${opt.data.time}` : String(opt.data.name || 'the place to stay');
              pings.push([[owner], { title: trip.name, body: `${first(me.name)} asked you to book ${what}.`, url: url(TAB[opt.kind]), tag: `book-${opt.id}` }, 0]);
            }
          } else delete next.owner;
        }
        let paid = 0;
        if ('booked' in b) {
          if (!me.is_organizer && opt.data.owner !== me.id) throw new HttpError(403, 'Only the person booking it or the organizer can mark it booked.');
          next.booked = b.booked === true;
          if (next.booked) {
            // Booking details: the confirmed time (courses often shift it), a confirmation number,
            // and what the booker paid for the group, which goes straight into settle up.
            const conf = str(b.confirmation, 40);
            if (conf) next.confirmation = conf; else delete next.confirmation;
            const time = str(b.time, 12).toUpperCase().replace(/\s*(AM|PM)$/, ' $1');
            if (opt.kind === 'round' && /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/.test(time)) next.time = time;
            paid = Math.round(Number(b.paid) * 100) / 100;
            if (!(paid > 0 && paid < 1000000)) paid = 0;
          }
        }
        const r = await db().from('options').update({ data: next }).eq('id', opt.id);
        if (r.error) throw r.error;
        if (paid) {
          const what = opt.kind === 'round' ? `${opt.data.course} tee times` : String(opt.data.name || 'The stay');
          const payer = str(next.owner, 40) || me.id;
          // Re-marking a booking shouldn't log the same payment twice.
          const { data: dup } = await db().from('expenses').select('id').eq('trip_id', trip.id).eq('paid_by', payer).eq('amount', paid).eq('note', what.slice(0, 80)).limit(1);
          if (!dup?.length) {
            const e = await db().from('expenses').insert({ trip_id: trip.id, paid_by: payer, amount: paid, note: what.slice(0, 80), split_with: [] });
            if (e.error) throw e.error;
          }
        }
        if (next.booked && b.booked === true && !opt.data.booked) {
          const what = opt.kind === 'round' ? `${opt.data.course} at ${next.time}` : String(opt.data.name || 'the place to stay');
          pings.push(['others', { title: trip.name, body: `${first(me.name)} booked ${what}.${paid ? ` Paid ${'$'}${Math.round(paid).toLocaleString('en-US')} for the group; it’s in settle up.` : ''}`, url: url(TAB[opt.kind]), tag: `booked-${opt.id}` }, 0]);
        }
        break;
      }
      case 'update_me': {
        const r = await db().from('members').update({
          name: str(b.name, 60) || me.name,
          airport: airport(b.airport),
          budget: int(b.budget, 0, 100000, me.budget),
          bed: bed(b.bed),
          ...('venmo' in b ? { venmo: payHandle(b.venmo) } : {}),
          ...('cashapp' in b ? { cashapp: payHandle(b.cashapp) } : {}),
        }).eq('id', me.id);
        if (r.error) throw r.error;
        break;
      }
      case 'set_deadline': {
        mustOrganize(me);
        const kind = String(b.kind) as DeadlineKind;
        if (!DEADLINE_KINDS.includes(kind)) throw new HttpError(400, 'Deadlines are for dates, destination and the stay.');
        const next = { ...(trip.deadlines || {}) };
        if (b.at === null || b.at === '') delete next[kind];
        else {
          const at = Date.parse(String(b.at));
          if (!Number.isFinite(at) || at < Date.now() + 30 * 60000 || at > Date.now() + 180 * 864e5) throw new HttpError(400, 'Pick a day between tomorrow and six months from now.');
          next[kind] = new Date(at).toISOString();
          const day = new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: str(b.tz, 60) || 'America/Chicago' });
          pings.push(['others', { title: trip.name, body: `Voting on ${DECISION[kind]} closes ${day}. Get your vote in.`, url: url(TAB[kind]), tag: `deadline-${kind}` }, 0]);
        }
        const r = await db().from('trips').update({ deadlines: next }).eq('id', trip.id);
        if (r.error) {
          if (/deadlines/.test(r.error.message)) {
            await logError('server', 'Run supabase/007_deadlines_booked.sql: trips.deadlines is missing', `/t/${trip.code}`);
            throw new HttpError(503, 'Deadlines need a quick database update. The app owner has been told.');
          }
          throw r.error;
        }
        break;
      }
      case 'set_blackout': {
        const dates = Array.isArray(b.dates) ? b.dates : [];
        const clean = [...new Set(dates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(0, 60);
        const r = await db().from('members').update({ blackout: clean }).eq('id', me.id);
        if (r.error) {
          if (/blackout/.test(r.error.message)) {
            await logError('server', 'Run supabase/006_availability_feedback.sql: members.blackout is missing', `/t/${trip.code}`);
            throw new HttpError(503, 'Availability needs a quick database update. The app owner has been told.');
          }
          throw r.error;
        }
        break;
      }
      case 'add_expense': {
        const amount = Math.round(Number(b.amount) * 100) / 100;
        if (!(amount > 0 && amount < 1000000)) throw new HttpError(400, 'Enter the amount paid.');
        const { data: everyone } = await db().from('members').select('id').eq('trip_id', trip.id);
        const ids = new Set((everyone || []).map((m) => m.id));
        const paidBy = ids.has(str(b.paidBy, 40)) ? str(b.paidBy, 40) : me.id;
        const split = (Array.isArray(b.splitWith) ? b.splitWith : []).map((x) => str(x, 40)).filter((x) => ids.has(x));
        const { count } = await db().from('expenses').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id);
        if ((count || 0) >= 300) throw new HttpError(400, 'This trip has a lot of expenses already.');
        const r = await db().from('expenses').insert({
          trip_id: trip.id, paid_by: paidBy, amount, note: str(b.note, 80),
          split_with: split.length === ids.size ? [] : [...new Set(split)],
        });
        if (r.error) throw r.error;
        break;
      }
      case 'delete_expense': {
        const { data: e } = await db().from('expenses').select('id,paid_by').eq('trip_id', trip.id).eq('id', str(b.expenseId, 40)).maybeSingle();
        if (!e) throw new HttpError(404, 'That expense was already removed.');
        if (e.paid_by !== me.id && !me.is_organizer) throw new HttpError(403, 'Only the person who paid or the organizer can remove it.');
        const r = await db().from('expenses').delete().eq('id', e.id);
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
        // A newly picked flight isn't bought yet. (Ignored before migration 007.)
        if (b.newPick) await db().from('members').update({ flight_booked: false }).eq('id', me.id);
        break;
      }
      case 'clear_flight': {
        const r = await db().from('members').update({ flight_price: null, flight_summary: null, flight_arrive_at: null, flight_depart_at: null }).eq('id', me.id);
        if (r.error) throw r.error;
        await db().from('members').update({ flight_booked: false }).eq('id', me.id);
        break;
      }
      case 'set_flight_booked': {
        const r = await db().from('members').update({ flight_booked: b.booked === true }).eq('id', me.id);
        if (r.error) {
          if (/flight_booked/.test(r.error.message)) {
            await logError('server', 'Run supabase/007_deadlines_booked.sql: members.flight_booked is missing', `/t/${trip.code}`);
            throw new HttpError(503, 'This needs a quick database update. The app owner has been told.');
          }
          throw r.error;
        }
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
