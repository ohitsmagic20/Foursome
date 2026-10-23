import { body, handle, HttpError, str } from '@/lib/server';

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
    if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, 'Use a link that starts with https://');
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || !u.hostname.includes('.')) {
      throw new HttpError(400, 'That link is not a public website.');
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(u.toString(), {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForesomeLinkPreview/1.0)', Accept: 'text/html' },
      });
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
