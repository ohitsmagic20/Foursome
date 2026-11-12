'use client';

import { useEffect, useState } from 'react';
import type { DestinationData } from '@/lib/shared';
import { lockedOf, money, optionsOf, placePlan, tally } from '@/lib/shared';
import { api } from '@/lib/client';
import { useTrip } from './ui';

interface Row {
  id: string; name: string; avgHours: number | null; driving: number; counted: number;
  longest: { name: string; from: string; hours: number } | null;
  golf: { low: number; high: number; idea: string } | null;
  stayPerNight: { low: number; high: number } | null;
}

const hrs = (h: number) => `~${h % 1 ? h.toFixed(1) : h}h`;
const range = (a: number, b: number) => (a === b ? `$${a}` : `$${a}–${b}`);

/** The suggested destinations side by side: votes, how far the group flies, typical golf and stay. */
export function CompareDestinations() {
  const { state } = useTrip();
  const dests = optionsOf<DestinationData>(state, 'destination');
  const locked = lockedOf(state, 'destination');
  const key = dests.map((d) => d.id).join() + '|' + state.members.map((m) => m.airport).join();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (dests.length < 2 || locked) return;
    let live = true;
    api<{ rows: Row[] }>(`/api/trips/${state.trip.code}/compare`, { code: state.trip.code }).then((r) => live && setRows(r.rows)).catch(() => live && setRows(null));
    return () => { live = false; };
  }, [key, locked, dests.length, state.trip.code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (dests.length < 2 || locked || !rows) return null;
  const n = state.members.length;
  const sorted = rows.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score);
  const plans = new Map(rows.map((r) => [r.id, placePlan(state, r.id)]));
  const anyPlan = [...plans.values()].some((p) => p.each > 0);
  const anyCost = !anyPlan && rows.some((r) => r.golf || r.stayPerNight);
  return (
    <div className="card compare">
      <div className="row-title">Side by side</div>
      <div className="scroll">
        <table className="sc compare-table">
          <thead><tr><th className="name">Place</th><th className="num">In</th><th className="num">Flight</th>{anyPlan && <th className="num">Stay + golf</th>}{anyCost && <th className="num">Golf</th>}</tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="name">
                  <div className="compare-place">{r.name.split(',')[0]}</div>
                  <div className="row-meta">{r.longest ? `Longest: ${r.longest.name} from ${r.longest.from}, ${hrs(r.longest.hours)}` : r.counted ? 'Everyone can drive' : 'Add home airports'}{r.driving ? ` · ${r.driving} can drive` : ''}</div>
                </td>
                <td className="num">{tally(state, r.id).yes}/{n}</td>
                <td className="num">{r.avgHours !== null ? hrs(r.avgHours) : '—'}</td>
                {anyPlan && <td className="num">{plans.get(r.id)!.each ? money(plans.get(r.id)!.each) : <span className="row-meta">—</span>}</td>}
                {anyCost && <td className="num">{r.golf ? range(r.golf.low, r.golf.high) : <span className="row-meta">—</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Flight is the average time in the air from everyone’s home airport, estimated from distance; connections add more.{anyPlan ? ' Stay + golf is each person’s share of that place’s leading stay and rounds.' : anyCost ? ' Golf is the usual price per round at courses from our trip ideas.' : ''}</p>
    </div>
  );
}
