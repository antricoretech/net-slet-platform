'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/qbms-api';

type Topic = { id: string; code: string; title: string; children: Topic[] };
type Syllabus = { available: boolean; reason?: string; title?: string; version?: number; units?: Array<{ id: string; code: string; title: string; topics: Topic[] }> };
type Practice = { available: boolean; reason?: string; topics: Array<{ topicId: string; code: string; title: string; questionCount: number; available: boolean; reason?: string }> };
type Form = { id: string; subjectCode: string };

export default function PaperIPage() {
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [status, setStatus] = useState('Loading Paper I preparation...');
  const [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => { void Promise.all([apiFetch<Syllabus>('/preparation/UGC_NET/paper-i/syllabus'), apiFetch<Practice>('/preparation/UGC_NET/practice?subjectCode=PAPER_I'), apiFetch<{ data: Form[] }>('/preparation/UGC_NET/mocks?subjectCode=PAPER_I')]).then(([nextSyllabus, nextPractice, nextForms]) => { setSyllabus(nextSyllabus); setPractice(nextPractice); setForms(nextForms.data); setStatus(''); }).catch((caught) => { setError(caught instanceof Error ? caught.message : 'Unable to load Paper I.'); setStatus(''); }); }, []);
  const start = async (formId: string) => { try { const result = await apiFetch<{ attemptId: string }>('/attempts', { method: 'POST', body: JSON.stringify({ testFormId: formId, idempotencyKey: crypto.randomUUID() }) }); router.push(`/attempts/${result.attemptId}`); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The attempt could not be started.'); } };
  return <main className="page-wrap auth-page"><Link className="back-link" href="/preparation">&larr; Preparation dashboard</Link><section className="auth-card" aria-labelledby="paper-i-title"><div className="eyebrow">UGC NET / PAPER I</div><h1 id="paper-i-title">General teaching and research preparation.</h1>{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}{syllabus?.available ? <><p>{syllabus.title} &middot; version {syllabus.version}</p><div aria-label="Paper I syllabus units">{syllabus.units?.map((unit) => <article key={unit.id}><h2>{unit.title}</h2><ul>{unit.topics.map((topic) => <li key={topic.id}>{topic.title}{topic.children.length > 0 && <ul>{topic.children.map((child) => <li key={child.id}>{child.title}<span className="muted-note"> &middot; {practice?.topics.find((item) => item.topicId === child.id)?.questionCount ?? 0} qualified questions</span></li>)}</ul>}<span className="muted-note"> &middot; {practice?.topics.find((item) => item.topicId === topic.id)?.questionCount ?? 0} qualified questions</span></li>)}</ul></article>)}</div></> : syllabus && <div role="status"><h2>Syllabus evidence pending</h2><p>{syllabus.reason}</p></div>}<h2>Practice and tests</h2>{practice?.available ? <p>Qualified practice inventory is available for selected topics.</p> : <p role="status">{practice?.reason ?? 'Qualified question inventory is pending.'}</p>}{forms.length ? forms.map((form) => <article className="workspace-card" key={form.id}><h3>Published Paper I test</h3><button type="button" className="primary-button" onClick={() => void start(form.id)}>Start or resume test</button></article>) : <p className="muted-note">No publication-ready Paper I test is available yet.</p>}</section></main>;
}
