'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/qbms-api';

type FormRecord = { id: string; subjectCode: string; version: number; status: string; snapshotHash: string; publishedAt?: string };

export default function PublicationPage() {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [message, setMessage] = useState('Loading publication records…');
  useEffect(() => { apiFetch<FormRecord[]>('/admin/content-publication/forms').then(setForms).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load publication records.')).finally(() => setMessage('')); }, []);
  return <main className="workspace-main" aria-labelledby="publication-title"><header className="workspace-header"><p className="workspace-status">DEVELOPMENT-ONLY · RELEASE 1</p><h1 id="publication-title">Publication readiness.</h1><p>Exact-cycle evidence, qualified inventory and immutable test-form snapshots.</p></header><section className="workspace-card"><p className="muted-note">Official certification is unavailable until authoritative UGC NET cycle/subject evidence and owner approvals are recorded. Synthetic QA-only forms never become official content.</p><div className="metric-grid"><div className="metric-card"><span>Forms inspected</span><strong>{forms.length}</strong></div><div className="metric-card"><span>Published forms</span><strong>{forms.filter((form) => form.status === 'PUBLISHED').length}</strong></div><div className="metric-card"><span>Official patterns</span><strong>0</strong></div></div></section>{message && <p className="workspace-status" role="status">{message}</p>}<section className="review-list" aria-label="Test form publication records">{forms.map((form) => <article className="workspace-card review-card" key={form.id}><div><span className="eyebrow">{form.subjectCode} · v{form.version}</span><h2>{form.status}</h2><p>Immutable snapshot {form.snapshotHash}</p></div><span className="status-badge">{form.publishedAt ? 'PUBLISHED' : 'DRAFT'}</span></article>)}{!message && !forms.length && <div className="empty-state">No compiled forms have been recorded.</div>}</section></main>;
}
