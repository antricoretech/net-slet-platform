'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/qbms-api';

type PendingResult = { id: string; attemptId: string; status: 'PENDING' | 'PUBLISHED'; createdAt: string; attempt: { accountId: string; status: string; submittedAt?: string; expiredAt?: string; testForm: { subjectCode: string; version: number } }; scoreRun: { scoreRunHash: string; runNumber: number } | null };

export default function ResultGovernancePage() {
  const [items, setItems] = useState<PendingResult[]>([]);
  const [message, setMessage] = useState('Loading pending results…');
  const [busy, setBusy] = useState<string>();
  const [approvalReference, setApprovalReference] = useState('');
  const [reason, setReason] = useState('');
  const load = () => apiFetch<PendingResult[]>('/admin/results/pending').then((value) => { setItems(value); setMessage(''); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load result queue.'));
  useEffect(() => { void load(); }, []);
  async function publish(item: PendingResult) {
    setBusy(item.attemptId); setMessage('');
    try { await apiFetch(`/admin/results/${item.attemptId}/publish`, { method: 'POST', body: JSON.stringify({ approvalReference, reason }) }); await load(); setApprovalReference(''); setReason(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Publication failed.'); }
    finally { setBusy(undefined); }
  }
  return <main className="workspace-main" aria-labelledby="result-governance-title"><header className="workspace-header"><div className="eyebrow">ADMIN / RESULT GOVERNANCE</div><h1 id="result-governance-title">Result release queue.</h1><p>Aggregate scores may remain pending until an authorized administrator publishes the result. Answer keys and question-level evidence are never shown in this queue.</p></header><section className="workspace-card" aria-labelledby="release-evidence-title"><h2 id="release-evidence-title">Release authorization</h2><div className="form-grid"><label>Approval reference<input value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} required /></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={2} /></label></div><p className="muted-note">Use the owner-approved reference; the interface does not generate or infer authorization.</p></section>{message && <p className="workspace-status" role="status">{message}</p>}<section className="review-list" aria-live="polite">{items.map((item) => <article className="workspace-card review-card" key={item.id}><div><span className="eyebrow">{item.status} · {item.attempt.status}</span><h2>{item.attempt.testForm.subjectCode} · form v{item.attempt.testForm.version}</h2><p>Attempt {item.attemptId} · score run {item.scoreRun?.runNumber ?? '—'}</p><small>Candidate-safe queue view; private records remain withheld.</small></div><button className="primary-button" type="button" disabled={busy === item.attemptId || !approvalReference.trim() || !reason.trim()} onClick={() => void publish(item)}>{busy === item.attemptId ? 'Publishing…' : 'Publish after approval'}</button></article>)}{!message && !items.length && <div className="empty-state">No pending results.</div>}</section></main>;
}
