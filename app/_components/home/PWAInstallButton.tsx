'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    const handleInstalled = () => setPromptEvent(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      setPromptEvent(null);
    }
  };

  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={install}
      aria-label="Install Yepper as an app"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#C94F12] bg-[#C94F12] text-sm font-semibold text-white transition hover:border-[#A83D0C] hover:bg-[#A83D0C] sm:h-10 sm:w-auto sm:gap-2 sm:px-4"
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">Install app</span>
    </button>
  );
}
