'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { BanknotesIcon } from '@heroicons/react/24/solid';

interface WalletData {
  balance:  number;
  currency: string;
}

interface Transaction {
  id:         string;
  amount:     number;
  direction:  'in' | 'out';
  created_at: string;
  note?:      string;
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function WalletPage() {
  const [wallet, setWallet]           = useState<WalletData | null>(null);
  const [txns, setTxns]               = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wRes, tRes] = await Promise.all([
        fetch('/api/proxy/api/wallet',              { credentials: 'include', cache: 'no-store' }),
        fetch('/api/proxy/api/wallet/transactions', { credentials: 'include', cache: 'no-store' }),
      ]);

      if (wRes.ok) {
        const json = await wRes.json().catch(() => ({}));
        setWallet(json.data ?? json);
      }
      if (tRes.ok) {
        const json = await tRes.json().catch(() => ({}));
        setTxns(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setError('Could not load wallet data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const currency = wallet?.currency ?? 'RWF';
  const balance  = wallet?.balance  ?? 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-white)]">Yepper Wallet</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">Your centralized earnings and balance.</p>
        </div>
        <button
          onClick={fetchWallet}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-sm font-medium text-[color:var(--color-white)] disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Balance card */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <BanknotesIcon className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wide">Available Balance</p>
            {loading ? (
              <div className="mt-1 h-8 w-36 rounded-lg bg-[color:var(--color-surface-2)] animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-[color:var(--color-white)]">
                {fmt(balance)} <span className="text-lg font-medium text-[color:var(--color-muted)]">{currency}</span>
              </p>
            )}
          </div>
        </div>

        <button
          disabled
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold opacity-40 cursor-not-allowed"
          title="Withdrawals coming soon"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          Withdraw
          <span className="ml-1 text-[10px] font-semibold bg-black/10 px-1.5 py-0.5 rounded">Soon</span>
        </button>
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[color:var(--color-border)]">
          <h2 className="text-sm font-bold text-[color:var(--color-white)]">Recent Transactions</h2>
        </div>

        {loading ? (
          <div className="divide-y divide-[color:var(--color-border)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="h-4 w-32 rounded bg-[color:var(--color-surface-2)] animate-pulse" />
                <div className="h-4 w-20 rounded bg-[color:var(--color-surface-2)] animate-pulse" />
              </div>
            ))}
          </div>
        ) : txns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BanknotesIcon className="w-10 h-10 text-[color:var(--color-muted)] opacity-30 mx-auto mb-3" />
            <p className="text-sm text-[color:var(--color-muted)]">No transactions yet.</p>
            <p className="text-xs text-[color:var(--color-muted)] mt-1 opacity-60">Earnings from ads and campaigns will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {txns.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-white)]">
                    {tx.note ?? (tx.direction === 'in' ? 'Earnings' : 'Withdrawal')}
                  </p>
                  <p className="text-xs text-[color:var(--color-muted)] mt-0.5">{relativeTime(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-bold ${tx.direction === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.direction === 'in' ? '+' : '-'}{fmt(tx.amount)} {currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
