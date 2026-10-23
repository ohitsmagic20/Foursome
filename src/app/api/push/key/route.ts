import { vapidKeys } from '@/lib/push';
import { handle } from '@/lib/server';

export const dynamic = 'force-dynamic';

// The public key a phone needs to subscribe to notifications.
export function GET() {
  return handle(async () => Response.json({ key: (await vapidKeys()).publicKey }));
}
