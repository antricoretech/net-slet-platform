'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const isRegister = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/auth/${mode}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? 'Unable to complete the request.');
      router.push('/account');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete the request.');
    } finally { setBusy(false); }
  }

  return <main className="auth-page page-wrap">
    <Link className="back-link" href="/">← Back to platform foundation</Link>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="eyebrow">STUDENT ACCOUNT</div>
      <h1 id="auth-title">{isRegister ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>{isRegister ? 'Start with a student account. Exam goals and learning history come next.' : 'Sign in to view your account foundation.'}</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className="form-hint">Use at least 12 characters.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Working…' : isRegister ? 'Create student account' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">{isRegister ? 'Already registered?' : 'New here?'} <Link href={isRegister ? '/sign-in' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
      {isRegister && <p className="local-note">Local development account flow. Production email delivery requires a configured provider.</p>}
    </section>
  </main>;
}
