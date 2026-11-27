'use client';

import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, ExclamationCircleIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';

type Settings = { phoneNumber: string; enabled: boolean };
type Props = {
  mode?: 'settings' | 'prompt';
  onClose?: () => void;
  onSaved?: () => void;
};

const EMPTY_SETTINGS: Settings = { phoneNumber: '', enabled: false };

export default function WhatsAppReportsSettings({ mode = 'settings', onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [savedPhoneNumber, setSavedPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/whatsapp-reports', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not load WhatsApp report settings.');
        }
        if (active) {
          setSavedPhoneNumber(result.data?.phoneNumber || '');
          setSettings({
            phoneNumber: result.data?.phoneNumber || '',
            enabled: Boolean(result.data?.enabled),
          });
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load WhatsApp report settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/whatsapp-reports', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not save WhatsApp report settings.');
      }

      setSettings({
        phoneNumber: result.data?.phoneNumber || '',
        enabled: Boolean(result.data?.enabled),
      });
      setSavedPhoneNumber(result.data?.phoneNumber || '');
      setMessage('Your WhatsApp report preferences are saved.');
      onSaved?.();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save WhatsApp report settings.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/whatsapp-reports/test', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not send the WhatsApp test.');
      }
      setMessage('Test report sent to your saved WhatsApp number.');
    } catch (testError: unknown) {
      setError(testError instanceof Error ? testError.message : 'Could not send the WhatsApp test.');
    } finally {
      setTesting(false);
    }
  }

  const form = (
    <form onSubmit={saveSettings} className="space-y-5">
      <div className="max-w-xl">
        <label htmlFor="whatsapp-phone" className="mb-2 block text-sm font-semibold text-white">
          WhatsApp number
        </label>
        <input
          id="whatsapp-phone"
          type="tel"
          autoComplete="tel"
          value={settings.phoneNumber}
          onChange={(event) => setSettings((current) => ({ ...current, phoneNumber: event.target.value }))}
          placeholder="+1 415 555 2671"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/15"
          aria-describedby="whatsapp-phone-help"
        />
        <p id="whatsapp-phone-help" className="mt-2 text-xs leading-5 text-subtle">
          Enter the number that should receive reports, including the country code.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-white/20">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#25D366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">Send me weekly campaign reports</span>
          <span className="mt-1 block text-xs leading-5 text-subtle">
            I agree to receive WhatsApp updates about engagement on videos in my paid creator campaigns. I can turn reports off here at any time.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-sm text-red-300">
          <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 text-sm text-emerald-300">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading || saving || (mode === 'prompt' && (!settings.phoneNumber.trim() || !settings.enabled))}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'prompt' ? 'Save and enable reports' : 'Save preferences'}
        </button>
        {mode === 'settings' && settings.enabled && settings.phoneNumber && (
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || saving || settings.phoneNumber !== savedPhoneNumber}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {testing ? 'Sending test…' : 'Send test message'}
          </button>
        )}
      </div>
      {mode === 'settings' && settings.enabled && settings.phoneNumber && (
        <p className="text-xs leading-5 text-subtle">
          Meta test senders can message only recipients added to the test sender in WhatsApp setup.
        </p>
      )}
    </form>
  );

  if (mode === 'prompt') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="whatsapp-setup-title">
        <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3 text-subtle">
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Optional setup</p>
                <h2 id="whatsapp-setup-title" className="mt-1 text-lg font-bold text-white">Get weekly campaign reports</h2>
                <p className="mt-1.5 text-sm leading-5 text-subtle">
                  Receive views, likes, comments, and other tracked engagement from videos in your paid campaigns.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-white" aria-label="Close WhatsApp setup">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="p-5 sm:p-6">
            {loading ? <p className="text-sm text-subtle">Loading settings…</p> : form}
            <button type="button" onClick={onClose} className="mt-4 text-sm font-medium text-subtle transition-colors hover:text-white">
              Not now
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-2">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3 text-subtle">
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Notifications</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white">Weekly WhatsApp reports</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-5 text-subtle">
              Get a weekly summary of engagement for creator videos you paid to advertise on.
            </p>
          </div>
        </div>
        {!loading && (
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${settings.enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-border bg-background/70 text-subtle'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${settings.enabled ? 'bg-emerald-400' : 'bg-muted'}`} />
            {settings.enabled ? 'Reports on' : 'Reports off'}
          </span>
        )}
      </div>
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="max-w-xl space-y-3" aria-label="Loading settings">
            <div className="h-4 w-36 animate-pulse rounded bg-surface-3" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-surface-3" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-surface-3" />
          </div>
        ) : form}
      </div>
    </section>
  );
}
