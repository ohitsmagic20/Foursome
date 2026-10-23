import { body, db, handle, HttpError, memberFromRequest, str, tripByCode } from '@/lib/server';

// Turn notifications on (POST with the phone's subscription) or off (DELETE) for this trip.
export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id, true);
    const sub = (await body(req)).subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
    const endpoint = str(sub?.endpoint, 1000);
    if (!/^https:\/\//.test(endpoint) || !sub?.keys?.p256dh || !sub.keys.auth) throw new HttpError(400, 'That notification subscription looks incomplete.');
    const r = await db().from('push_subs').upsert({ endpoint, member_id: me.id, trip_id: trip.id, sub: { endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } } }, { onConflict: 'endpoint,trip_id' });
    if (r.error) throw r.error;
    return Response.json({ ok: true });
  });
}

export function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id, true);
    await db().from('push_subs').delete().eq('trip_id', trip.id).eq('member_id', me.id);
    return Response.json({ ok: true });
  });
}
