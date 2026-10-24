'use client';

import { useState } from 'react';
import type { CourseTee } from '@/lib/shared';

const SWATCH: Record<string, string> = {
  black: '#1b1b1b', blue: '#2563eb', white: '#ffffff', gold: '#d4a017', yellow: '#e8c547', red: '#d2372c', green: '#2c7a4b',
  silver: '#b9bec4', gray: '#9aa0a6', grey: '#9aa0a6', orange: '#e67e22', purple: '#7e57c2', copper: '#b87333', tan: '#d2b48c',
  burgundy: '#800020', maroon: '#800000', jade: '#00a86b', championship: '#1b1b1b',
};

/** Course rating and slope, one row per set of tees (longest first). */
export function TeeTable({ tees }: { tees: CourseTee[] }) {
  if (!tees.length) return null;
  return (
    <table className="tee-table">
      <thead><tr><th>Tees</th><th>Yards</th><th>Rating</th><th>Slope</th></tr></thead>
      <tbody>
        {tees.map((t) => {
          const swatch = SWATCH[t.color || ''] || SWATCH[t.name.toLowerCase()];
          return (
            <tr key={`${t.name}-${t.yards}`}>
              <td>{swatch && <i className="tee-dot" style={{ background: swatch }} aria-hidden="true" />}{t.name || 'Tee'}</td>
              <td>{t.yards ? t.yards.toLocaleString('en-US') : '–'}</td>
              <td>{t.rating.toFixed(1)}</td>
              <td>{t.slope}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The longest tees' yardage, rating and slope; tap to see every set of tees. */
export function TeeStats({ tees }: { tees: CourseTee[] }) {
  const [open, setOpen] = useState(false);
  if (!tees.length) return null;
  const back = tees[0];
  return (
    <div className="tee-stats">
      <button type="button" className="course-stats tee-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {back.yards > 0 && <span><b>{back.yards.toLocaleString('en-US')}</b> yds</span>}
        <span><b>{back.rating.toFixed(1)}</b> rating</span>
        <span><b>{back.slope}</b> slope</span>
        {tees.length > 1 && <span className="tee-more">{open ? 'Hide tees' : `All ${tees.length} tees`} <span aria-hidden="true">{open ? '▴' : '▾'}</span></span>}
      </button>
      {open && <TeeTable tees={tees} />}
    </div>
  );
}
