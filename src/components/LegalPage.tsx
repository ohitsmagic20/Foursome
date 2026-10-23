import type { ReactNode } from 'react';

// Shared layout for the privacy policy and terms.
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="app no-tabs legal">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/" style={{ textDecoration: 'none' }}>‹ Foresome</a>
          <h1>{title}</h1>
          <p className="sub" style={{ marginTop: 6 }}>Last updated {updated}</p>
        </div>
      </header>
      <main className="legal-body">{children}</main>
    </div>
  );
}
