'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
interface Cycle { code: string; subjects: Array<{ code: string; name: string; status: string }>; patternStatuses: string[]; }
interface Examination { name: string; code: string; family: string; organizer: { name: string }; jurisdictions: Array<{ name: string }>; cycles: Cycle[]; }

export default function ExaminationDetailPage() {
  const params = useParams<{ code: string }>();
  const [exam, setExam] = useState<Examination | null>(null);
  const [status, setStatus] = useState('Loading examination…');
  useEffect(() => { if (!params.code) return; fetch(`${apiBase}/catalogue/examinations/${encodeURIComponent(params.code)}`).then(async (response) => { if (!response.ok) throw new Error('Examination not found.'); const payload = await response.json(); setExam(payload); setStatus(''); }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Unable to load examination.')); }, [params.code]);
  return <main className="page-wrap auth-page"><Link className="back-link" href="/examinations">← Examination catalogue</Link><section className="auth-card" aria-labelledby="examination-title">{status && <p role="status">{status}</p>}{exam && <><div className="eyebrow">{exam.family}</div><h1 id="examination-title">{exam.name}</h1><p>{exam.organizer.name} · {exam.jurisdictions.map((jurisdiction) => jurisdiction.name).join(', ')}</p><h2>Cycles and subjects</h2><ul>{exam.cycles.map((cycle) => <li key={cycle.code}><strong>{cycle.code}</strong><span>{cycle.subjects.length ? cycle.subjects.map((subject) => `${subject.name} (${subject.status})`).join(', ') : 'No subjects published yet'}</span></li>)}</ul></>}</section></main>;
}
