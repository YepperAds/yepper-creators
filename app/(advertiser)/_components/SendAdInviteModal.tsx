'use client';

import { useState } from 'react';
import { EnvelopeIcon, ExclamationTriangleIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Lets a creator email one specific person a direct link into claiming an ad
// slot on their own channel: clicking it (see sendAdSpaceInvite in
// adSpaceController.js) sends them to /login?from=/?panel=advertise&creatorId=
// which lands them right back on this channel's "Collaborate" claim modal.
export default function SendAdInviteModal({
  open,
  channelName,
  onClose,
}: {
  open: boolean;
  channelName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const close = () => {
    setEmail('');
    setError('');
    setSent(false);
    onClose();
  };

  const send = async () => {
    if (!email.trim()) { setError('Recipient email is required.'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/social/youtube/ad-spaces/send-invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to send email');
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface-1) overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-bold text-(--color-white)">Send Ad Invite</p>
          </div>
          <button onClick={close} className="text-(--color-muted) hover:text-(--color-white)">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {sent ? (
            <>
              <div className="flex items-start gap-3 mb-6">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-(--color-white)">
                  {email} now has a link straight into claiming a slot on {channelName}.
                </p>
              </div>
              <button onClick={close} className="w-full h-11 rounded-xl bg-(--color-surface-2) text-(--color-white) font-medium hover:bg-(--color-surface-3) transition-colors">
                Done
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-(--color-muted) mb-5">
                Email a recipient a direct link to claim an ad slot on {channelName}; they log in (or sign up) and land right back here to advertise.
              </p>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <label className="block text-[11px] font-bold text-(--color-muted) uppercase mb-2">Recipient email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="someone@example.com"
                className="w-full mb-6 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-4 py-2.5 text-sm text-(--color-white) placeholder:text-(--color-muted) outline-none focus:border-emerald-400/50"
              />

              <div className="flex gap-3">
                <button onClick={close} disabled={sending} className="flex-1 h-11 rounded-xl bg-(--color-surface-2) text-(--color-white) font-medium hover:bg-(--color-surface-3) transition-colors disabled:opacity-60">
                  Cancel
                </button>
                <button onClick={send} disabled={sending} className="flex-1 h-11 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-60">
                  {sending ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
