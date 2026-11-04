'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstallButton({
  label = 'Install app',
  alwaysVisible = false,
}: {
  label?: string;
  alwaysVisible?: boolean;
}) {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installUnavailable, setInstallUnavailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const installCheck = window.setTimeout(() => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || ('standalone' in navigator && navigator.standalone === true);
      if (standalone) setInstalled(true);
    }, 0);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
      setInstallUnavailable(false);
    };
    const handleInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.clearTimeout(installCheck);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) {
      setInstallUnavailable(true);
      return;
    }
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      setPromptEvent(null);
    }
  };

  if ((!promptEvent && !alwaysVisible) || installed) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={install}
        aria-label={label}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.12] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.18]"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span>{label}</span>
      </button>
      {installUnavailable && (
        <p role="status" className="text-center text-xs text-white/45">
          Use your browser&apos;s install option to add Yepper to your desktop.
        </p>
      )}
    </div>
  );
}
