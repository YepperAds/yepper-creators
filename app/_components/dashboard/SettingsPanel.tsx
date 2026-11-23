'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startDemoSession } from '@/app/_lib/demo-session';
import WhatsAppReportsSettings from './WhatsAppReportsSettings';

export default function SettingsPanel() {
  const router = useRouter();
  const [error, setError] = useState('');

  const enterDemo = () => {
    try {
      startDemoSession();
      router.push('/demo');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start the demo.');
    }
  };

  return (
    <div className="h-full overflow-y-auto py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.replace('/', { scroll: false })}
          className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-subtle transition-colors hover:text-white"
        >
          Back to feed
        </button>
        <h1 className="text-base font-semibold text-white">Settings</h1>
      </div>

      <section className="rounded-3xl border border-border bg-surface-2 p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Try Yepper</p>
        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">Explore the advertiser demo</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
          Try a YouTube campaign with fictional channels, a simulated payment, and sample performance reports.
          Demo campaigns and uploaded creatives stay in this browser tab and are cleared when the tab is closed.
          Nothing is sent to the campaign database, and no real payment is made.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={enterDemo}
          className="mt-5 rounded-xl bg-coral px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Start demo
        </button>
      </section>

      <div className="mt-4">
        <WhatsAppReportsSettings />
      </div>
    </div>
  );
}
