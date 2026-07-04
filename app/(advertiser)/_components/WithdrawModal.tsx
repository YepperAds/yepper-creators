'use client';

import { useState } from 'react';
import { BanknotesIcon, ExclamationTriangleIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface WithdrawModalProps {
  open: boolean;
  balance: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WithdrawModal({ open, balance, currency, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount]               = useState('');
  const [bankName, setBankName]           = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName]     = useState('');
  const [country, setCountry]             = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [swiftCode, setSwiftCode]         = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState('');
  const [done, setDone]                   = useState(false);

  if (!open) return null;

  const reset = () => {
    setAmount(''); setBankName(''); setAccountNumber(''); setAccountName('');
    setCountry(''); setRoutingNumber(''); setSwiftCode('');
    setError(''); setDone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount.'); return; }
    if (amountNum > balance) { setError('Amount exceeds available balance.'); return; }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim() || !country.trim()) {
      setError('Bank name, account number, account name and country are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/api/wallet/withdrawal-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          country: country.trim(),
          routingNumber: routingNumber.trim(),
          swiftCode: swiftCode.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to submit withdrawal request');
      setDone(true);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface-1) overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) shrink-0">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-bold text-(--color-white)">Withdraw Funds</p>
          </div>
          <button onClick={close} className="text-(--color-muted) hover:text-(--color-white)">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {done ? (
            <>
              <div className="flex items-start gap-3 mb-6">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-(--color-white)">
                  Withdrawal request submitted. It'll show as Pending until an admin reviews and processes the transfer.
                </p>
              </div>
              <button onClick={close} className="w-full h-11 rounded-xl bg-(--color-surface-2) text-(--color-white) font-medium hover:bg-(--color-surface-3) transition-colors">
                Done
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-(--color-muted) mb-5">
                Available balance: <span className="text-(--color-white) font-semibold">{balance.toLocaleString()} {currency}</span>
              </p>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0"
                max={balance}
                step="0.01"
                placeholder="0.00"
                className="w-full mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Bank name</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank of Kigali"
                className="w-full mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Account number</label>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="0000000000"
                className="w-full mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Account name</label>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Account holder name"
                className="w-full mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Rwanda"
                className="w-full mb-4 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Routing # (optional)</label>
                  <input
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                    className="w-full rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">SWIFT (optional)</label>
                  <input
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value)}
                    className="w-full rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={close} disabled={submitting} className="flex-1 h-11 rounded-xl bg-(--color-surface-2) text-(--color-white) font-medium hover:bg-(--color-surface-3) transition-colors disabled:opacity-60">
                  Cancel
                </button>
                <button onClick={submit} disabled={submitting} className="flex-1 h-11 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
