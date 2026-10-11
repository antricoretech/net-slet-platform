'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
interface Examination { id: string; code: string; name: string; family: string; organizer: { name: string }; jurisdictions: Array<{ code: string; name: string; type: string }>; }

export default function ExaminationsPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Examination[]>([]);
  const [status, setStatus] = useState('Loading examinations…');
  useEffect(() => {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    fetch(`${apiBase}/catalogue/examinations${query}`).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load examinations.');
      const payload = await response.json(); setItems(payload.data ?? []); setStatus('');
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Unable to load examinations.'));
  }, [search]);
  return <main className="page-wrap auth-page">
    <Link className="back-link" href="/">← Back to platform foundation</Link>
    <section className="auth-card" aria-labelledby="examinations-title">
      <div className="eyebrow">EXAMINATION CATALOGUE</div><h1 id="examinations-title">Distinct exams. Distinct rules.</h1>
      <label htmlFor="exam-search">Search examinations</label><input id="exam-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="UGC NET, SET…" />
      {status && <p role="status">{status}</p>}
      <ul aria-label="Examinations">{items.map((item) => <li key={item.id}><Link href={`/examinations/${item.code}`}><strong>{item.name}</strong><span>{item.family} · {item.jurisdictions.map((jurisdiction) => jurisdiction.code).join(', ')}</span></Link></li>)}</ul>
      {!status && items.length === 0 && <p>No examination records are published yet.</p>}
    </section>
  </main>;
}
