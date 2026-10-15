'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/qbms-api';

type FormSummary = { id: string; snapshotId: string; examCode: string; cycleCode: string; subjectCode: string; questionCount: number; sectionCount: number; publishedAt?: string };

export function AvailableAttempts() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => { void apiFetch<FormSummary[]>('/attempts/forms').then(setForms).catch((caught) => setError(caught instanceof Error ? caught.message : 'Available tests could not be loaded.')).finally(() => setLoading(false)); }, []);
  const start = async (form: FormSummary) => { if (!window.confirm(`Start ${form.examCode} · ${form.subjectCode}? The server deadline begins when the session starts.`)) return; try { const response = await apiFetch<{ attemptId: string }>('/attempts', { method: 'POST', body: JSON.stringify({ testFormId: form.id, idempotencyKey: crypto.randomUUID() }) }); router.push(`/attempts/${response.attemptId}`); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The attempt could not be created.'); } };
  return <main className="workspace-main" aria-labelledby="available-attempts-title"><header className="workspace-header"><p className="workspace-status">AUTHENTICATED STUDENT WORKSPACE</p><h1 id="available-attempts-title">Available practice tests</h1><p>Only candidate-eligible forms are listed. Research-only patterns and incomplete publication records remain unavailable.</p></header>{error && <p className="workspace-error" role="alert">{error}</p>}{loading && <p className="workspace-loading">Loading eligible forms…</p>}{!loading && !forms.length && <section className="workspace-card"><h2>No eligible tests yet</h2><p className="muted-note">An approved form snapshot and publication qualification record are required before a learner can start.</p></section>}<div className="review-list">{forms.map((form) => <article className="workspace-card review-card" key={form.id}><div><span className="eyebrow">{form.examCode} · {form.cycleCode}</span><h2>{form.subjectCode}</h2><p>{form.questionCount} questions · {form.sectionCount} section{form.sectionCount === 1 ? '' : 's'} · immutable snapshot {form.snapshotId}</p></div><button type="button" className="primary-button" onClick={() => void start(form)}>Read instructions &amp; start</button></article>)}</div></main>;
}
