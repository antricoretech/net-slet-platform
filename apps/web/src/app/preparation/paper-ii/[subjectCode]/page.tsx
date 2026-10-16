'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/qbms-api';

type Form = { id: string; subjectCode: string; version: number; patternVersion: number };
type SubjectView = { available: boolean; reason?: string; subject?: { code: string; name: string }; syllabus?: { available: boolean; reason?: string; title?: string; version?: number }; pattern?: { state: string; reasons: string[] }; practice?: { available: boolean; reason?: string; topics: Array<{ topicId: string; title: string; questionCount: number; available: boolean; reason?: string }> }; mocks?: { available: boolean; reason?: string; data: Form[] } };

export default function SubjectPreparationPage() {
  const { subjectCode } = useParams<{ subjectCode: string }>();
  const [view, setView] = useState<SubjectView | null>(null);
  const [status, setStatus] = useState('Loading subject preparation...');
  const [error, setError] = useState('');
  useEffect(() => { if (!subjectCode) return; void apiFetch<SubjectView>(`/preparation/UGC_NET/paper-ii/${encodeURIComponent(subjectCode)}`).then((result) => { setView(result); setStatus(''); }).catch((caught) => { setError(caught instanceof Error ? caught.message : 'Unable to load subject preparation.'); setStatus(''); }); }, [subjectCode]);
  const start = async (formId: string) => { try { const result = await apiFetch<{ attemptId: string }>('/attempts', { method: 'POST', body: JSON.stringify({ testFormId: formId, idempotencyKey: crypto.randomUUID() }) }); window.location.assign(`/attempts/${result.attemptId}`); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The attempt could not be started.'); } };
  return <main className="page-wrap auth-page"><Link className="back-link" href="/preparation/paper-ii">&larr; Choose another subject</Link><section className="auth-card" aria-labelledby="subject-title"><div className="eyebrow">UGC NET / PAPER II</div>{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}{view?.available ? <><h1 id="subject-title">{view.subject?.name}</h1><p>Subject code: {view.subject?.code}</p><h2>Readiness</h2><ul><li>{view.syllabus?.available ? `${view.syllabus.title} · version ${view.syllabus.version}` : 'Syllabus evidence pending'}</li><li>{view.pattern?.state === 'RESOLVED' ? 'A verified current pattern is available.' : 'No applicable verified pattern is available.'}</li></ul><h2>Topic practice</h2>{view.practice?.available ? <ul>{view.practice.topics.filter((topic) => topic.available).map((topic) => <li key={topic.topicId}>{topic.title} · {topic.questionCount} qualified questions</li>)}</ul> : <p role="status">{view.practice?.reason ?? 'Qualified question inventory is pending.'}</p>}<h2>Tests and PYQs</h2><p><Link className="secondary-button" href={`/preparation/UGC_NET/pyqs?subjectCode=${encodeURIComponent(subjectCode)}`}>Browse cleared PYQ metadata</Link></p>{view.mocks?.available ? view.mocks.data?.map((form) => <article className="workspace-card" key={form.id}><h3>Published subject test</h3><button type="button" className="primary-button" onClick={() => void start(form.id)}>Start or resume test</button></article>) : <p className="muted-note">{view.mocks?.reason ?? 'No publication-ready mock is available.'}</p>}</> : view && <div role="status"><h2>Subject unavailable</h2><p>{view.reason}</p></div>}</section></main>;
}
