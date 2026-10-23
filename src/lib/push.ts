import 'server-only';
import webpush from 'web-push';
import { db } from './server';

// Web push for phones that added Foursome to the home screen. The signing keys (VAPID) are created
// once and kept in the database, so there is nothing to configure in Vercel.

let keys: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
  if (keys) return keys;
  const { data } = await db().from('app_settings').select('key,value').in('key', ['vapid_public', 'vapid_private']);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  if (get('vapid_public') && get('vapid_private')) {
    keys = { publicKey: get('vapid_public')!, privateKey: get('vapid_private')! };
  } else {
    const k = webpush.generateVAPIDKeys();
    // ignoreDuplicates: if two requests race, the first saved pair wins and we re-read it.
    await db().from('app_settings').upsert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }], { onConflict: 'key', ignoreDuplicates: true });
    keys = null;
    const again = await db().from('app_settings').select('key,value').in('key', ['vapid_public', 'vapid_private']);
    const g = (x: string) => again.data?.find((r) => r.key === x)?.value || '';
    keys = { publicKey: g('vapid_public'), privateKey: g('vapid_private') };
  }
  return keys;
}

export interface PushMessage { title: string; body: string; url: string; tag?: string }

/** Send to members of a trip. `quietMinutes` skips phones that got a notification very recently. */
export async function notify(tripId: string, memberIds: string[], msg: PushMessage, quietMinutes = 0): Promise<number> {
  if (!memberIds.length) return 0;
  const { data: subs, error } = await db().from('push_subs').select('endpoint,sub,last_sent').eq('trip_id', tripId).in('member_id', memberIds);
  if (error || !subs?.length) return 0;
  const k = await vapidKeys();
  webpush.setVapidDetails('mailto:support@foursome.app', k.publicKey, k.privateKey);
  const now = Date.now();
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    if (quietMinutes && s.last_sent && now - Date.parse(s.last_sent) < quietMinutes * 60000) return;
    try {
      await webpush.sendNotification(s.sub as webpush.PushSubscription, JSON.stringify(msg), { TTL: 60 * 60 * 24 });
      sent++;
      await db().from('push_subs').update({ last_sent: new Date().toISOString() }).eq('endpoint', s.endpoint).eq('trip_id', tripId);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db().from('push_subs').delete().eq('endpoint', s.endpoint); // phone unsubscribed
    }
  }));
  return sent;
}
