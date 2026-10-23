import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { body, handle, HttpError, str } from '@/lib/server';

export const runtime = 'nodejs';

/** True for addresses that aren't on the public internet (loopback, private, link-local, cloud metadata, etc.). */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
}

/** Only public websites: checks every address the name resolves to, before each hop of a redirect. */
async function assertPublic(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, 'Use a link that starts with https://');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') && !isIP(host)) throw new HttpError(400, 'That link is not a public website.');
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length || addrs.some(privateAddress)) throw new HttpError(400, 'That link is not a public website.');
}

// Best-effort title and photo for a pasted Airbnb, Vrbo or hotel link, read from the page's
// public share tags (the same ones a text message preview uses). Many sites block this,
// so the app always lets people type the details themselves.
export function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const raw = str(b.url, 500);
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new HttpError(400, 'That does not look like a link.');
    }
    await assertPublic(u);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      // Follow up to 4 redirects by hand, checking each new address is public.
      let res: Response | null = null;
      let target = u;
      for (let hop = 0; hop < 5; hop++) {
        res = await fetch(target.toString(), {
          signal: ctrl.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForesomeLinkPreview/1.0)', Accept: 'text/html' },
        });
        const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!next) break;
        target = new URL(next, target);
        await assertPublic(target);
      }
      if (!res) return Response.json({ title: '', image: '' });
      if (!res.ok) return Response.json({ title: '', image: '' });
      const html = (await res.text()).slice(0, 300000);
      const meta = (prop: string) => {
        const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
        const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
        return (html.match(re) || html.match(re2) || [])[1] || '';
      };
      const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const title = decode(meta('og:title') || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '').trim().slice(0, 100);
      const image = decode(meta('og:image'));
      return Response.json({ title, image: /^https:\/\//.test(image) ? image : '' });
    } catch {
      return Response.json({ title: '', image: '' });
    } finally {
      clearTimeout(timer);
    }
  });
}
