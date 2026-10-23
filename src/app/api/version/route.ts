export const dynamic = 'force-dynamic';

// The build this server is running; the app compares it with its own to offer an update.
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD || 'dev' }, { headers: { 'Cache-Control': 'no-store' } });
}
