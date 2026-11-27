'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, PlayIcon, ShieldCheckIcon, FilmIcon } from '@heroicons/react/24/outline';
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.replace('/', { scroll: false })}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-subtle transition-colors hover:bg-surface-3 hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to feed
          </button>
        </div>
        <div className="mb-6 border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral-text">Your account</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="mt-1 text-sm text-subtle">Manage your demo experience and campaign updates.</p>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface-2 p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3 text-coral-text">
                    <FilmIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-white">Explore the advertiser demo</h2>
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">Demo</span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
                      Try a YouTube campaign with sample channels, a simulated payment, and example performance reports.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={enterDemo}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  Start demo
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-background/60 px-3.5 py-3">
                <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-xs leading-5 text-subtle">
                  Safe to explore. Demo activity is temporary in this browser tab; nothing is sent to the campaign database and no real payment is made.
                </p>
              </div>
              {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-300">{error}</p>}
          </section>

          <WhatsAppReportsSettings />
        </div>
      </div>
    </div>
  );
}
