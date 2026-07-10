'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ForgotPasswordForm — converted from clientZip/src/pages/ForgotPassword.js
// ─────────────────────────────────────────────────────────────────────────────

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) { setError(data.message ?? 'Something went wrong.'); return; }
      setSent(true);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) return (
    <div className="text-center space-y-4">
      <div className="text-3xl">📬</div>
      <p className="text-sm text-zinc-300">Check your inbox — a reset link is on its way.</p>
      <Link href="/login" className="text-xs text-zinc-500 underline">Back to login</Link>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Email address</label>
        <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
          className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 ${error ? 'border-red-500' : 'border-zinc-800'}`}
          placeholder="you@example.com" autoFocus />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2.5 rounded-lg bg-white text-background text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-60">
        {loading ? <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-background rounded-full animate-spin" /> : 'Send Reset Link'}
      </button>
      <Link href="/login" className="text-center text-xs text-zinc-500 hover:text-white transition-colors">Back to login</Link>
    </form>
  );
}
