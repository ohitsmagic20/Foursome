import type { Kind, Member, Trip } from '@/lib/shared';
import { airport, bed, body, db, handle, HttpError, int, memberFromRequest, str, tripByCode } from '@/lib/server';

const KINDS: Kind[] = ['date', 'destination', 'lodging', 'round'];
const SINGLE_WINNER: Kind[] = ['date', 'destination', 'lodging'];
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
      return { start };
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
        day: int(d.day, 1, trip.nights + 1, 1),
        time: str(d.time, 12) || 'TBD',
        fee: int(d.fee, 0, 5000, 0),
        booked: d.booked === true,
        checked: str(d.checked, 24),
        // When the price was checked and which day of the week it was for (0 = Sunday, -1 = unknown).
        // These feed the shared greens-fee ranges other trips see.
        checkedAt: /^\d{4}-\d{2}-\d{2}T/.test(str(d.checkedAt, 30)) ? str(d.checkedAt, 30) : '',
        weekday: int(d.weekday, -1, 6, -1),
        url: url(d.url),
      };
    }
  }
}

async function optionFor(tripId: string, id: unknown) {
  const { data, error } = await db().from('options').select('id,kind,created_by,locked').eq('trip_id', tripId).eq('id', str(id, 40)).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'That option was removed. Pull down to refresh.');
  return data as { id: string; kind: Kind; created_by: string | null; locked: boolean };
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
        break;
      }
      case 'update_option': {
        const opt = await optionFor(trip.id, b.optionId);
        if (opt.created_by !== me.id && !me.is_organizer) throw new HttpError(403, 'Only the person who added this or the organizer can edit it.');
        const r = await db().from('options').update({ data: cleanData(opt.kind, b.data, trip) }).eq('id', opt.id);
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
        break;
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
      case 'set_paid': {
        mustOrganize(me);
        const r = await db().from('members').update({ paid: b.paid === true }).eq('trip_id', trip.id).eq('id', str(b.memberId, 40));
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
          deposit: int(b.deposit, 0, 100000, trip.deposit),
          food: int(b.food, 0, 100000, trip.food),
        }).eq('id', trip.id);
        if (r.error) throw r.error;
        break;
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
    return Response.json({ ok: true });
  });
}
