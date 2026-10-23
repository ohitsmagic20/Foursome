import { calendarKey, db, handle, HttpError, loadState, str, tripByCode } from '@/lib/server';
import type { DateData, DestinationData, LodgingData, Member } from '@/lib/shared';
import { addDays, isoDay, nightsOf, parseDay, pickOf, plannedRounds, teeMinutes } from '@/lib/shared';

export const dynamic = 'force-dynamic';

// The trip as a calendar file: the trip itself, every round in the plan, and this person's flights.
// Opening it on iPhone offers "Add All" to Calendar. GET /api/trips/{code}/calendar?m={memberId}&k={key}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const day = (iso: string) => iso.replace(/-/g, '');
const local = (iso: string, minutes: number) => `${day(iso)}T${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}00`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const q = new URL(req.url).searchParams;
    const trip = await tripByCode(code);
    const { data: row } = await db().from('members').select('id,token').eq('trip_id', trip.id).eq('id', str(q.get('m'), 40)).maybeSingle();
    if (!row || calendarKey(row.token) !== str(q.get('k'), 40)) throw new HttpError(404, 'This calendar link is not valid.');

    const state = await loadState(trip, null);
    const me = state.members.find((m) => m.id === row.id) as Member;
    const date = pickOf<DateData>(state, 'date').option;
    if (!date) throw new HttpError(400, 'The trip has no dates yet.');
    const dest = pickOf<DestinationData>(state, 'destination').option;
    const stay = pickOf<LodgingData>(state, 'lodging').option;
    const start = date.data.start;
    const where = dest?.data.name || '';
    const ev: string[] = [];
    const add = (uid: string, lines: string[]) => ev.push(['BEGIN:VEVENT', `UID:${uid}@foresome`, `DTSTAMP:${stamp()}`, ...lines, 'END:VEVENT'].join('\r\n'));

    add(`trip-${trip.code}`, [
      `DTSTART;VALUE=DATE:${day(start)}`,
      `DTEND;VALUE=DATE:${day(isoDay(addDays(parseDay(start), nightsOf(trip, date.data) + 1)))}`,
      `SUMMARY:${esc(`⛳ ${trip.name}${where ? ` · ${where}` : ''}`)}`,
      ...(stay ? [`DESCRIPTION:${esc(`Staying at ${stay.data.name}${stay.data.url ? `\n${stay.data.url}` : ''}`)}`] : []),
      ...(where ? [`LOCATION:${esc(where)}`] : []),
    ]);
    for (const r of plannedRounds(state)) {
      const d = isoDay(addDays(parseDay(start), r.data.day - 1));
      const t = teeMinutes(r.data.time);
      add(`round-${r.id}`, [
        `DTSTART:${local(d, t)}`,
        `DTEND:${local(d, Math.min(t + 300, 23 * 60 + 59))}`,
        `SUMMARY:${esc(`Tee time · ${r.data.course}`)}`,
        `LOCATION:${esc(`${r.data.course}${where ? `, ${where}` : ''}`)}`,
        `DESCRIPTION:${esc(`${r.data.time} first tee time${r.data.booked ? ' (booked)' : ' (not booked yet)'}`)}`,
      ]);
    }
    const flight = (iso: string | null, label: string, id: string) => {
      if (!iso) return;
      const [d, hm] = iso.split('T');
      const [h, mi] = hm.split(':').map(Number);
      add(`${id}-${me.id}`, [`DTSTART:${local(d, h * 60 + mi)}`, `DTEND:${local(d, Math.min(h * 60 + mi + 30, 23 * 60 + 59))}`, `SUMMARY:${esc(label)}`, ...(me.flight_summary ? [`DESCRIPTION:${esc(me.flight_summary)}`] : [])]);
    };
    flight(me.flight_arrive_at, `✈️ You land${dest ? ` at ${dest.data.airport}` : ''}`, 'arrive');
    flight(me.flight_depart_at, '✈️ Flight home', 'depart');

    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Foresome//Golf trip//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip.name)}`, ...ev, 'END:VCALENDAR'].join('\r\n');
    return new Response(body, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${trip.code}.ics"`, 'Cache-Control': 'no-store' },
    });
  });
}
