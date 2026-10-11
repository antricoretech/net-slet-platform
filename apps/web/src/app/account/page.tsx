'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
interface Account { id: string; email: string; role: string; emailVerified: boolean; }

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState('Loading account…');
  const router = useRouter();
  useEffect(() => {
    fetch(`${apiBase}/auth/me`, { credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error('Please sign in to continue.');
      const payload = await response.json(); setAccount(payload.account); setStatus('');
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Please sign in to continue.'));
  }, []);
  async function logout() { await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' }); router.push('/sign-in'); }
  return <main className="auth-page page-wrap">
    <Link className="back-link" href="/">← Back to platform foundation</Link>
    <section className="auth-card" aria-labelledby="account-title">
      <div className="eyebrow">ACCOUNT FOUNDATION</div><h1 id="account-title">Your student account.</h1>
      {account ? <><dl className="account-details"><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Role</dt><dd>{account.role}</dd></div><div><dt>Verification</dt><dd>{account.emailVerified ? 'Verified' : 'Pending'}</dd></div></dl><button className="secondary-button" type="button" onClick={logout}>Sign out</button></> : <p role="status">{status}</p>}
    </section>
  </main>;
}
