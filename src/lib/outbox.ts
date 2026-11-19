/**
 * Score taps made with no signal: kept on this phone (localStorage) and sent, in order, once it's back.
 * Each item has a key so a later tap on the same hole replaces the earlier one instead of piling up.
 */
export interface OutboxItem { key: string; body: Record<string, unknown>; at: number }

const K = (code: string) => `foresome:outbox:${code}`;
const EVENT = 'foresome-outbox';

export function readOutbox(code: string): OutboxItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(K(code)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function write(code: string, items: OutboxItem[]) {
  try {
    if (items.length) localStorage.setItem(K(code), JSON.stringify(items));
    else localStorage.removeItem(K(code));
  } catch { /* private mode: the tap still shows until the page closes */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
}

/** Queue an action. Clearing a whole match drops that match's queued holes, since they'd be wiped anyway. */
export function enqueue(code: string, key: string, body: Record<string, unknown>) {
  let items = readOutbox(code).filter((i) => i.key !== key);
  if (body.op === 'clear_match') items = items.filter((i) => i.body.match !== body.match);
  items.push({ key, body, at: Date.now() });
  write(code, items);
}

export function removeFromOutbox(code: string, key: string, at: number) {
  write(code, readOutbox(code).filter((i) => !(i.key === key && i.at === at)));
}

export function onOutboxChange(fn: () => void): () => void {
  const h = () => fn();
  window.addEventListener(EVENT, h);
  window.addEventListener('storage', h);
  return () => { window.removeEventListener(EVENT, h); window.removeEventListener('storage', h); };
}

/** The queue key for an action that can wait for signal, or null if it has to go now. */
export function queueKey(type: string, p: Record<string, unknown>): string | null {
  if (type === 'game') {
    if (p.op === 'skin') return `game:${p.id}:skin:${p.hole}`;
    if (p.op === 'prize') return `game:${p.id}:prize:${p.index}`;
    if (p.op === 'bet') return `game:${p.id}:bet:${p.bet}`;
    return null;
  }
  if (type !== 'cup') return null;
  if (p.op === 'hole') return `hole:${p.match}:${p.hole}`;
  if (p.op === 'result') return `result:${p.match}`;
  if (p.op === 'clear_match') return `clear:${p.match}`;
  return null;
}
