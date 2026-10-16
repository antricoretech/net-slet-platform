'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/qbms-api';

type RecordItem = { questionVersionId: string; authority: string; year: number | null; cycle: string | null; session: string | null; paper: string | null; subjectCode: string; questionSequence: number | null; language: string | null; sourceReference: string | null; rightsStatus: string };
type Result = { data: RecordItem[]; pagination: { page: number; pageSize: number; returned: number; hasNextPage: boolean }; notices: string[] };

export default function HistoricalPyqsPage() {
  const params = useParams<{ examinationCode: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const examinationCode = params.examinationCode;
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState('Loading verified historical question inventory...');
  const [error, setError] = useState('');
  const [session, setSession] = useState(searchParams.get('session') ?? '');
  const [paper, setPaper] = useState(searchParams.get('paper') ?? '');
  const [language, setLanguage] = useState(searchParams.get('language') ?? '');
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => { const query = new URLSearchParams({ page: String(page) }); if (session) query.set('session', session); if (paper) query.set('paper', paper); if (language) query.set('language', language); void apiFetch<Result>(`/preparation/${encodeURIComponent(examinationCode)}/pyqs?${query}`).then((next) => { setResult(next); setStatus(''); }).catch((caught) => { setError(caught instanceof Error ? caught.message : 'Historical inventory is unavailable.'); setStatus(''); }); }, [examinationCode, language, page, paper, session]);
  const applyFilters = () => { const next = new URLSearchParams(); if (session) next.set('session', session); if (paper) next.set('paper', paper); if (language) next.set('language', language); next.set('page', '1'); router.push(`/preparation/${encodeURIComponent(examinationCode)}/pyqs?${next}`); };
  const movePage = (nextPage: number) => { const next = new URLSearchParams(searchParams.toString()); next.set('page', String(nextPage)); router.push(`/preparation/${encodeURIComponent(examinationCode)}/pyqs?${next}`); };

  return <main className="page-wrap auth-page"><Link className="back-link" href="/preparation">&larr; Preparation dashboard</Link><section className="auth-card" aria-labelledby="pyq-title"><div className="eyebrow">VERIFIED HISTORICAL INVENTORY · {examinationCode}</div><h1 id="pyq-title">Past-question discovery</h1><p>Only explicitly verified, rights-cleared metadata is shown. Question text and answer keys are released only through an eligible practice or CBT flow.</p><form className="form-grid" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}><label>Session<input value={session} onChange={(event) => setSession(event.target.value)} placeholder="e.g. SHIFT_1" /></label><label>Paper<input value={paper} onChange={(event) => setPaper(event.target.value)} placeholder="e.g. PAPER_II" /></label><label>Language<input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="e.g. en" /></label><button className="primary-button" type="submit">Apply filters</button></form>{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}{result && !result.data.length && <div role="status"><h2>No verified questions found</h2><p>{result.notices[0] ?? 'Try broader filters or check back after academic verification.'}</p></div>}{result && result.data.length > 0 && <><p role="status">Showing {result.pagination.returned} verified record{result.pagination.returned === 1 ? '' : 's'}.</p><div className="review-list" aria-label="Verified historical questions">{result.data.map((item) => <article className="workspace-card review-card" key={item.questionVersionId}><span className="eyebrow">{item.year ?? 'YEAR UNVERIFIED'} · {item.session ?? 'SESSION UNVERIFIED'}</span><h2>{item.subjectCode} · {item.paper ?? 'PAPER UNVERIFIED'}</h2><p>{item.authority} · {item.cycle ?? 'Cycle reference unavailable'} · {item.language ?? 'Language scope unavailable'}</p><p>Question sequence: {item.questionSequence ?? 'Not recorded'} · Rights: {item.rightsStatus}</p><p className="muted-note">Source reference: {item.sourceReference ?? 'Not published'}</p><Link className="secondary-button" href={`/preparation/paper-ii/${encodeURIComponent(item.subjectCode)}`}>Open subject practice and CBT options</Link></article>)}</div><nav aria-label="Historical question pages" className="preview-actions"><button className="secondary-button" type="button" disabled={page <= 1} onClick={() => movePage(page - 1)}>Previous</button><span>Page {page}</span><button className="secondary-button" type="button" disabled={!result.pagination.hasNextPage} onClick={() => movePage(page + 1)}>Next</button></nav></>}</section></main>;
}
