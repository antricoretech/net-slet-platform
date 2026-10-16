'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculatePaletteState, type TestFormSnapshot } from '@net-slet/exam-rules';
import { apiFetch } from '../../../lib/qbms-api';

type SessionState = { id: string; key: string; sequence: number; status: string; timingPolicy: string; durationSeconds: number; deadlineAt?: string };
type AttemptState = { attemptId: string; status: string; revision: number; remainingSeconds: number; deadlineAt?: string; activeSessionId?: string; sessions: SessionState[]; answers: Array<{ questionVersionId: string; selectedOptionIds: string[]; markedForReview: boolean }> };
type CandidateForm = TestFormSnapshot & { sessions: Array<{ key: string; sequence: number; timingPolicy: string; durationSeconds: number; sections: Array<{ key: string; answerPolicy: string }> }>; scoringPolicy?: unknown };
type FormResponse = { attemptId: string; form: CandidateForm; state: AttemptState };
type ResultResponse = { attemptId: string; status: string; totalMarksScaled?: number; maximumMarksScaled?: number; correct?: number; incorrect?: number; unattempted?: number; explanations?: string };
type LearningResponse =
  | { available: false; releaseStatus: 'PENDING'; reason: 'LEARNING_FEEDBACK_WITHHELD_UNTIL_RESULT_PUBLICATION' }
  | { available: true; releaseStatus: 'PUBLISHED'; analytics: { overall: { attempted: number; correct: number; accuracy?: number }; priorities: Array<{ key: string; reason: string; recommendation: string }> } };

