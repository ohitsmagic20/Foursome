// App icon artwork: a pin flag on a green. Used by app/icon.tsx and app/apple-icon.tsx.
export function FlagMark({ s }: { s: number }) {
  return (
    <div style={{ width: s, height: s, background: '#1e5a3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M7 21V3" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 3.6h10.5l-2.8 3.7 2.8 3.7H7z" fill="#d9a62e" />
        <ellipse cx="9.5" cy="21" rx="6.5" ry="1.4" fill="#ffffff" opacity="0.35" />
      </svg>
    </div>
  );
}
