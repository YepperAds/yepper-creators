'use client';

import { useEffect, useState } from 'react';

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
    <form onSubmit={saveSettings} className="space-y-4">
      <div>
        <label htmlFor="whatsapp-phone" className="mb-1.5 block text-sm font-medium text-white">
          WhatsApp phone number
        </label>
        <input
          id="whatsapp-phone"
          type="tel"
          autoComplete="tel"
          value={settings.phoneNumber}
          onChange={(event) => setSettings((current) => ({ ...current, phoneNumber: event.target.value }))}
          placeholder="+14155552671"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-coral"
          aria-describedby="whatsapp-phone-help"
        />
        <p id="whatsapp-phone-help" className="mt-1.5 text-xs leading-5 text-subtle">
          Use the international format, including country code.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3 text-sm leading-5 text-subtle">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
          className="mt-1 accent-coral"
        />
        <span>
          I agree to receive weekly WhatsApp updates about the engagement on videos in my paid creator campaigns.
          I can turn reports off here at any time.
        </span>
      </label>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}

      <button
        type="submit"
        disabled={loading || saving || (mode === 'prompt' && (!settings.phoneNumber.trim() || !settings.enabled))}
        className="rounded-xl bg-coral px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving…' : mode === 'prompt' ? 'Save and enable reports' : 'Save WhatsApp settings'}
      </button>
      {mode === 'settings' && settings.enabled && settings.phoneNumber && (
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || saving || settings.phoneNumber !== savedPhoneNumber}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-white hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? 'Sending test…' : 'Send test message'}
          </button>
          <p className="text-xs text-subtle">
            Meta test senders can message only recipients added to the test sender in WhatsApp setup.
          </p>
        </div>
      )}
    </form>
  );

  if (mode === 'prompt') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="whatsapp-setup-title">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-surface-2 p-6 shadow-2xl sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Optional setup</p>
              <h2 id="whatsapp-setup-title" className="mt-2 text-xl font-bold text-white">Get weekly campaign reports</h2>
              <p className="mt-2 text-sm leading-6 text-subtle">
                Add your WhatsApp number to receive views, likes, comments, and other tracked engagement from videos in your paid campaigns.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-subtle hover:text-white" aria-label="Close WhatsApp setup">
              Close
            </button>
          </div>
          {loading ? <p className="text-sm text-subtle">Loading settings…</p> : form}
          <button type="button" onClick={onClose} className="mt-3 text-sm font-medium text-subtle hover:text-white">
            Not now
          </button>
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-surface-2 p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Notifications</p>
      <h2 className="mt-2 text-xl font-bold text-white">Weekly WhatsApp campaign reports</h2>
      <p className="mb-5 mt-2 max-w-2xl text-sm leading-6 text-subtle">
        Receive a weekly summary of engagement for creator videos you paid to advertise on.
      </p>
      {loading ? <p className="text-sm text-subtle">Loading settings…</p> : form}
    </section>
  );
}
