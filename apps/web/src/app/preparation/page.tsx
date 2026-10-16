'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
type Overview = { examination: { code: string; name: string; family: string }; paperI: { subjectRequired: boolean; cycleRequired: boolean; syllabus: string }; paperII: { subjectRequired: boolean; subjects: Array<{ code: string; name: string; status: string }> }; notices: string[] };

export default function PreparationPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState('Loading preparation dashboard…');
  useEffect(() => { fetch(`${apiBase}/preparation/UGC_NET`, { credentials: 'include' }).then(async (response) => { if (!response.ok) throw new Error(response.status === 401 ? 'Sign in is required to open preparation.' : 'Preparation is unavailable.'); setOverview(await response.json()); setStatus(''); }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Preparation is unavailable.')); }, []);
  return <main className="page-wrap auth-page"><Link className="back-link" href="/">← Platform home</Link><section className="auth-card" aria-labelledby="preparation-title"><div className="eyebrow">YEAR-ROUND PREPARATION</div><h1 id="preparation-title">Prepare continuously.</h1>{status && <p role="status">{status}</p>}{overview && <><p>{overview.examination.name} is available without selecting a historical examination cycle.</p><div className="dashboard-grid"><article><h2>Paper I</h2><p>Common preparation path. No Paper II subject is required.</p><Link className="primary-button" href="/preparation/paper-i">Explore Paper I</Link></article><article><h2>Paper II</h2><p>Select a subject only when you want subject-specific preparation.</p><Link className="secondary-button" href="/preparation/paper-ii">Choose a subject</Link></article></div><h2>Safe availability</h2><ul>{overview.notices.length ? overview.notices.map((notice) => <li key={notice}>{notice}</li>) : <li>Discovery is based on server-published records.</li>}<li>Official mocks appear only when academic and publication gates pass.</li></ul></>}</section></main>;
}