export function CbtAttemptPlayer({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<FormResponse>();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [sessionKey, setSessionKey] = useState('');
  const [sectionKey, setSectionKey] = useState('');
  const [index, setIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<ResultResponse>();
  const [learning, setLearning] = useState<LearningResponse>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<FormResponse>(`/attempts/${attemptId}/form`);
      let nextResponse = response;
      if (response.state.status === 'READY') {
        const first = response.state.sessions.find((session) => session.status === 'READY');
        if (first) nextResponse = { ...response, state: await apiFetch<AttemptState>(`/attempts/${attemptId}/sessions/${first.id}/start`, { method: 'POST' }) };
      }
      setData(nextResponse); setRevision(nextResponse.state.revision); setSeconds(nextResponse.state.remainingSeconds);
      setAnswers(Object.fromEntries(nextResponse.state.answers.map((answer) => [answer.questionVersionId, answer.selectedOptionIds])));
      setMarked(Object.fromEntries(nextResponse.state.answers.filter((answer) => answer.markedForReview).map((answer) => [answer.questionVersionId, true])));
      const active = nextResponse.state.sessions.find((session) => session.id === nextResponse.state.activeSessionId) ?? nextResponse.state.sessions.find((session) => session.status === 'IN_PROGRESS');
      if (active) setSessionKey((current) => current || active.key);
      if (nextResponse.state.status === 'SUBMITTED' || nextResponse.state.status === 'EXPIRED') {
        let finalResult: ResultResponse;
        try { finalResult = await apiFetch<ResultResponse>(`/attempts/${attemptId}/result`); } catch { finalResult = await apiFetch<ResultResponse>(`/attempts/${attemptId}/submit`, { method: 'POST' }); }
        setResult(finalResult);
        try { setLearning(await apiFetch<LearningResponse>(`/attempts/${attemptId}/learning-summary`)); } catch { setLearning(undefined); }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The attempt could not be loaded.'); }
  }, [attemptId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!data?.state.deadlineAt || result) return undefined; const timer = window.setInterval(() => setSeconds(Math.max(0, Math.floor((Date.parse(data.state.deadlineAt!) - Date.now()) / 1000))), 1000); return () => window.clearInterval(timer); }, [data?.state.deadlineAt, result]);

  const navigation = useMemo(() => {
    if (!data) return [] as Array<{ session: CandidateForm['sessions'][number]; sections: Array<{ key: string; questions: TestFormSnapshot['sections'][number]['questions'] }> }>;
    const all = data.form.sections.flatMap((section) => section.questions);
    return [...data.form.sessions].sort((a, b) => a.sequence - b.sequence).map((session) => ({ session, sections: session.sections.map((section) => {
      const ids = data.form.blueprint.sections.find((item) => item.key === section.key)?.questionVersionIds ?? [];
      const questions = ids.length ? ids.map((id) => all.find((question) => question.questionVersionId === id)).filter((question): question is typeof all[number] => Boolean(question)) : all;
      return { key: section.key, questions };
    }) }));
  }, [data]);
  const activeNavigation = navigation.find((item) => item.session.key === sessionKey) ?? navigation[0];
  const activeSection = activeNavigation?.sections.find((section) => section.key === sectionKey) ?? activeNavigation?.sections[0];
  const questions = activeSection?.questions ?? data?.form.sections.flatMap((section) => section.questions) ?? [];
  const current = questions[index];
  useEffect(() => { if (activeNavigation && activeNavigation.session.key !== sessionKey) setSessionKey(activeNavigation.session.key); }, [activeNavigation, sessionKey]);
  useEffect(() => { if (activeSection && activeSection.key !== sectionKey) { setSectionKey(activeSection.key); setIndex(0); } }, [activeSection, sectionKey]);
  const switchSection = (nextSessionKey: string, nextSectionKey: string) => { setSessionKey(nextSessionKey); setSectionKey(nextSectionKey); setIndex(0); setMessage(''); };

  if (result && learning?.available) return <main className="page-wrap"><section className="auth-card" aria-labelledby="performance-title"><p className="workspace-status">ATTEMPT SUBMITTED · RESULT RECORDED</p><h1 id="performance-title">Performance summary</h1><div className="result-summary"><div><span>Score</span><strong>{result.totalMarksScaled ?? 0}/{result.maximumMarksScaled ?? 0}</strong></div><div><span>Correct</span><strong>{result.correct ?? 0}</strong></div><div><span>Incorrect</span><strong>{result.incorrect ?? 0}</strong></div></div><p>{learning.analytics.overall.correct} correct of {learning.analytics.overall.attempted} attempted{learning.analytics.overall.accuracy === undefined ? '' : ` · ${Math.round(learning.analytics.overall.accuracy * 100)}% accuracy`}</p></section></main>;
  if (error && !data) return <main className="page-wrap"><section className="auth-card"><h1>Attempt unavailable</h1><p className="form-error" role="alert">{error}</p><button type="button" className="secondary-button" onClick={() => { setError(''); void load(); }}>Reload attempt</button></section></main>;
  if (!data || !current) return <main className="workspace-loading"><strong>Loading your attempt…</strong><span className="workspace-status">The server is preparing the candidate-safe snapshot.</span></main>;

  const selected = answers[current.questionVersionId] ?? [];
  const multi = current.type !== 'SINGLE_CHOICE';
  const state = calculatePaletteState({ visited: Boolean(visited[current.questionVersionId]), hasAnswer: selected.length > 0, markedForReview: marked[current.questionVersionId] === true });
  const formatted = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const choose = (optionId: string) => setAnswers((previous) => ({ ...previous, [current.questionVersionId]: multi ? (previous[current.questionVersionId]?.includes(optionId) ? previous[current.questionVersionId].filter((id) => id !== optionId) : [...(previous[current.questionVersionId] ?? []), optionId]) : [optionId] }));
  const save = async (nextIndex?: number, review = marked[current.questionVersionId] === true, selection = selected) => {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await apiFetch<{ attemptRevision: number; answer: { markedForReview: boolean } }>(`/attempts/${attemptId}/answers/${current.questionVersionId}`, { method: 'PUT', body: JSON.stringify({ selectedOptionIds: selection, markedForReview: review, expectedRevision: revision, idempotencyKey: `${attemptId}:${current.questionVersionId}:${revision}:${review}:${selection.join(',')}` }) });
      setRevision(response.attemptRevision); setMarked((previous) => ({ ...previous, [current.questionVersionId]: response.answer.markedForReview })); setVisited((previous) => ({ ...previous, [current.questionVersionId]: true })); setMessage('Answer and review state saved to the server.'); if (nextIndex !== undefined) setIndex(nextIndex);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The answer was not saved. Reload before retrying.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!window.confirm('Submit this attempt? You will not be able to change answers afterward.')) return;
    setBusy(true); setError('');
    try { const active = data.state.sessions.find((session) => session.status === 'IN_PROGRESS'); if (active) await apiFetch(`/attempts/${attemptId}/sessions/${active.id}/submit`, { method: 'POST' }); const finalResult = await apiFetch<ResultResponse>(`/attempts/${attemptId}/submit`, { method: 'POST' }); setResult(finalResult); try { setLearning(await apiFetch<LearningResponse>(`/attempts/${attemptId}/learning-summary`)); } catch { setLearning(undefined); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The attempt could not be submitted.'); }
    finally { setBusy(false); }
  };
  return <main className="cbt-shell" aria-labelledby="attempt-title"><header className="cbt-header"><div><p className="workspace-status">AUTHENTICATED CBT · SERVER-PERSISTED ATTEMPT</p><h1 id="attempt-title">{data.form.blueprint.examCode} · {data.form.blueprint.subjectCode}</h1><p>{data.form.blueprint.cycleCode} · Snapshot {data.form.snapshotId}</p></div><div className="cbt-timer" role="timer" aria-live="polite"><span>Server deadline</span><strong>{formatted}</strong><small>Reconnects do not extend the deadline.</small></div></header><nav aria-label="Papers" className="cbt-paper-tabs">{navigation.map(({ session }) => <button type="button" key={session.key} className={session.key === sessionKey ? 'primary-button' : 'secondary-button'} onClick={() => switchSection(session.key, session.sections[0]?.key ?? '')}>{session.key}</button>)}</nav><section className="cbt-layout"><aside className="cbt-sidebar" aria-label="Question palette"><h2>Question palette</h2>{activeNavigation && <nav aria-label="Sections">{activeNavigation.sections.map((section) => <button type="button" key={section.key} className={section.key === activeSection?.key ? 'primary-button' : 'secondary-button'} onClick={() => switchSection(activeNavigation.session.key, section.key)}>{section.key}</button>)}</nav>}<p>State is stored only after the server acknowledges it.</p><div className="palette-grid">{questions.map((question, questionIndex) => { const palette = calculatePaletteState({ visited: Boolean(visited[question.questionVersionId]) || questionIndex === index, hasAnswer: Boolean(answers[question.questionVersionId]?.length), markedForReview: marked[question.questionVersionId] === true }); return <button type="button" className={`palette-${palette.toLowerCase()}`} key={question.questionVersionId} onClick={() => { setIndex(questionIndex); setVisited((previous) => ({ ...previous, [question.questionVersionId]: true })); }} aria-label={`Question ${questionIndex + 1}, ${palette.replaceAll('_', ' ').toLowerCase()}`}>{questionIndex + 1}</button>; })}</div><ul className="palette-legend"><li>○ Not visited</li><li>◐ Visited, unanswered</li><li>● Answered</li><li>★ Marked for review (answered or unanswered)</li></ul></aside><article className="cbt-question" aria-live="polite"><div className="question-heading"><span>Question {index + 1} of {questions.length}</span><span role="status">Current: {state.replaceAll('_', ' ')}</span></div><h2>{current.prompt}</h2>{current.content?.table && <table><caption>Question data</caption><tbody>{current.content.table.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th scope="col" key={`cell-${cellIndex}`}>{cell}</th> : <td key={`cell-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table>}<fieldset><legend>{multi ? 'Select all that apply' : 'Select one answer'}</legend>{current.options.map((option) => <label key={option.id}><input type={multi ? 'checkbox' : 'radio'} name={current.questionVersionId} checked={selected.includes(option.id)} onChange={() => choose(option.id)} /> {option.label}</label>)}</fieldset>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<div className="preview-actions"><button type="button" className="secondary-button" disabled={index === 0 || busy} onClick={() => setIndex((previous) => previous - 1)}>Previous</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void save(Math.min(index + 1, questions.length - 1), true)}>Mark &amp; Next</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void save(undefined, marked[current.questionVersionId] === true, [])}>Clear Response</button><button type="button" className="primary-button" disabled={busy} onClick={() => void save(Math.min(index + 1, questions.length - 1))}>Save &amp; Next</button><button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}>Submit Attempt</button></div></article></section></main>;
}
