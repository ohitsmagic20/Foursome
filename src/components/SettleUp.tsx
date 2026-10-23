'use client';

import { useState } from 'react';
import type { Expense } from '@/lib/shared';
import { cashAppLink, money, settleUp, venmoLink } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { Icon, useTrip, type TripCtx } from './ui';
import { meSheet } from './sheets';

const cents = (n: number) => (Number.isInteger(n) ? money(n) : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** Who paid what for the group, and the fewest payments to even it out. */
export function SettleUp() {
  const ctx = useTrip();
  const { state, me, act } = ctx;
  const expenses = state.expenses || [];
  const { payments, balance, total } = settleUp(state);
  const name = (id: string) => firstName(state.members.find((m) => m.id === id)?.name || 'Someone');
  const member = (id: string) => state.members.find((m) => m.id === id);
  const mine = me ? balance.get(me.id) || 0 : 0;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Settle up</h2>
        <button className="btn small" onClick={() => expenseSheet(ctx)}>{Icon.plus} Expense</button>
      </div>

      {expenses.length === 0 ? (
        <button className="card empty dashed" onClick={() => expenseSheet(ctx)}>Log what people paid for the group, like the house or a dinner.</button>
      ) : (
        <>
          {payments.length > 0 ? (
            <div className="list">
              {payments.map((p, i) => {
                const to = member(p.to);
                const note = `${state.trip.name}`;
                const toMe = p.to === me?.id, fromMe = p.from === me?.id;
                return (
                  <div className="row" key={i}>
                    <div className="grow">
                      <div className="row-title">{fromMe ? 'You pay' : `${name(p.from)} pays`} {toMe ? 'you' : name(p.to)}</div>
                      {fromMe && !to?.venmo && !to?.cashapp && <div className="row-meta">Ask {name(p.to)} to add Venmo or Cash App to their details.</div>}
                    </div>
                    <span className="settle-amt">{cents(p.amount)}</span>
                    {fromMe && to?.venmo && <a className="btn small" href={venmoLink(to.venmo, p.amount, note)} target="_blank" rel="noopener noreferrer">Venmo</a>}
                    {fromMe && to?.cashapp && <a className="btn small" href={cashAppLink(to.cashapp, p.amount)} target="_blank" rel="noopener noreferrer">Cash App</a>}
                  </div>
                );
              })}
            </div>
          ) : <p className="sub">Everyone’s even.</p>}

          <details className="expenses">
            <summary>{expenses.length} expense{expenses.length > 1 ? 's' : ''} · {cents(total)} total{me ? ` · ${mine > 0.004 ? `you’re owed ${cents(mine)}` : mine < -0.004 ? `you owe ${cents(-mine)}` : 'you’re even'}` : ''}</summary>
            <div className="list">
              {expenses.slice().reverse().map((e) => <ExpenseRow key={e.id} e={e} />)}
            </div>
          </details>
          {me && !me.venmo && !me.cashapp && (
            <p className="hint">Add your Venmo or Cash App so people can pay you back in one tap. <button className="link-btn" onClick={() => meSheet(ctx)}>Add it</button></p>
          )}
        </>
      )}
    </section>
  );

  function ExpenseRow({ e }: { e: Expense }) {
    const among = e.split_with.length ? e.split_with.length : state.members.length;
    const canRemove = me && (me.id === e.paid_by || me.is_organizer);
    return (
      <div className="row">
        <div className="grow">
          <div className="row-title">{e.note || 'Expense'}</div>
          <div className="row-meta">{name(e.paid_by)} paid · split {among === state.members.length ? 'with everyone' : `${among} ways`}</div>
        </div>
        <span className="settle-amt">{cents(e.amount)}</span>
        {canRemove && <button className="btn small ghost" aria-label="Remove expense" onClick={() => act('delete_expense', { expenseId: e.id })}>Remove</button>}
      </div>
    );
  }
}

function ExpenseForm({ ctx }: { ctx: TripCtx }) {
  const { state, me } = ctx;
  const [paidBy, setPaidBy] = useState(me?.id || '');
  const [split, setSplit] = useState<string[]>(state.members.map((m) => m.id));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const each = split.length && Number(amount) > 0 ? Number(amount) / split.length : 0;
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      if (await ctx.act('add_expense', { amount: Number(amount), note, paidBy, splitWith: split })) { ctx.sheet(null); ctx.toast('Expense added'); }
      setBusy(false);
    }}>
      <div className="grid2">
        <div className="field">
          <label htmlFor="x-amount">Amount ($)</label>
          <input id="x-amount" type="number" inputMode="decimal" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="640" />
        </div>
        <div className="field">
          <label htmlFor="x-paid">Paid by</label>
          <select id="x-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {state.members.map((m) => <option key={m.id} value={m.id}>{m.id === me?.id ? 'Me' : m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="x-note">What for</label>
        <input id="x-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="The house, Saturday dinner…" maxLength={80} />
      </div>
      <div className="field">
        <label>Split between {each ? <span style={{ fontWeight: 500 }}>· {cents(Math.round(each * 100) / 100)} each</span> : null}</label>
        <div className="split-list">
          {state.members.map((m) => (
            <label key={m.id} className="split-item">
              <input type="checkbox" checked={split.includes(m.id)} onChange={(e) => setSplit(e.target.checked ? [...split, m.id] : split.filter((x) => x !== m.id))} />
              {firstName(m.name)}
            </label>
          ))}
        </div>
      </div>
      <button className="btn primary block" disabled={busy || !split.length}>{busy ? <span className="spinner" /> : 'Add expense'}</button>
    </form>
  );
}

export function expenseSheet(ctx: TripCtx) {
  ctx.sheet({ title: 'Add an expense', body: <ExpenseForm ctx={ctx} /> });
}
